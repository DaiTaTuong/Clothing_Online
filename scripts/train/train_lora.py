"""
Kịch bản Huấn luyện LoRA thật (PyTorch + Diffusers + PEFT) trên GPU Cục bộ (PC của An Đức Minh Trí)
Đề tài: Hệ thống bán hàng và Phối đồ thời trang AI (SOA & AI)

Yêu cầu môi trường huấn luyện GPU:
  pip install torch torchvision diffusers transformers accelerate peft safetensors pillow

Cấu trúc thư mục dữ liệu đầu vào (--data_dir):
  data/garments/
    ├── linen-shirt.png   (hoặc .jpg/.webp)
    ├── linen-shirt.txt   (mô tả chi tiết sản phẩm, tùy chọn)
    └── ...
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

DEFAULT_BASE_MODEL = "runwayml/stable-diffusion-inpainting"
DEFAULT_LORA_RANK = 16
DEFAULT_LORA_ALPHA = 32
DEFAULT_LEARNING_RATE = 1e-4
DEFAULT_EPOCHS = 50
DEFAULT_BATCH_SIZE = 2
DEFAULT_RESOLUTION = 512


def parse_args():
    parser = argparse.ArgumentParser(description="Huấn luyện LoRA thật cho danh mục sản phẩm thời trang")
    parser.add_argument("--base_model", type=str, default=DEFAULT_BASE_MODEL, help="HuggingFace Base Model ID")
    parser.add_argument("--data_dir", type=str, default="frontend/public/images/garments", help="Thư mục ảnh sản phẩm")
    parser.add_argument("--output_dir", type=str, default="ai-service/weights", help="Thư mục lưu trọng số LoRA")
    parser.add_argument("--rank", type=int, default=DEFAULT_LORA_RANK, help="LoRA rank (r)")
    parser.add_argument("--alpha", type=int, default=DEFAULT_LORA_ALPHA, help="LoRA alpha")
    parser.add_argument("--lr", type=float, default=DEFAULT_LEARNING_RATE, help="Learning rate")
    parser.add_argument("--epochs", type=int, default=DEFAULT_EPOCHS, help="Số epoch huấn luyện")
    parser.add_argument("--batch_size", type=int, default=DEFAULT_BATCH_SIZE, help="Batch size")
    parser.add_argument("--resolution", type=int, default=DEFAULT_RESOLUTION, help="Độ phân giải huấn luyện")
    return parser.parse_args()


def collect_samples(data_dir: Path):
    exts = {".png", ".jpg", ".jpeg", ".webp"}
    samples = []
    if not data_dir.exists():
        return samples
    for path in sorted(data_dir.iterdir()):
        if path.suffix.lower() in exts and path.is_file():
            caption_file = path.with_suffix(".txt")
            if caption_file.exists():
                caption = caption_file.read_text(encoding="utf-8").strip()
            else:
                readable = path.stem.replace("-", " ").replace("_", " ")
                caption = f"studio fashion garment photo of {readable}, high detail fabric texture, pure white background"
            samples.append((path, caption))
    return samples


def main():
    args = parse_args()
    data_dir = Path(args.data_dir)
    output_dir = Path(args.output_dir)

    print("=" * 72)
    print("HUẤN LUYỆN LORA (DIFFUSERS + PEFT) CHO SẢN PHẨM THỜI TRANG FORME STUDIO")
    print(f"[*] Base Model:    {args.base_model}")
    print(f"[*] Data Dir:      {data_dir}")
    print(f"[*] Output Dir:    {output_dir}")
    print(f"[*] LoRA Config:   r={args.rank}, alpha={args.alpha}, lr={args.lr}, epochs={args.epochs}")
    print("=" * 72)

    samples = collect_samples(data_dir)
    if not samples:
        print(f"[!] Không tìm thấy ảnh sản phẩm nào trong '{data_dir}'.")
        sys.exit(1)
    print(f"[+] Tìm thấy {len(samples)} ảnh sản phẩm hợp lệ để huấn luyện.")

    try:
        import torch
        import torch.nn.functional as F
        from torch.utils.data import Dataset, DataLoader
        from PIL import Image
        import numpy as np
        from diffusers import AutoencoderKL, DDPMScheduler, UNet2DConditionModel
        from transformers import CLIPTextModel, CLIPTokenizer
        from peft import LoraConfig, get_peft_model
        from safetensors.torch import save_file
    except ImportError as exc:
        print(f"[!] Thiếu thư viện ML để huấn luyện thật: {exc}")
        print("    Chạy trên máy GPU: pip install torch torchvision diffusers transformers accelerate peft safetensors pillow")
        sys.exit(1)

    if not torch.cuda.is_available():
        print("[!] Cảnh báo: Không phát hiện GPU NVIDIA CUDA. Huấn luyện trên CPU sẽ rất chậm.")
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    weight_dtype = torch.float16 if device.type == "cuda" else torch.float32

    class GarmentDataset(Dataset):
        def __init__(self, items, tokenizer, resolution):
            self.items = items
            self.tokenizer = tokenizer
            self.resolution = resolution

        def __len__(self):
            return len(self.items)

        def __getitem__(self, idx):
            img_path, prompt = self.items[idx]
            img = Image.open(img_path).convert("RGB").resize((self.resolution, self.resolution), Image.Resampling.LANCZOS)
            arr = (np.array(img).astype(np.float32) / 127.5) - 1.0
            pixel_values = torch.from_numpy(arr).permute(2, 0, 1)
            tokens = self.tokenizer(
                prompt,
                truncation=True,
                padding="max_length",
                max_length=self.tokenizer.model_max_length,
                return_tensors="pt",
            ).input_ids[0]
            return {"pixel_values": pixel_values, "input_ids": tokens}

    print("[*] Đang tải Tokenizer, Text Encoder, VAE và U-Net từ Base Model...")
    tokenizer = CLIPTokenizer.from_pretrained(args.base_model, subfolder="tokenizer")
    text_encoder = CLIPTextModel.from_pretrained(args.base_model, subfolder="text_encoder").to(device, dtype=weight_dtype)
    vae = AutoencoderKL.from_pretrained(args.base_model, subfolder="vae").to(device, dtype=weight_dtype)
    unet = UNet2DConditionModel.from_pretrained(args.base_model, subfolder="unet").to(device, dtype=torch.float32)
    noise_scheduler = DDPMScheduler.from_pretrained(args.base_model, subfolder="scheduler")

    vae.requires_grad_(False)
    text_encoder.requires_grad_(False)

    lora_config = LoraConfig(
        r=args.rank,
        lora_alpha=args.alpha,
        lora_dropout=0.05,
        init_lora_weights="gaussian",
        target_modules=["to_k", "to_q", "to_v", "to_out.0"],
    )
    unet = get_peft_model(unet, lora_config)
    unet.print_trainable_parameters()

    dataset = GarmentDataset(samples, tokenizer, args.resolution)
    dataloader = DataLoader(dataset, batch_size=args.batch_size, shuffle=True)
    optimizer = torch.optim.AdamW(unet.parameters(), lr=args.lr, weight_decay=1e-2)

    output_dir.mkdir(parents=True, exist_ok=True)
    loss_history = []
    unet.train()

    for epoch in range(1, args.epochs + 1):
        epoch_loss = 0.0
        steps = 0
        for batch in dataloader:
            optimizer.zero_grad()
            pixel_values = batch["pixel_values"].to(device, dtype=weight_dtype)
            input_ids = batch["input_ids"].to(device)

            with torch.no_grad():
                latents = vae.encode(pixel_values).latent_dist.sample() * vae.config.scaling_factor
                encoder_hidden_states = text_encoder(input_ids)[0].to(dtype=torch.float32)

            noise = torch.randn_like(latents, dtype=torch.float32)
            timesteps = torch.randint(0, noise_scheduler.config.num_train_timesteps, (latents.shape[0],), device=device).long()
            noisy_latents = noise_scheduler.add_noise(latents.to(dtype=torch.float32), noise, timesteps)

            # Nếu Base Model là Inpainting (9 kênh đầu vào), ghép thêm mask toàn bộ & masked_latents
            model_input = noisy_latents
            if unet.config.in_channels == 9:
                mask_latent = torch.ones((latents.shape[0], 1, latents.shape[2], latents.shape[3]), device=device, dtype=torch.float32)
                model_input = torch.cat([noisy_latents, mask_latent, latents.to(dtype=torch.float32)], dim=1)

            noise_pred = unet(model_input, timesteps, encoder_hidden_states).sample
            loss = F.mse_loss(noise_pred, noise, reduction="mean")
            loss.backward()
            torch.nn.utils.clip_grad_norm_(unet.parameters(), 1.0)
            optimizer.step()

            epoch_loss += float(loss.item())
            steps += 1

        avg_loss = round(epoch_loss / max(1, steps), 6)
        entry = {
            "epoch": epoch,
            "total_epochs": args.epochs,
            "loss": avg_loss,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        }
        loss_history.append(entry)
        if epoch == 1 or epoch % 5 == 0 or epoch == args.epochs:
            print(f"Epoch [{epoch:03d}/{args.epochs:03d}] - MSE Loss: {avg_loss:.6f}")

    # Lưu trọng số LoRA chuẩn safetensors & lịch sử loss thật
    lora_state = {k: v.detach().cpu().contiguous() for k, v in unet.state_dict().items() if "lora_" in k}
    weights_path = output_dir / "fashion_lora.safetensors"
    save_file(lora_state, str(weights_path))

    loss_log_path = output_dir / "loss_log.json"
    loss_log_path.write_text(json.dumps(loss_history, indent=2, ensure_ascii=False), encoding="utf-8")

    print("=" * 72)
    print(f"[✓] Đã lưu trọng số LoRA thật: {weights_path}")
    print(f"[✓] Đã lưu log huấn luyện thật: {loss_log_path}")
    print("=" * 72)


if __name__ == "__main__":
    main()
