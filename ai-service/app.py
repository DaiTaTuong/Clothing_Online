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
import time
import base64
from pathlib import Path
from typing import List, Optional, Tuple, Dict, Any
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps
import numpy as np
import cv2

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

# --- 3. Nạp mô hình tách nền (Ưu tiên BiRefNet -> U2-Net via Rembg) ---
rembg_session = None
matting_engine = "opencv-fallback"
try:
    from rembg import new_session, remove

    preferred = os.environ.get("REMBG_MODEL", "u2netp")
    for model_name in [preferred, "u2net_human_seg", "u2net"]:
        try:
            rembg_session = new_session(model_name)
            matting_engine = f"rembg:{model_name}"
            print(f"[+] Rembg sẵn sàng ({model_name})")
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
    """Phát hiện khuôn mặt chính diện hoặc nghiêng nhẹ bằng Haar Cascade."""
    frontal = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    faces = frontal.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(36, 36))
    if len(faces) > 0:
        return [(int(x), int(y), int(w), int(h)) for (x, y, w, h) in faces]
    profile = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_profileface.xml")
    pfaces = profile.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(36, 36))
    return [(int(x), int(y), int(w), int(h)) for (x, y, w, h) in pfaces]


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

    # Fallback khi chưa cài ultralytics: dựa trên nhận diện khuôn mặt bắt buộc
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


def extract_person_to_white_bg(pil_img: Image.Image) -> Image.Image:
    """Tách chủ thể người và phủ nền trắng thuần #FFFFFF."""
    if rembg_session is not None:
        try:
            rgba = remove(pil_img, session=rembg_session)
            white_bg = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
            white_bg.paste(rgba, (0, 0), rgba)
            return white_bg.convert("RGB")
        except Exception as e:
            print(f"[!] Lỗi Rembg, chuyển fallback OpenCV: {e}")

    cv_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
    h, w = cv_img.shape[:2]
    corners = [cv_img[0, 0], cv_img[0, w - 1], cv_img[h - 1, 0], cv_img[h - 1, w - 1]]
    bg_color = np.median(corners, axis=0)
    diff = np.linalg.norm(cv_img.astype(float) - bg_color.astype(float), axis=2)
    mask = (diff > 28).astype(np.uint8) * 255
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    mask = cv2.GaussianBlur(mask, (7, 7), 0)

    white_bg = np.ones_like(cv_img) * 255
    alpha = (mask.astype(float) / 255.0)[:, :, np.newaxis]
    composite = np.clip(cv_img.astype(float) * alpha + white_bg.astype(float) * (1 - alpha), 0, 255).astype(np.uint8)
    return Image.fromarray(cv2.cvtColor(composite, cv2.COLOR_BGR2RGB))


