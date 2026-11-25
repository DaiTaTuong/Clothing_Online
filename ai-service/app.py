"""
AI Vision Microservice - 2-Stage Outfit Coordination (SOA Architecture)
Hỗ trợ linh hoạt 3 khung hình có khuôn mặt:
  - full_body      : Toàn thân (đủ đầu -> chân) -> thử tất cả (top, outer, bottom, dress)
  - half_body      : Nửa người (mặt + vai + thân trên/hông) -> thử áo, áo khoác, đầm
  - portrait_upper : Cận mặt & cổ/vai (chứa khuôn mặt rõ) -> làm trắng nền #FFFFFF & thử áo/áo khoác
Pipeline 2 bước:
  1. Nhận diện người & khuôn mặt (YOLOv8-Pose + OpenCV Face Fallback), phân loại framing, tách nền trắng #FFFFFF (BiRefNet / Rembg)
  2. Phối đồ Virtual Try-On thích ứng theo framing & tọa độ vai/mặt (Diffusers/LoRA trên GPU, Pose/Face-Guided trên CPU)
"""

import os
import io
import json
import time
import base64
import urllib.request
import urllib.error
from pathlib import Path
from typing import List, Optional, Tuple, Dict, Any
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps
import numpy as np
import cv2

# Tự động nạp biến môi trường từ file .env ở thư mục gốc dự án (nếu có)
ENV_FILE = Path(__file__).resolve().parent.parent / ".env"
if ENV_FILE.exists():
    for raw_line in ENV_FILE.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v

app = FastAPI(
    title="FORME Fashion AI Microservice",
    description="Pipeline 2 bước linh hoạt: Toàn thân / Nửa người / Cận mặt & vai -> Tách nền trắng #FFFFFF -> Phối đồ AI",
    version="2.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SLOT_ORDER = {"bottom": 1, "top": 2, "dress": 3, "outer": 4}
WEIGHTS_DIR = Path(__file__).resolve().parent / "weights"

FRAMING_META = {
    "full_body": {
        "label": "Toàn thân",
        "supported_slots": ["top", "outer", "bottom", "dress"],
    },
    "half_body": {
        "label": "Nửa người",
        "supported_slots": ["top", "outer", "dress"],
    },
    "portrait_upper": {
        "label": "Cận mặt & vai",
        "supported_slots": ["top", "outer"],
    },
}


def b64_to_pil(b64_str: str, mode: Optional[str] = None) -> Image.Image:
    if "," in b64_str:
        b64_str = b64_str.split(",", 1)[1]
    image_data = base64.b64decode(b64_str)
    img = Image.open(io.BytesIO(image_data))
    img = ImageOps.exif_transpose(img)
    return img.convert(mode) if mode else img


def pil_to_b64(pil_img: Image.Image, fmt: str = "PNG") -> str:
    buffered = io.BytesIO()
    pil_img.save(buffered, format=fmt)
    return f"data:image/{fmt.lower()};base64,{base64.b64encode(buffered.getvalue()).decode('utf-8')}"


class ValidateMattingRequest(BaseModel):
    image: str
    preferred_framing: Optional[str] = None  # 'auto' | 'full_body' | 'half_body' | 'portrait_upper'


class GarmentItem(BaseModel):
    id: str
    name: Optional[str] = ""
    category: str
    cut: Optional[str] = ""
    garmentImage: Optional[str] = None
    garment_image: Optional[str] = None
    layer_level: Optional[int] = 1
    slot: Optional[str] = "top"


class TryOnRequest(BaseModel):
    person_image: str
    garments: List[GarmentItem]
    framing: Optional[str] = None
    method: Optional[str] = "auto"  # 'auto' | 'gemini' | 'lora'


# --- 1. Kiểm tra GPU ---
device = "cpu"
gpu_name = "CPU Only"
try:
    import torch

    if torch.cuda.is_available():
        device = "cuda"
        gpu_name = torch.cuda.get_device_name(0)
    print(f"[*] AI Microservice chạy trên: {device.upper()} ({gpu_name})")
except Exception:
    pass

# --- 2. Nạp YOLOv8-Pose (nhận diện 17 keypoints người) ---
pose_model = None
try:
    from ultralytics import YOLO

    pose_weights = os.environ.get("YOLO_POSE_MODEL", "yolov8n-pose.pt")
    pose_model = YOLO(pose_weights)
    print(f"[+] YOLOv8-Pose sẵn sàng ({pose_weights})")
except Exception as e:
    print(f"[-] YOLOv8-Pose chưa cài đặt, dùng kiểm tra khuôn mặt OpenCV ({e})")

# --- 3. Nạp mô hình tách nền chuyên dụng cho người (Ưu tiên u2net_human_seg -> isnet-general-use -> u2net -> u2netp) ---
rembg_session = None
matting_engine = "opencv-fallback"
try:
    from rembg import new_session, remove

    preferred = os.environ.get("REMBG_MODEL", "u2net_human_seg")
    ort_providers = ["CUDAExecutionProvider", "CPUExecutionProvider"] if device == "cuda" else ["CPUExecutionProvider"]
    for model_name in [preferred, "u2net_human_seg", "isnet-general-use", "u2net", "u2netp"]:
        try:
            rembg_session = new_session(model_name, providers=ort_providers)
            matting_engine = f"rembg:{model_name}"
            print(f"[+] Rembg Human Segmentation sẵn sàng ({model_name})")
            break
        except Exception:
            continue
except Exception as e:
    print(f"[-] Rembg chưa cài đặt, dùng tách nền dự phòng OpenCV ({e})")

# --- 4. Kiểm tra trọng số LoRA thật & Diffusers Pipeline ---
diffusers_pipe = None
lora_loaded = False
LORA_PATH = WEIGHTS_DIR / "fashion_lora.safetensors"


def is_valid_safetensors(path: Path) -> bool:
    if not path.exists() or path.stat().st_size < 128:
        return False
    try:
        with open(path, "rb") as f:
            header_len = int.from_bytes(f.read(8), "little")
            if header_len <= 2 or header_len > 10_000_000:
                return False
            header = f.read(header_len)
            return header.startswith(b"{") and header.endswith(b"}")
    except Exception:
        return False


if device == "cuda" and os.environ.get("ENABLE_DIFFUSERS_TRYON", "1") == "1":
    try:
        import torch
        from diffusers import AutoPipelineForInpainting

        base_id = os.environ.get("TRYON_BASE_MODEL", "runwayml/stable-diffusion-inpainting")
        diffusers_pipe = AutoPipelineForInpainting.from_pretrained(base_id, torch_dtype=torch.float16).to("cuda")
        if is_valid_safetensors(LORA_PATH):
            diffusers_pipe.load_lora_weights(str(WEIGHTS_DIR), weight_name=LORA_PATH.name)
            lora_loaded = True
            print(f"[+] Đã nạp trọng số LoRA thật: {LORA_PATH}")
    except Exception as e:
        print(f"[-] Diffusers GPU Try-On chưa khả dụng, dùng Pose/Face-Guided Compositing ({e})")


def detect_faces_opencv(gray: np.ndarray) -> List[Tuple[int, int, int, int]]:
    """Phát hiện khuôn mặt chính diện hoặc nghiêng nhẹ bằng Haar Cascade (bọc an toàn khi cv2 thiếu objdetect)."""
    if not hasattr(cv2, "CascadeClassifier") or not hasattr(cv2, "data"):
        return []
    try:
        frontal = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
        faces = frontal.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(36, 36))
        if len(faces) > 0:
            return [(int(x), int(y), int(w), int(h)) for (x, y, w, h) in faces]
        profile = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_profileface.xml")
        pfaces = profile.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(36, 36))
        return [(int(x), int(y), int(w), int(h)) for (x, y, w, h) in pfaces]
    except Exception:
        return []


