# Thư mục Trọng số LoRA (`ai-service/weights/`)

Thư mục này lưu đầu ra từ quá trình huấn luyện LoRA thật trên GPU (`scripts/train/train_lora.py`):
- `fashion_lora.safetensors` — Trọng số LoRA thật chuẩn safetensors (tự động nạp bởi `ai-service/app.py` khi chạy trên GPU).
- `loss_log.json` — Nhật ký MSE Loss thật theo từng epoch để vẽ biểu đồ hội tụ trong báo cáo SOA.

Chạy huấn luyện trên máy có GPU NVIDIA:
```bash
python scripts/train/train_lora.py --data_dir frontend/public/images/garments --output_dir ai-service/weights --epochs 50
```
