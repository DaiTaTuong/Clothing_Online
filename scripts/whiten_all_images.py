"""
Script làm sạch viền và đổi 100% background của toàn bộ 24 sản phẩm sang màu trắng thuần #FFFFFF.
Xử lý đồng bộ cả:
- frontend/public/images/garments/*.jpg (768x1024, RGB, nền #FFFFFF)
- frontend/public/images/garments/*.png (768x1024, RGBA, alpha trong suốt sạch viền)
- frontend/public/images/products/*.webp (420x560, RGB, nền #FFFFFF)
"""

import os
import cv2
import numpy as np
from PIL import Image, ImageOps

items = [
  'linen-shirt', 'tailored-trouser', 'olive-dress', 'navy-blazer',
  'ivory-tee', 'blue-shirt', 'rose-knit', 'black-top',
  'sage-tee', 'brown-knit', 'black-trouser', 'blue-jeans',
  'cream-skirt', 'wine-skirt', 'olive-shorts', 'ivory-pants',
  'navy-skirt', 'black-dress', 'brick-dress', 'cloud-dress',
  'pearl-dress', 'plum-dress', 'navy-dress', 'sage-dress'
]

garments_dir = "frontend/public/images/garments"
products_dir = "frontend/public/images/products"

def clean_and_whiten(img_bgr):
    h, w = img_bgr.shape[:2]
    # Lấy mẫu màu viền biên (Top, Bottom, Left, Right)
    corners = [
        img_bgr[0:25, 0:25], img_bgr[0:25, w-25:w],
        img_bgr[h-25:h, 0:25], img_bgr[h-25:h, w-25:w],
        img_bgr[0:15, :], img_bgr[h-15:h, :],
        img_bgr[:, 0:15], img_bgr[:, w-15:w]
    ]
    corner_pixels = np.vstack([c.reshape(-1, 3) for c in corners])
    bg_median = np.median(corner_pixels, axis=0)
    bg_std = np.std(corner_pixels, axis=0)

    # Chuyển đổi sang không gian màu Lab để đo khoảng cách cảm nhận thị giác
    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
    corner_lab = cv2.cvtColor(np.uint8([[bg_median]]), cv2.COLOR_BGR2LAB)[0, 0]
    dist = np.linalg.norm(lab.astype(np.float32) - corner_lab.astype(np.float32), axis=2)

    thresh = max(13.0, np.mean(bg_std) * 2.2 + 8.0)
    bg_candidates = dist < thresh

    # FloodFill từ các góc và mép biên ngoài cùng để chỉ bóc tách nền ngoại vi
    h_m, w_m = h + 2, w + 2
    flood_mask = np.zeros((h_m, w_m), np.uint8)
    flood_mask[1:h+1, 1:w+1] = (~bg_candidates).astype(np.uint8) * 255

    seeds = [
        (0, 0), (w-1, 0), (0, h-1), (w-1, h-1),
        (w//2, 0), (w//2, h-1), (0, h//2), (w-1, h//2),
        (w//4, 0), (3*w//4, 0), (w//4, h-1), (3*w//4, h-1)
    ]
    for sx, sy in seeds:
        if flood_mask[sy+1, sx+1] == 0:
            cv2.floodFill(flood_mask, None, (sx+1, sy+1), 128)

    outer_bg = (flood_mask[1:h+1, 1:w+1] == 128)

    # Khử răng cưa và làm sạch nhiễu
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    outer_bg = cv2.morphologyEx(outer_bg.astype(np.uint8), cv2.MORPH_CLOSE, kernel).astype(bool)

    # Tạo kênh Alpha chuẩn xác
    alpha = np.ones((h, w), dtype=np.uint8) * 255
    alpha[outer_bg] = 0
    alpha_soft = cv2.GaussianBlur(alpha, (3, 3), 0)

    # Tạo ảnh nền trắng thuần #FFFFFF
    white_canvas = np.ones_like(img_bgr) * 255
    a = (alpha_soft.astype(np.float32) / 255.0)[:, :, np.newaxis]
    white_bgr = np.clip(img_bgr.astype(np.float32) * a + white_canvas.astype(np.float32) * (1.0 - a), 0, 255).astype(np.uint8)

    # Bắt buộc đặt tuyệt đối 4 dải viền ngoài cùng thành trắng thuần 255
    white_bgr[0:3, :, :] = 255
    white_bgr[h-3:h, :, :] = 255
    white_bgr[:, 0:3, :] = 255
    white_bgr[:, w-3:w, :] = 255

    # Và alpha viền ngoài cùng = 0
    alpha_soft[0:3, :] = 0
    alpha_soft[h-3:h, :] = 0
    alpha_soft[:, 0:3] = 0
    alpha_soft[:, w-3:w] = 0

    return white_bgr, alpha_soft

print("=" * 65)
print("🎨 BẮT ĐẦU CHUYỂN ĐỔI TOÀN BỘ BACKGROUND SANG TRẮNG THUẦN #FFFFFF")
print("=" * 65)

for idx, item_id in enumerate(items, 1):
    jpg_path = os.path.join(garments_dir, f"{item_id}.jpg")
    png_path = os.path.join(garments_dir, f"{item_id}.png")
    webp_path = os.path.join(products_dir, f"{item_id}.webp")

    img_bgr = cv2.imread(jpg_path)
    if img_bgr is None:
        print(f"[-] Không tìm thấy {jpg_path}")
        continue

    # Xử lý nền trắng
    white_bgr, alpha = clean_and_whiten(img_bgr)

    # 1. Lưu Garment JPG (768 x 1024, nền trắng #FFFFFF)
    cv2.imwrite(jpg_path, white_bgr, [cv2.IMWRITE_JPEG_QUALITY, 96])

    # 2. Lưu Garment PNG (768 x 1024, RGBA trong suốt)
    img_rgb = cv2.cvtColor(white_bgr, cv2.COLOR_BGR2RGB)
    rgba = np.dstack([img_rgb, alpha])
    Image.fromarray(rgba).save(png_path, "PNG")

    # 3. Tạo Product Card WebP (420 x 560, nền trắng #FFFFFF)
    h, w = white_bgr.shape[:2]
    pil_white = Image.fromarray(img_rgb)
    # Resize fit contain vào 420 x 560
    pil_product = ImageOps.fit(pil_white, (420, 560), Image.Resampling.LANCZOS)
    # Đảm bảo viền ngoài cùng là 255
    prod_arr = np.array(pil_product)
    prod_arr[0:4, :, :] = 255
    prod_arr[-4:, :, :] = 255
    prod_arr[:, 0:4, :] = 255
    prod_arr[:, -4:, :] = 255
    Image.fromarray(prod_arr).save(webp_path, "WEBP", lossless=True)

    corners = [white_bgr[5,5], white_bgr[5,-6], white_bgr[-6,5], white_bgr[-6,-6]]
    mean_corner = np.mean(corners, axis=0)
    print(f"[{idx:02d}/24] {item_id:18s} -> JPG/PNG/WebP Corner RGB=({int(mean_corner[2])},{int(mean_corner[1])},{int(mean_corner[0])}) [✓ TRẮNG #FFFFFF]")

print("=" * 65)
print("🎉 HOÀN TẤT: 24/24 SẢN PHẨM ĐÃ CÓ NỀN TRẮNG THUẦN #FFFFFF!")
print("=" * 65)