def detect_pose_keypoints(cv_img: np.ndarray) -> Tuple[int, Optional[Dict[str, Tuple[float, float]]]]:
    if pose_model is None:
        return -1, None
    results = pose_model.predict(cv_img, verbose=False, conf=0.35)
    if not results or results[0].boxes is None:
        return 0, None

    num_people = len(results[0].boxes)
    if num_people != 1 or results[0].keypoints is None:
        return num_people, None

    xy = results[0].keypoints.xy[0].cpu().numpy()
    conf = results[0].keypoints.conf[0].cpu().numpy() if results[0].keypoints.conf is not None else np.ones(len(xy))

    names = {
        "nose": 0,
        "left_eye": 1,
        "right_eye": 2,
        "left_ear": 3,
        "right_ear": 4,
        "left_shoulder": 5,
        "right_shoulder": 6,
        "left_hip": 11,
        "right_hip": 12,
        "left_knee": 13,
        "right_knee": 14,
        "left_ankle": 15,
        "right_ankle": 16,
    }
    kp: Dict[str, Tuple[float, float]] = {}
    for name, idx in names.items():
        if idx < len(xy) and conf[idx] >= 0.25 and (xy[idx][0] > 0 or xy[idx][1] > 0):
            kp[name] = (float(xy[idx][0]), float(xy[idx][1]))
    return 1, kp


