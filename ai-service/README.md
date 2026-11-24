# 🎨 Hướng dẫn triển khai AI Microservice (Virtual Try-On 2 Bước)

> Dành cho đồ án **Kiến trúc hướng dịch vụ (SOA)** — Chạy trực tiếp trên máy tính có Python (Local GPU / CPU).

---

## 💻 Chạy trực tiếp trên máy tính (Local)

1. **Cài đặt thư viện** (từ thư mục gốc dự án):
   ```bash
   pip install -r requirements.txt
   ```

2. **Khởi chạy Server**:
   ```bash
   python app.py
   ```
   Server sẽ lắng nghe tại `http://127.0.0.1:5001`.

3. **Cấu hình vào `.env`** (ở thư mục gốc `Clothing_Online`):
   ```env
   AI_SERVICE_URL=http://127.0.0.1:5001
   ```

   *(Nếu triển khai trên PC riêng để cả nhóm kết nối qua Gateway, có thể dùng Cloudflare Tunnel `cloudflared tunnel --url http://localhost:5001` và dán URL vào `AI_SERVICE_URL`.)*
