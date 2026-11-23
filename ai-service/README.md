# 🎨 Hướng dẫn triển khai AI Microservice (Virtual Try-On & Face Swap)

> Dành riêng cho đồ án **Kiến trúc hướng dịch vụ (SOA)** — Sử dụng **Google Colab (GPU T4 miễn phí)** hoặc chạy **Local Python**.

---

## 🚀 Cách 1: Chạy trên Google Colab (Khuyên dùng - 0đ kinh phí)

1. **Mở Google Colab**:
   - Truy cập: [https://colab.research.google.com](https://colab.research.google.com)
   - Chọn tab **Upload** và tải lên file `ai-service/colab_tryon.ipynb`.

2. **Cấu hình GPU miễn phí**:
   - Vào menu: `Runtime` ➔ `Change runtime type` (Đổi loại môi trường thực thi).
   - Chọn: **T4 GPU** ➔ Bấm **Save**.

3. **Lấy Ngrok Authtoken miễn phí**:
   - Đăng ký một tài khoản miễn phí tại [https://dashboard.ngrok.com](https://dashboard.ngrok.com).
   - Vào mục **Your Authtoken** và copy đoạn mã token (Ví dụ: `2t8X...`).
   - Dán token vào ô code ở Bước 4 trong file Colab: `NGROK_TOKEN = "your_token_here"`.

4. **Bấm Chạy (Run All)**:
   - Bấm `Runtime` ➔ `Run all` (hoặc phím tắt `Ctrl + F9`).
   - Khi chạy xong ô cuối cùng, bạn sẽ thấy thông báo:
     ```
     🎉 AI MICROSERVICE ĐÃ HOẠT ĐỘNG THÀNH CÔNG!
     🔗 ĐƯỜNG LINK AI CỦA BẠN: https://xxxx-xx-xx.ngrok-free.app
     ```

5. **Kết nối vào Web của bạn**:
   - Mở file `.env` ở thư mục gốc của dự án `Clothing_Online`.
   - Thêm dòng:
     ```env
     AI_SERVICE_URL=https://xxxx-xx-xx.ngrok-free.app
     ```
   - Khởi động lại web: `npm run dev`.
   - Bây giờ bạn có thể kéo số đo cơ thể, tải ảnh chân dung lên và bấm **"Thử bằng AI"**!

---

## 💻 Cách 2: Chạy trực tiếp trên máy tính của bạn (Local)

Nếu máy tính của bạn có Python 3.10+ (và card rời NVIDIA):

1. **Cài đặt thư viện**:
   ```bash
   cd ai-service
   pip install fastapi uvicorn pydantic pillow opencv-python numpy onnxruntime-gpu insightface
   ```

2. **Khởi chạy Server**:
   ```bash
   python app.py
   ```
   Server sẽ lắng nghe tại `http://127.0.0.1:5001`.

3. **Cấu hình vào `.env`**:
   ```env
   AI_SERVICE_URL=http://127.0.0.1:5001
   ```