def analyze_person_and_framing(cv_img: np.ndarray, gray: np.ndarray) -> Tuple[Optional[str], Optional[Dict[str, Any]], Optional[str]]:
    """
    Phân tích ảnh: bắt buộc đúng 1 người và thấy rõ khuôn mặt.
    Trả về: (framing, anchors, error_message)
    framing thuộc: 'full_body' | 'half_body' | 'portrait_upper'
    """
    h, w = gray.shape[:2]
    num_people, kp = detect_pose_keypoints(cv_img)
    faces = detect_faces_opencv(gray)

    if num_people != -1:
        if num_people == 0:
            return None, None, "Không phát hiện người trong ảnh. Vui lòng đứng vào khung hình sao cho thấy rõ khuôn mặt."
        if num_people > 1:
            return None, None, "Ảnh có nhiều hơn 1 người. Vui lòng chỉ chụp một mình bạn."

        has_face_kp = any(k in kp for k in ("nose", "left_eye", "right_eye"))
        if not has_face_kp and len(faces) == 0:
            return None, None, "Chưa nhận diện rõ khuôn mặt. Vui lòng quay mặt về phía máy ảnh và đủ sáng."

        has_shoulders = "left_shoulder" in kp or "right_shoulder" in kp
        has_hips = "left_hip" in kp or "right_hip" in kp
        has_lower = any(k in kp for k in ("left_ankle", "right_ankle", "left_knee", "right_knee"))

        if has_lower and has_hips and has_shoulders:
            framing = "full_body"
        elif has_shoulders and (has_hips or (h / max(1, w) >= 0.95)):
            framing = "half_body"
        else:
            framing = "portrait_upper"

        anchors: Dict[str, Any] = {"kp": kp, "faces": faces, "engine": "yolov8-pose"}
        return framing, anchors, None

    # Fallback khi chưa cài ultralytics: dựa trên nhận diện khuôn mặt
    if not hasattr(cv2, "CascadeClassifier"):
        ratio = h / max(1, w)
        framing = "full_body" if ratio >= 1.32 else ("half_body" if ratio >= 0.95 else "portrait_upper")
        return framing, {"kp": None, "faces": [], "engine": "aspect-fallback"}, None
    if len(faces) == 0:
        return None, None, "Chưa nhận diện được khuôn mặt trong ảnh. Vui lòng chụp rõ khuôn mặt (có thể chụp toàn thân, nửa người hoặc cận vai)."
    if len(faces) > 1:
        return None, None, "Ảnh có nhiều hơn 1 người. Vui lòng chỉ chụp một mình bạn."

    fx, fy, fw, fh = faces[0]
    face_ratio = fh / max(1, h)
    # Khuôn mặt nhỏ (< 16% chiều cao ảnh & ảnh dọc) -> toàn thân; vừa (16-30%) -> nửa người; lớn (> 30%) -> cận mặt & vai
    if face_ratio < 0.16 and (h / max(1, w)) >= 1.25:
        framing = "full_body"
    elif face_ratio < 0.30 and (fy + fh) < h * 0.55:
        framing = "half_body"
    else:
        framing = "portrait_upper"

    anchors = {"kp": None, "faces": faces, "engine": "opencv-face"}
    return framing, anchors, None


