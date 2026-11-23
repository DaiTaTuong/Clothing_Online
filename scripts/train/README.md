# 🧠 Hướng dẫn Huấn luyện LoRA (Dành riêng cho An Đức Minh Trí)

Tài liệu hướng dẫn thành viên **An Đức Minh Trí** thực hiện huấn luyện thích nghi LoRA (Low-Rank Adaptation) trên máy tính có GPU NVIDIA hoặc Google Colab.

---

## 🛠️ 1. Chuẩn bị Môi trường Python

Yêu cầu máy tính có cài sẵn Python 3.10+ và GPU NVIDIA (CUDA):

```bash
# Cài đặt thư viện huấn luyện
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
pip install diffusers transformers accelerate peft safetensors opencv-python pillow
```

---

## 🚀 2. Chạy Huấn luyện LoRA

```bash
# Chạy script train trên 24 sản phẩm của shop
python scripts/train/train_lora.py --epochs 60 --rank 16 --lr 0.0001
```

Quá trình chạy sẽ:
1. Nạp 24 ảnh sản phẩm phẳng (`garment`) và ảnh mẫu mặc tương ứng.
2. Huấn luyện các ma trận thích nghi LoRA ($r=16, \alpha=32$).
3. Xuất tệp trọng số: `ai-service/weights/fashion_lora.safetensors`.
4. Ghi biểu đồ hàm mất mát: `ai-service/weights/loss_log.json` (dùng để vẽ biểu đồ báo cáo cho hội đồng phản biện).

---

## 🌐 3. Khởi động AI Microservice trên PC và Mở Tunnel

```bash
cd ai-service
pip install fastapi uvicorn rembg
python app.py
```

* AI Server lắng nghe tại `http://127.0.0.1:5001`.
* Nếu muốn chia sẻ cho cả nhóm dùng khi kết nối API Gateway:
  ```bash
  # Mở tunnel bằng cloudflare (hoặc ngrok)
  cloudflared tunnel --url http://localhost:5001
  ```
* Lấy URL dạng `https://xxxx.trycloudflare.com` dán vào file `.env` ở thư mục gốc:
  ```env
  AI_SERVICE_URL=https://xxxx.trycloudflare.com
  ```
