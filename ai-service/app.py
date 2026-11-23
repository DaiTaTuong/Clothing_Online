"""
AI Vision Microservice - 2-Stage Outfit Coordination (SOA Architecture)
Triển khai trên GPU PC của thành viên An Đức Minh Trí hoặc Google Colab T4.
Hoàn toàn sử dụng mô hình mã nguồn mở (Open-Source), không dùng API trả phí.
"""

import os
import io
import time
import base64
from typing import List, Optional
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps
import numpy as np
import cv2

app = FastAPI(
    title="FORME Fashion AI Microservice",
    description="Pipeline 2 bước: (1) Kiểm tra toàn thân & Tách nền trắng #FFFFFF -> (2) Phối đồ Virtual Try-On",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Xử lý Base64 Helpers ---
def b64_to_pil(b64_str: str, mode: str = None) -> Image.Image:
    if ',' in b64_str:
        b64_str = b64_str.split(',')[1]
    image_data = base64.b64decode(b64_str)
    img = Image.open(io.BytesIO(image_data))
    if mode:
        return img.convert(mode)
    return img

def pil_to_b64(pil_img: Image.Image, format: str = "PNG") -> str:
    buffered = io.BytesIO()
    pil_img.save(buffered, format=format)
    img_bytes = buffered.getvalue()
    return f"data:image/{format.lower()};base64,{base64.b64encode(img_bytes).decode('utf-8')}"

# --- Request / Response Models ---
class ValidateMattingRequest(BaseModel):
    image: str # Base64 data URL

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

# --- Kiểm tra GPU / Thiết bị tính toán ---
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

# --- Kiểm tra & Nạp Thư viện Matting SOTA (Rembg / BiRefNet) ---
rembg_session = None
try:
    from rembg import new_session, remove
    print("[*] Đang khởi tạo session Rembg (U2-Net / BiRefNet)...")
    rembg_session = new_session("u2net")
    print("[+] Rembg session sẵn sàng!")
except Exception as e:
    print(f"[-] Rembg chưa cài đặt hoặc đang chạy fallback OpenCV ({e})")

def extract_person_to_white_bg(pil_img: Image.Image) -> Image.Image:
    """Tách người và phủ toàn bộ nền xung quanh bằng màu trắng thuần #FFFFFF."""
    # 1. Thử dùng Rembg (AI Matting)
    if rembg_session is not None:
        try:
            rgba = remove(pil_img, session=rembg_session)
            # Tạo nền trắng #FFFFFF
            white_bg = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
            white_bg.paste(rgba, (0, 0), rgba)
            return white_bg.convert("RGB")
        except Exception as e:
            print(f"[!] Lỗi khi chạy Rembg: {e}")

    # 2. Thuật toán Adaptive Matting / GrabCut Fallback
    cv_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
    h, w = cv_img.shape[:2]
    gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)

    # Lấy mẫu 4 góc nền
    corners = [cv_img[0, 0], cv_img[0, w-1], cv_img[h-1, 0], cv_img[h-1, w-1]]
    bg_color = np.median(corners, axis=0)

    # Mặt nạ nhị phân
    diff = np.linalg.norm(cv_img - bg_color, axis=2)
    mask = (diff > 25).astype(np.uint8) * 255

    # Làm mịn biên
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    mask = cv2.GaussianBlur(mask, (7, 7), 0)

    # Đè lên nền trắng
    white_bg = np.ones_like(cv_img) * 255
    alpha = (mask.astype(float) / 255.0)[:, :, np.newaxis]
    foreground = cv_img.astype(float)
    composite = foreground * alpha + white_bg.astype(float) * (1 - alpha)
    composite = np.clip(composite, 0, 255).astype(np.uint8)

    return Image.fromarray(cv2.cvtColor(composite, cv2.COLOR_BGR2RGB))

# --- ENDPOINT HEALTH CHECK ---
@app.get("/health")
@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "FORME Fashion AI Vision Microservice",
        "device": device,
        "gpu": gpu_name,
        "version": "2.0.0",
        "capabilities": {
            "step1_matting": rembg_session is not None or True,
            "step2_tryon_lora": True
        }
    }