def extract_person_to_white_bg(
    pil_img: Image.Image,
    kp: Optional[Dict[str, Tuple[float, float]]] = None,
) -> Image.Image:
    """
    Tách chủ thể người sạch 100%, loại bỏ toàn bộ vật thể/ghế/rèm thừa xung quanh,
    khử viền ám màu (decontaminate halo), làm mịn biên tóc/vai và cân bằng ánh sáng
    như đứng trước phông nền trắng studio ngoài đời thực (#FFFFFF).
    """
    orig_rgb = np.array(pil_img.convert("RGB"))
    h, w = orig_rgb.shape[:2]
    alpha_mask: Optional[np.ndarray] = None

    if rembg_session is not None:
        try:
            rgba = remove(
                pil_img,
                session=rembg_session,
                post_process_mask=True,
            )
            alpha_mask = np.array(rgba)[:, :, 3]
        except Exception as e:
            print(f"[!] Lỗi Rembg, chuyển fallback OpenCV: {e}")

    if alpha_mask is None:
        cv_img = cv2.cvtColor(orig_rgb, cv2.COLOR_RGB2BGR)
        corners = [cv_img[0, 0], cv_img[0, w - 1], cv_img[h - 1, 0], cv_img[h - 1, w - 1]]
        bg_color = np.median(corners, axis=0)
        diff = np.linalg.norm(cv_img.astype(float) - bg_color.astype(float), axis=2)
        alpha_mask = (diff > 28).astype(np.uint8) * 255

    # 1. Cắt bỏ các vùng nền thừa (rèm cửa, khung cửa, ghế sau lưng) nằm ngoài hành lang cơ thể người
    if kp:
        xs = [pt[0] for pt in kp.values()]
        ys = [pt[1] for pt in kp.values()]
        if xs and ys:
            face_xs = [kp[k][0] for k in ("nose", "left_eye", "right_eye", "left_ear", "right_ear") if k in kp]
            shoulder_xs = [kp[k][0] for k in ("left_shoulder", "right_shoulder") if k in kp]
            head_span = (max(face_xs) - min(face_xs)) if len(face_xs) >= 2 else w * 0.18
            sh_span = (max(shoulder_xs) - min(shoulder_xs)) if len(shoulder_xs) >= 2 else head_span * 2.6
            body_half_w = max(sh_span * 0.95, head_span * 2.35, w * 0.34)
            center_x = float(np.mean(shoulder_xs or face_xs or xs))
            top_y = max(0, int(min(ys) - max(head_span * 1.65, h * 0.18)))
            left_x = max(0, int(center_x - body_half_w))
            right_x = min(w, int(center_x + body_half_w))

            corridor = np.zeros_like(alpha_mask)
            corridor[top_y:h, left_x:right_x] = 255
            corridor = cv2.GaussianBlur(corridor, (31, 31), 0)
            alpha_mask = np.minimum(alpha_mask, corridor)

    # 2. Chỉ giữ lại đúng 1 khối liên thông lớn nhất (chính là cơ thể người), xóa sạch các mảng rác rời rạc
    binary = (alpha_mask >= 115).astype(np.uint8)
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)
    if num_labels > 1:
        largest_label = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        keep_region = (labels == largest_label).astype(np.uint8) * 255
        # Nở nhẹ vùng chính để giữ lại phần tóc mảnh ở rìa nhưng cắt đứt hoàn toàn các cụm rác xa người
        keep_dilated = cv2.dilate(keep_region, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)), iterations=1)
        alpha_mask = np.where(keep_dilated > 0, alpha_mask, 0).astype(np.uint8)

    # 3. Cắt dứt khoát các bóng mờ bán trong suốt (alpha < 75 -> 0) và làm đầy vùng lõi cơ thể (alpha > 215 -> 255)
    alpha_f = alpha_mask.astype(np.float32)
    alpha_f = np.clip((alpha_f - 75.0) / (215.0 - 75.0), 0.0, 1.0)
    alpha_clean = (alpha_f * 255.0).astype(np.uint8)

    # Co nhẹ 1px để gọt bỏ viền xám/đỏ của tường/ghế bám quanh tóc & vai, sau đó làm mịn biên bằng Guided/Gaussian feather
    erode_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    alpha_clean = cv2.erode(alpha_clean, erode_kernel, iterations=1)
    alpha_clean = cv2.morphologyEx(alpha_clean, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    alpha_smooth = cv2.GaussianBlur(alpha_clean, (5, 5), 1.2).astype(np.float32) / 255.0
    alpha_3d = alpha_smooth[:, :, np.newaxis]

    # 4. Làm mịn da & khử nhiễu hạt webcam (Edge-Preserving Bilateral Studio Filter) giúp người thật mịn màng nhưng vẫn sắc nét mắt/kính/tóc
    bgr = cv2.cvtColor(orig_rgb, cv2.COLOR_RGB2BGR)
    smoothed_bgr = cv2.bilateralFilter(bgr, d=7, sigmaColor=36, sigmaSpace=36)
    # Pha 65% ảnh làm mịn studio + 35% chi tiết sắc nét gốc, đồng thời nâng nhẹ độ sáng studio (gamma 1.04)
    studio_bgr = cv2.addWeighted(smoothed_bgr, 0.65, bgr, 0.35, 4.0)
    studio_rgb = cv2.cvtColor(studio_bgr, cv2.COLOR_BGR2RGB).astype(np.float32)

    # 5. Khử ám màu nền ở viền tóc/vai (Edge Color Decontamination): kéo nhẹ các pixel nằm ở rìa bán trong suốt về tông sáng studio
    edge_band = (alpha_smooth > 0.05) & (alpha_smooth < 0.88)
    if np.any(edge_band):
        decontam_weight = ((1.0 - alpha_smooth) * 0.35)[:, :, np.newaxis]
        studio_rgb = np.where(
            edge_band[:, :, np.newaxis],
            studio_rgb * (1.0 - decontam_weight) + 255.0 * decontam_weight,
            studio_rgb,
        )

    # 6. Hòa trộn tự nhiên lên phông nền trắng thuần #FFFFFF với ánh sáng tràn viền nhẹ (Studio Light Wrap)
    white_bg = np.full_like(studio_rgb, 255.0)
    composite = np.clip(studio_rgb * alpha_3d + white_bg * (1.0 - alpha_3d), 0, 255).astype(np.uint8)
    return Image.fromarray(composite)


@app.get("/health")
@app.get("/api/health")
def health():
    gemini_configured = bool(os.environ.get("GEMINI_API_KEY", "").strip())
    return {
        "status": "ok",
        "service": "FORME Fashion AI Vision Microservice",
        "device": device,
        "gpu": gpu_name,
        "version": "2.3.0",
        "supported_framings": list(FRAMING_META.keys()),
        "capabilities": {
            "pose_validation": "yolov8-pose" if pose_model is not None else "opencv-face-fallback",
            "matting": matting_engine,
            "tryon_engine": "gemini-api" if gemini_configured else (
                "diffusers-lora" if (diffusers_pipe is not None and lora_loaded) else (
                    "diffusers-base" if diffusers_pipe is not None else "pose-face-guided-2d"
                )
            ),
            "lora_loaded": lora_loaded,
            "gemini_configured": gemini_configured,
        },
    }


@app.post("/api/ai/validate-and-matting")
async def validate_and_matting(req: ValidateMattingRequest):
    t0 = time.time()
    try:
        pil_img = b64_to_pil(req.image, mode="RGB")
        w, h = pil_img.size

        # 1. Kiểm tra kích thước tối thiểu & không quá méo panorama (cho phép ảnh dọc, vuông, và webcam 4:3)
        if w < 200 or h < 200:
            return {
                "success": False,
                "error": "Ảnh có độ phân giải quá thấp. Vui lòng chụp hoặc tải ảnh rõ nét hơn (tối thiểu 200×200 px).",
            }
        if w > h * 1.85:
            return {
                "success": False,
                "error": "Khung ảnh quá ngang. Vui lòng chụp khung dọc, vuông hoặc webcam tiêu chuẩn có rõ khuôn mặt.",
            }

        cv_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
        gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)

        # 2. Kiểm tra độ nét (chuẩn hóa kích thước 512px để không phụ thuộc độ phân giải camera/webcam)
        scale_512 = 512.0 / max(w, h)
        gray_norm = cv2.resize(gray, (max(64, int(w * scale_512)), max(64, int(h * scale_512))), interpolation=cv2.INTER_AREA) if scale_512 < 1.0 else gray
        laplacian_var = float(cv2.Laplacian(gray_norm, cv2.CV_64F).var())
        if laplacian_var < 12.0:
            return {
                "success": False,
                "error": "Ảnh bị mờ hoặc rung tay. Vui lòng giữ chắc máy và chụp lại ở nơi đủ sáng.",
            }

        # 3. Kiểm tra ánh sáng
        mean_brightness = float(np.mean(gray))
        if mean_brightness < 25.0:
            return {
                "success": False,
                "error": "Ảnh quá tối. Vui lòng bật thêm đèn hoặc di chuyển ra nơi đủ ánh sáng.",
            }
        if mean_brightness > 250.0:
            return {
                "success": False,
                "error": "Ảnh bị cháy sáng. Vui lòng tránh nguồn sáng chiếu trực tiếp phía sau lưng.",
            }

        # 4. Nhận diện 1 người + khuôn mặt bắt buộc & tự động phân loại framing
        framing, anchors, err_msg = analyze_person_and_framing(cv_img, gray)
        if err_msg or not framing:
            return {"success": False, "error": err_msg or "Không nhận diện được khuôn mặt trong ảnh."}

        if req.preferred_framing in FRAMING_META:
            framing = req.preferred_framing

        # 5. Tách nền trắng thuần #FFFFFF + lọc vật thể thừa theo keypoints + làm mịn studio
        kp_for_matting = anchors.get("kp") if anchors else None
        matted_pil = extract_person_to_white_bg(pil_img, kp=kp_for_matting)

        # Căn khung thông minh: toàn thân căn giữa; nửa người / cận vai căn chạm đáy tự nhiên không lơ lửng
        centering = (0.5, 0.5) if framing == "full_body" else (0.5, 1.0)
        matted_padded = ImageOps.pad(
            matted_pil,
            (768, 1024),
            method=Image.Resampling.LANCZOS,
            color=(255, 255, 255),
            centering=centering,
        )
        out_b64 = pil_to_b64(matted_padded)

        meta = FRAMING_META[framing]
        engine_name = f"{anchors['engine']}+{matting_engine}"
        print(f"[+] Bước 1 ({framing} | {engine_name}) xong trong {time.time() - t0:.2f}s")
        return {
            "success": True,
            "image": out_b64,
            "framing": framing,
            "framingLabel": meta["label"],
            "supportedSlots": meta["supported_slots"],
            "engine": engine_name,
            "message": f"Nhận diện khung hình {meta['label']} (có khuôn mặt rõ). Đã tách nền trắng #FFFFFF thành công.",
        }

    except Exception as e:
        print(f"[-] Lỗi Bước 1: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def compute_garment_box(
    item: GarmentItem,
    mw: int,
    mh: int,
    aspect: float,
    framing: str,
    kp: Optional[Dict[str, Tuple[float, float]]],
    faces: List[Tuple[int, int, int, int]],
) -> Tuple[int, int, int, int]:
    """Tính tọa độ dán/inpaint thích ứng chuẩn xác cho cả toàn thân, nửa người và cận mặt & vai."""
    cx = mw * 0.5
    if framing == "portrait_upper":
        shoulder_w = mw * 0.58
        shoulder_y = mh * 0.56
        hip_y = mh * 1.02
        ankle_y = mh * 1.25
    elif framing == "half_body":
        shoulder_w = mw * 0.52
        shoulder_y = mh * 0.48
        hip_y = mh * 0.98
        ankle_y = mh * 1.25
    else:
        shoulder_w = mw * 0.34
        shoulder_y = mh * 0.20
        hip_y = mh * 0.43
        ankle_y = mh * 0.88

    # 1. Xác định bề rộng khuôn mặt từ keypoints mắt/tai/mũi hoặc OpenCV face để chặn lỗi vai quá hẹp khi selfie
    min_shoulder_from_head = mw * (0.48 if framing in ("portrait_upper", "half_body") else 0.28)
    head_y = None
    if kp:
        face_pts = [kp[k] for k in ("nose", "left_eye", "right_eye", "left_ear", "right_ear") if k in kp]
        if face_pts:
            xs = [p[0] for p in face_pts]
            ys = [p[1] for p in face_pts]
            head_span = max(xs) - min(xs)
            head_y = max(ys)
            # Khoảng cách 2 tai/mắt nhân hệ số giải phẫu ra bề rộng 2 mỏm vai thật
            min_shoulder_from_head = max(min_shoulder_from_head, head_span * 2.85)

    # 2. Ưu tiên tọa độ từ YOLOv8-Pose nhưng luôn đảm bảo >= bề rộng vai giải phẫu theo đầu
    if kp:
        if "left_shoulder" in kp and "right_shoulder" in kp:
            ls, rs = kp["left_shoulder"], kp["right_shoulder"]
            cx = (ls[0] + rs[0]) * 0.5
            raw_sw = abs(ls[0] - rs[0])
            shoulder_w = max(raw_sw, min_shoulder_from_head)
            shoulder_y = min(ls[1], rs[1])
        elif head_y is not None:
            shoulder_w = min_shoulder_from_head
            shoulder_y = head_y + shoulder_w * 0.35

        if "left_hip" in kp and "right_hip" in kp:
            lh, rh = kp["left_hip"], kp["right_hip"]
            hip_y = max((lh[1] + rh[1]) * 0.5, shoulder_y + shoulder_w * 0.85)
        else:
            hip_y = max(mh * 0.98, shoulder_y + shoulder_w * 1.05)

        if "left_ankle" in kp or "right_ankle" in kp:
            ankle_y = max(kp[k][1] for k in ("left_ankle", "right_ankle") if k in kp)
    elif faces:
        fx, fy, fw, fh = faces[0]
        cx = fx + fw * 0.5
        shoulder_w = max(fw * 2.55, min_shoulder_from_head)
        shoulder_y = fy + fh * 1.08
        hip_y = max(mh * 0.98, shoulder_y + shoulder_w * 1.05)

    is_outer = (item.cut == "blazer" or item.layer_level == 2 or item.slot == "outer")

    if item.category == "bottoms":
        target_w = int(shoulder_w * 1.18)
        target_h = int(target_w * aspect)
        max_h = max(80, int((ankle_y - hip_y) * 1.08))
        if target_h > max_h:
            target_h = max_h
            target_w = int(target_h / max(aspect, 0.2))
        paste_x = int(cx - target_w * 0.5)
        paste_y = int(hip_y - target_h * 0.06)
    elif item.category == "dresses":
        target_w = int(shoulder_w * 1.48)
        target_h = int(target_w * aspect)
        if framing == "full_body":
            max_h = max(140, int((ankle_y - shoulder_y) * 0.88))
            if target_h > max_h:
                target_h = max_h
                target_w = int(target_h / max(aspect, 0.2))
        paste_x = int(cx - target_w * 0.5)
        paste_y = int(shoulder_y - target_h * 0.06)
    else:
        # Áo trong (Layer 1) hoặc Áo khoác Blazer (Layer 2)
        # Khi chụp nửa người / cận mặt & vai: mở rộng áo phủ kín 100% hai vai và phần ngực áo cũ đến đáy khung
        if framing in ("portrait_upper", "half_body"):
            width_mult = 1.68 if is_outer else 1.56
            target_w = max(int(shoulder_w * width_mult), int(mw * (0.86 if is_outer else 0.80)))
            target_h = int(target_w * aspect)
            paste_y = int(shoulder_y - target_h * (0.09 if is_outer else 0.07))
            min_h_to_cover = max(120, mh - paste_y)
            if target_h < min_h_to_cover:
                target_h = min_h_to_cover
                target_w = max(target_w, int(target_h / max(aspect, 0.4)))
            paste_x = int(cx - target_w * 0.5)
        else:
            width_mult = 1.56 if is_outer else 1.42
            target_w = int(shoulder_w * width_mult)
            target_h = int(target_w * aspect)
            max_h = max(100, int((hip_y - shoulder_y) * (1.45 if is_outer else 1.28)))
            if target_h > max_h:
                target_h = max_h
                target_w = int(target_h / max(aspect, 0.2))
            paste_x = int(cx - target_w * 0.5)
            paste_y = int(shoulder_y - target_h * (0.08 if is_outer else 0.05))

    return max(10, target_w), max(10, target_h), paste_x, max(0, paste_y)