@app.get("/health")
@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "FORME Fashion AI Vision Microservice",
        "device": device,
        "gpu": gpu_name,
        "version": "2.2.0",
        "supported_framings": list(FRAMING_META.keys()),
        "capabilities": {
            "pose_validation": "yolov8-pose" if pose_model is not None else "opencv-face-fallback",
            "matting": matting_engine,
            "tryon_engine": "diffusers-lora" if (diffusers_pipe is not None and lora_loaded) else (
                "diffusers-base" if diffusers_pipe is not None else "pose-face-guided-2d"
            ),
            "lora_loaded": lora_loaded,
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

        # 2. Kiểm tra độ nét
        laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        if laplacian_var < 45.0:
            return {
                "success": False,
                "error": "Ảnh bị mờ hoặc rung tay. Vui lòng giữ chắc máy và chụp lại ở nơi đủ sáng.",
            }

        # 3. Kiểm tra ánh sáng
        mean_brightness = float(np.mean(gray))
        if mean_brightness < 38.0:
            return {
                "success": False,
                "error": "Ảnh quá tối. Vui lòng bật thêm đèn hoặc di chuyển ra nơi đủ ánh sáng.",
            }
        if mean_brightness > 246.0:
            return {
                "success": False,
                "error": "Ảnh bị cháy sáng. Vui lòng tránh nguồn sáng chiếu trực tiếp phía sau lưng.",
            }

        # 4. Nhận diện 1 người + khuôn mặt bắt buộc & tự động phân loại framing
        framing, anchors, err_msg = analyze_person_and_framing(cv_img, gray)
        if err_msg or not framing:
            return {"success": False, "error": err_msg or "Không nhận diện được khuôn mặt trong ảnh."}

        # 5. Tách nền trắng thuần #FFFFFF
        matted_pil = extract_person_to_white_bg(pil_img)

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
    """Tính tọa độ dán/inpaint thích ứng cho cả toàn thân, nửa người và cận mặt & vai."""
    cx = mw * 0.5
    if framing == "portrait_upper":
        shoulder_w = mw * 0.58
        shoulder_y = mh * 0.54
        hip_y = mh * 0.98
        ankle_y = mh * 1.15
    elif framing == "half_body":
        shoulder_w = mw * 0.46
        shoulder_y = mh * 0.34
        hip_y = mh * 0.86
        ankle_y = mh * 1.15
    else:
        shoulder_w = mw * 0.34
        shoulder_y = mh * 0.20
        hip_y = mh * 0.43
        ankle_y = mh * 0.88

    # Ưu tiên tọa độ từ YOLOv8-Pose
    if kp:
        if "left_shoulder" in kp and "right_shoulder" in kp:
            ls, rs = kp["left_shoulder"], kp["right_shoulder"]
            cx = (ls[0] + rs[0]) * 0.5
            shoulder_w = max(abs(ls[0] - rs[0]), mw * 0.20)
            shoulder_y = min(ls[1], rs[1])
        if "left_hip" in kp and "right_hip" in kp:
            lh, rh = kp["left_hip"], kp["right_hip"]
            hip_y = (lh[1] + rh[1]) * 0.5
        if "left_ankle" in kp or "right_ankle" in kp:
            ankle_y = max(kp[k][1] for k in ("left_ankle", "right_ankle") if k in kp)
    elif faces:
        # Nếu không có pose keypoints nhưng có khuôn mặt -> suy ra vị trí cổ & vai cực chuẩn theo mặt
        fx, fy, fw, fh = faces[0]
        cx = fx + fw * 0.5
        shoulder_w = max(fw * 2.35, mw * 0.24)
        shoulder_y = fy + fh * 1.18
        hip_y = min(mh * 0.98, shoulder_y + fw * 3.1)

    if item.category == "bottoms":
        target_w = int(shoulder_w * 1.18)
        target_h = int(target_w * aspect)
        max_h = max(80, int((ankle_y - hip_y) * 1.08))
        if target_h > max_h:
            target_h = max_h
            target_w = int(target_h / max(aspect, 0.2))
        paste_x = int(cx - target_w * 0.5)
        paste_y = int(hip_y - target_h * 0.06)
    elif item.cut == "blazer" or item.layer_level == 2 or item.slot == "outer":
        target_w = int(shoulder_w * 1.56)
        target_h = int(target_w * aspect)
        max_h = max(90, int((hip_y - shoulder_y) * 1.45))
        if target_h > max_h:
            target_h = max_h
            target_w = int(target_h / max(aspect, 0.2))
        paste_x = int(cx - target_w * 0.5)
        paste_y = int(shoulder_y - target_h * 0.08)
    elif item.category == "dresses":
        target_w = int(shoulder_w * 1.42)
        target_h = int(target_w * aspect)
        max_h = max(120, int((ankle_y - shoulder_y) * 0.85))
        if target_h > max_h:
            target_h = max_h
            target_w = int(target_h / max(aspect, 0.2))
        paste_x = int(cx - target_w * 0.5)
        paste_y = int(shoulder_y - target_h * 0.04)
    else:
        target_w = int(shoulder_w * 1.40)
        target_h = int(target_w * aspect)
        max_h = max(90, int((hip_y - shoulder_y) * 1.28))
        if target_h > max_h:
            target_h = max_h
            target_w = int(target_h / max(aspect, 0.2))
        paste_x = int(cx - target_w * 0.5)
        paste_y = int(shoulder_y - target_h * 0.05)

    return max(10, target_w), max(10, target_h), max(0, paste_x), max(0, paste_y)


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
        engine_used = "pose-face-guided-2d" if (kp or faces) else "anatomical-2d"

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