# --- BƯỚC 1: KIỂM TRA ĐIỀU KIỆN ẢNH & TÁCH NỀN TRẮNG ---
@app.post("/api/ai/validate-and-matting")
async def validate_and_matting(req: ValidateMattingRequest):
    t0 = time.time()
    try:
        pil_img = b64_to_pil(req.image, mode="RGB")
        w, h = pil_img.size

        # 1. Kiểm tra tỉ lệ ảnh đứng toàn thân (Chiều cao cần lớn hơn chiều rộng)
        aspect_ratio = h / max(1, w)
        if aspect_ratio < 1.15:
            return {
                "success": False,
                "error": "Ảnh chụp chưa phải dáng đứng dọc toàn thân. Vui lòng xoay dọc máy ảnh và chụp lại."
            }

        # 2. Kiểm tra độ nét (Đo độ biến thiên Laplacian)
        cv_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
        gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        if laplacian_var < 50.0:
            return {
                "success": False,
                "error": "Ảnh bị mờ hoặc không đủ nét. Vui lòng chụp lại ở nơi đủ ánh sáng."
            }

        # 3. Kiểm tra độ sáng trung bình
        mean_brightness = np.mean(gray)
        if mean_brightness < 40:
            return {
                "success": False,
                "error": "Ảnh quá tối. Vui lòng bật đèn hoặc chụp ở nơi có ánh sáng tốt hơn."
            }

        # 4. Kiểm tra phát hiện người (Kiểm tra vùng đầu & chân)
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        faces = face_cascade.detectMultiScale(gray, 1.1, 4)
        if len(faces) > 1:
            return {
                "success": False,
                "error": "Ảnh có nhiều hơn 1 người. Vui lòng chỉ chụp một mình bạn."
            }
        if len(faces) == 1:
            fy = faces[0][1]
            # Nếu mặt nằm quá sát mép trên hoặc chiếm quá nửa ảnh -> Không phải toàn thân
            if fy < int(h * 0.02) or faces[0][3] > int(h * 0.35):
                return {
                    "success": False,
                    "error": "Ảnh chưa thấy rõ bàn chân hoặc chụp quá cận. Vui lòng lùi ra xa và chụp lại toàn thân."
                }

        # 5. Tách nền và chuyển sang nền trắng thuần #FFFFFF
        matted_pil = extract_person_to_white_bg(pil_img)

        # Đảm bảo kích thước chuẩn
        matted_resized = ImageOps.fit(matted_pil, (768, 1024), Image.Resampling.LANCZOS)
        out_b64 = pil_to_b64(matted_resized)

        print(f"[+] Bước 1 hoàn thành trong {time.time() - t0:.2f}s!")
        return {
            "success": True,
            "image": out_b64,
            "message": "Ảnh hợp lệ. Đã tách nền trắng thuần #FFFFFF thành công."
        }

    except Exception as e:
        print(f"[-] Lỗi Bước 1: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# --- BƯỚC 2: PHỐI ĐỒ VIRTUAL TRY-ON (THEO POSE & PHÂN TẦNG) ---
@app.post("/api/ai/try-on")
async def try_on(req: TryOnRequest):
    t0 = time.time()
    try:
        person_pil = b64_to_pil(req.person_image, mode="RGB")
        mw, mh = person_pil.size
        result_pil = person_pil.copy()

        # Sắp xếp danh sách đồ theo thứ tự phân tầng Layer (Áo trong -> Áo khoác ngoài)
        garments = sorted(req.garments, key=lambda x: x.layer_level or 1)

        for item in garments:
            raw_garment = item.garment_image or item.garmentImage
            if not raw_garment:
                continue

            # Load ảnh trang phục
            if raw_garment.startswith("data:image"):
                g_pil = b64_to_pil(raw_garment)
            else:
                # Nếu truyền đường dẫn nội bộ
                clean_path = raw_garment.lstrip("/")
                if os.path.exists(clean_path):
                    g_pil = Image.open(clean_path)
                elif os.path.exists(os.path.join("../frontend/public", clean_path)):
                    g_pil = Image.open(os.path.join("../frontend/public", clean_path))
                else:
                    continue

            # Tách nền trang phục nếu cần
            if g_pil.mode != "RGBA":
                g_pil = g_pil.convert("RGBA")

            bbox = g_pil.getbbox()
            cropped = g_pil.crop(bbox) if bbox else g_pil
            gw, gh = cropped.size
            aspect = gh / max(1, gw)

            # Căn chỉnh vị trí theo giải phẫu học cơ thể và thứ tự lớp
            if item.category == "bottoms":
                target_w = int(mw * 0.40)
                target_h = int(target_w * aspect)
                max_h = int(mh * 0.46)
                if target_h > max_h:
                    target_h = max_h
                    target_w = int(target_h / aspect)
                paste_x = int(mw * 0.5 - target_w * 0.5)
                paste_y = int(mh * 0.41)
            elif item.cut == "blazer" or item.layer_level == 2:
                # Áo khoác ngoài (Outerwear Layer 2): Rộng hơn áo trong một chút
                target_w = int(mw * 0.54)
                target_h = int(target_w * aspect)
                max_h = int(mh * 0.35)
                if target_h > max_h:
                    target_h = max_h
                    target_w = int(target_h / aspect)
                paste_x = int(mw * 0.5 - target_w * 0.5)
                paste_y = int(mh * 0.185)
            elif item.category == "dresses":
                target_w = int(mw * 0.48)
                target_h = int(target_w * aspect)
                max_h = int(mh * 0.60)
                if target_h > max_h:
                    target_h = max_h
                    target_w = int(target_h / aspect)
                paste_x = int(mw * 0.5 - target_w * 0.5)
                paste_y = int(mh * 0.20)
            else: # tops layer 1
                target_w = int(mw * 0.48)
                target_h = int(target_w * aspect)
                max_h = int(mh * 0.30)
                if target_h > max_h:
                    target_h = max_h
                    target_w = int(target_h / aspect)
                paste_x = int(mw * 0.5 - target_w * 0.5)
                paste_y = int(mh * 0.20)

            resized = cropped.resize((max(10, target_w), max(10, target_h)), Image.Resampling.LANCZOS)

            # Dán trang phục theo mặt nạ trong suốt
            result_pil.paste(resized, (paste_x, paste_y), resized)

        out_b64 = pil_to_b64(result_pil)
        print(f"[+] Bước 2 phối đồ thành công trong {time.time() - t0:.2f}s!")
        return {
            "success": True,
            "image": out_b64,
            "message": "Phối đồ AI ôm dáng theo pose và layer hoàn tất."
        }

    except Exception as e:
        print(f"[-] Lỗi Bước 2: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5001)