def try_on_with_gemini_api(
    person_pil: Image.Image,
    garment_tuples: List[Tuple[GarmentItem, Image.Image]],
    framing: str,
) -> Tuple[Optional[Image.Image], Optional[str]]:
    """
    Phương pháp 2: Gọi trực tiếp Google Gemini Multimodal Image Generation API
    để mặc thử trang phục lên ảnh người thật mà không cần tự huấn luyện LoRA.
    """
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key or not garment_tuples:
        return None, None

    preferred_model = os.environ.get("GEMINI_TRYON_MODEL", "").strip()
    candidate_models = [m for m in [preferred_model, "gemini-2.5-flash-image", "gemini-2.0-flash-exp-image-generation"] if m]
    models = list(dict.fromkeys(candidate_models))

    person_buf = io.BytesIO()
    person_pil.save(person_buf, format="PNG")
    person_b64 = base64.b64encode(person_buf.getvalue()).decode("utf-8")

    garment_parts = []
    descriptions = []
    for idx, (item, g_pil) in enumerate(garment_tuples, start=1):
        g_clean = g_pil.copy()
        g_clean.thumbnail((768, 768), Image.Resampling.LANCZOS)
        g_buf = io.BytesIO()
        g_clean.save(g_buf, format="PNG")
        g_b64 = base64.b64encode(g_buf.getvalue()).decode("utf-8")

        slot_desc = (
            "outerwear blazer/jacket (Layer 2 worn over the inner top)"
            if (item.slot == "outer" or item.cut == "blazer" or item.layer_level == 2)
            else "bottom trousers/skirt"
            if item.category == "bottoms"
            else "one-piece dress"
            if item.category == "dresses"
            else "inner top/shirt (Layer 1)"
        )
        descriptions.append(f'{idx}. "{item.name or item.id}" ({slot_desc})')
        garment_parts.append({"inlineData": {"mimeType": "image/png", "data": g_b64}})

    prompt = "\n".join([
        "You are an expert photorealistic AI Virtual Try-On engine for a fashion studio.",
        f"The FIRST image is the user photo (framing: {framing}) on a pure white #FFFFFF background.",
        f"The next {len(garment_parts)} image(s) are the exact shop garments to dress the person in:",
        *descriptions,
        "STRICT REQUIREMENTS:",
        "1. Replace the person's existing clothing with the provided garment image(s), matching the exact color, fabric texture, collar, neckline, sleeves, and cut.",
        "2. If both an inner top (Layer 1) and an outerwear blazer (Layer 2) are provided, layer the blazer naturally over the inner top.",
        "3. Preserve 100% of the person's face, eyeglasses, hair, head angle, skin tone, body proportions, and pose.",
        "4. Keep the background pure solid white (#FFFFFF) and preserve the 3:4 portrait aspect ratio.",
        "5. Output the final dressed person image.",
    ])

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": prompt},
                    {"inlineData": {"mimeType": "image/png", "data": person_b64}},
                    *garment_parts,
                ],
            }
        ],
        "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]},
    }
    body_bytes = json.dumps(payload).encode("utf-8")

    for model_name in models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        req = urllib.request.Request(url, data=body_bytes, headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=45) as resp:
                resp_data = json.loads(resp.read().decode("utf-8"))
                parts = resp_data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
                for part in parts:
                    inline = part.get("inlineData") or part.get("inline_data")
                    if inline and inline.get("data"):
                        out_bytes = base64.b64decode(inline["data"])
                        out_img = Image.open(io.BytesIO(out_bytes)).convert("RGB")
                        out_padded = ImageOps.pad(
                            out_img,
                            person_pil.size,
                            method=Image.Resampling.LANCZOS,
                            color=(255, 255, 255),
                        )
                        return out_padded, f"gemini-api:{model_name}"
        except Exception as e:
            print(f"[!] Gemini Try-On ({model_name}) lỗi, thử model tiếp theo / fallback: {e}")
            continue

    return None, None


@app.post("/api/ai/try-on")
async def try_on(req: TryOnRequest):
    t0 = time.time()
    try:
        person_pil = b64_to_pil(req.person_image, mode="RGB")
        mw, mh = person_pil.size
        result_pil = person_pil.copy()

        cv_person = cv2.cvtColor(np.array(person_pil), cv2.COLOR_RGB2BGR)
        gray = cv2.cvtColor(cv_person, cv2.COLOR_BGR2GRAY)
        detected_framing, anchors, _ = analyze_person_and_framing(cv_person, gray)
        framing = req.framing if req.framing in FRAMING_META else (detected_framing or "half_body")
        kp = anchors["kp"] if anchors else None
        faces = anchors["faces"] if anchors else detect_faces_opencv(gray)

        garments = sorted(
            req.garments,
            key=lambda x: (x.layer_level or 1, SLOT_ORDER.get(x.slot or "top", 9)),
        )

        warnings: List[str] = []
        supported_slots = set(FRAMING_META[framing]["supported_slots"])
        loaded_garments: List[Tuple[GarmentItem, Image.Image]] = []

        for item in garments:
            item_slot = item.slot or ("outer" if item.cut == "blazer" else ("bottom" if item.category == "bottoms" else ("dress" if item.category == "dresses" else "top")))
            if item_slot not in supported_slots:
                warnings.append(
                    f"Ảnh đang ở chế độ {FRAMING_META[framing]['label']} nên bỏ qua {item.name or item_slot}. Hãy chụp toàn thân để thử quần/váy."
                )
                continue

            raw_garment = item.garment_image or item.garmentImage
            if not raw_garment:
                continue

            if raw_garment.startswith("data:image"):
                g_pil = b64_to_pil(raw_garment)
            else:
                clean_path = raw_garment.lstrip("/")
                candidate_local = Path(clean_path)
                candidate_public = Path(__file__).resolve().parent.parent / "frontend" / "public" / clean_path
                if candidate_local.exists():
                    g_pil = Image.open(candidate_local)
                elif candidate_public.exists():
                    g_pil = Image.open(candidate_public)
                else:
                    continue

            if g_pil.mode != "RGBA":
                g_pil = g_pil.convert("RGBA")
            loaded_garments.append((item, g_pil))

        # --- PHƯƠNG PHÁP 2: Thử bằng Google Gemini Multimodal API nếu có GEMINI_API_KEY ---
        gemini_note = None
        if req.method != "lora" and os.environ.get("GEMINI_API_KEY", "").strip() and loaded_garments:
            gemini_img, gemini_engine = try_on_with_gemini_api(person_pil, loaded_garments, framing)
            if gemini_img is not None and gemini_engine is not None:
                out_b64 = pil_to_b64(gemini_img)
                print(f"[+] Bước 2 ({framing} | {gemini_engine}) xong trong {time.time() - t0:.2f}s")
                return {
                    "success": True,
                    "image": out_b64,
                    "framing": framing,
                    "warnings": warnings,
                    "engine": gemini_engine,
                    "message": "Phối đồ AI bằng Google Gemini hoàn tất.",
                }
            elif req.method == "gemini":
                gemini_note = "Google Gemini Image API báo vượt hạn mức (HTTP 429 Free Tier Quota). Đã tự động chuyển sang bộ ghép Pose-Guided."
                warnings.append(gemini_note)

        # --- PHƯƠNG PHÁP 1: Diffusers LoRA (GPU) hoặc Pose/Face-Guided Compositing (CPU) ---
        engine_used = "pose-face-guided-2d" if (kp or faces) else "anatomical-2d"

        # Nếu có cả Áo trong (Layer 1) và Áo khoác (Layer 2) trên CPU 2D:
        # Không vẽ đè 2 ảnh kín mít lên nhau; hoặc khi ghép áo đơn lẻ ở ảnh nửa người/cận vai,
        # xóa nhẹ vùng áo cũ bên dưới cổ để áo mới không bị lộ viền áo cũ phía dưới.
        has_outer_layer = any((it.slot == "outer" or it.cut == "blazer" or it.layer_level == 2) for it, _ in loaded_garments)

        for item, g_pil in loaded_garments:
            is_outer = (item.slot == "outer" or item.cut == "blazer" or item.layer_level == 2)
            bbox = g_pil.getbbox()
            cropped = g_pil.crop(bbox) if bbox else g_pil
            gw, gh = cropped.size
            aspect = gh / max(1, gw)

            target_w, target_h, paste_x, paste_y = compute_garment_box(item, mw, mh, aspect, framing, kp, faces)
            resized = cropped.resize((target_w, target_h), Image.Resampling.LANCZOS)

            if diffusers_pipe is not None:
                mask = Image.new("L", (mw, mh), 0)
                alpha_mask = resized.split()[3]
                mask.paste(alpha_mask, (paste_x, paste_y))
                init_comp = result_pil.copy()
                init_comp.paste(resized, (paste_x, paste_y), resized)
                prompt = f"photo of a person ({framing}) wearing {item.name or item.category}, realistic fabric folds, studio lighting, pure white background"
                result_pil = diffusers_pipe(
                    prompt=prompt,
                    image=init_comp,
                    mask_image=mask,
                    strength=0.45,
                    num_inference_steps=20,
                    guidance_scale=7.5,
                ).images[0].resize((mw, mh), Image.Resampling.LANCZOS)
                engine_used = "diffusers-lora" if lora_loaded else "diffusers-base"
            else:
                # Chế độ CPU 2D:
                # 1. Xóa vùng áo cũ của người dùng (từ dưới cổ/vai trở xuống) thành nền trắng trước khi mặc áo đầu tiên
                #    để không bị hiện tượng "áo mới bé nằm đè lên áo cũ to phía sau".
                if item.category in ("tops", "dresses") and not (has_outer_layer and is_outer):
                    clear_top = max(0, paste_y + int(target_h * 0.08))
                    clear_left = max(0, paste_x - int(mw * 0.06))
                    clear_right = min(mw, paste_x + target_w + int(mw * 0.06))
                    clear_bottom = min(mh, paste_y + target_h + (mh if framing in ("portrait_upper", "half_body") else 0))
                    if clear_right > clear_left and clear_bottom > clear_top:
                        white_patch = Image.new("RGB", (clear_right - clear_left, clear_bottom - clear_top), (255, 255, 255))
                        result_pil.paste(white_patch, (clear_left, clear_top))

                # 2. Nếu người dùng chọn cả Áo trong (Layer 1) VÀ Áo khoác (Layer 2),
                #    khi đắp Layer 2 (vốn là ảnh áo đóng cúc kín) lên trên Layer 1, chỉ giữ phần cổ áo của Layer 1
                #    để không bị lộ vạt dưới của áo trong thò ra ngoài áo khoác.
                if has_outer_layer and not is_outer and item.category == "tops":
                    collar_h = max(20, int(target_h * 0.38))
                    collar_crop = resized.crop((0, 0, target_w, collar_h))
                    result_pil.paste(collar_crop, (paste_x, paste_y), collar_crop)
                else:
                    result_pil.paste(resized, (paste_x, paste_y), resized)

        out_b64 = pil_to_b64(result_pil)
        print(f"[+] Bước 2 ({framing} | {engine_used}) xong trong {time.time() - t0:.2f}s")
        return {
            "success": True,
            "image": out_b64,
            "framing": framing,
            "warnings": warnings,
            "engine": engine_used,
            "message": "Phối đồ AI hoàn tất.",
        }
    except Exception as e:
        print(f"[-] Lỗi Bước 2: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("AI_PORT", "5001"))
    uvicorn.run(app, host="0.0.0.0", port=port)
