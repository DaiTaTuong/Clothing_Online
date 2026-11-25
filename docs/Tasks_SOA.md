# TÀI LIỆU THIẾT KẾ KIẾN TRÚC VÀ KẾ HOẠCH PHÂN CÔNG API (SOA & AI)

**Đề tài:** Hệ thống thương mại điện tử thời trang tích hợp AI Stylist và AI Phối đồ thực tế (Virtual Try-On 2 bước)  
**Kiến trúc:** Service-Oriented Architecture (SOA) kết hợp AI Microservice (`ai-service/app.py`)  
**Chuẩn đặc tả API:** OpenAPI 3.0 định dạng JSON (`docs/api/*.json`)  
**Quy mô phân công phần API:** 5 thành viên (chia đều 20% khối lượng / người)

---

## 📌 NGUYÊN TẮC THIẾT KẾ VÀ PHẠM VI DỰ ÁN

1. **Phần Giao diện Bán hàng (Shop UI) — GIỮ NGUYÊN**:
   * Tận dụng toàn bộ giao diện bán hàng demo đã xây dựng sẵn (`frontend/src/features/shop/Shop.jsx`, `Account.jsx`, bộ CSS và Navbar/Footer).
   * Thành viên **Nguyễn Xuân Tường** chịu trách nhiệm duy trì UI hiện có, chỉ tập trung đấu nối dữ liệu API thực, tích hợp Widget Chatbot và kích hoạt nút *"Thử ngay"* / *"Phối cả set"* để điều hướng sang Phòng phối đồ.
2. **Các Phân hệ còn lại — THIẾT KẾ CƠ BẢN ĐỂ THÀNH VIÊN TỰ TAY THỰC HIỆN**:
   * Tài liệu này đóng vai trò là **Bản Đặc tả Kỹ thuật và Khung Thiết kế Nền tảng (Baseline Architectural Blueprint)**.
   * Cung cấp đầy đủ: Kiến trúc thành phần, Lược đồ Database (Schema), Hợp đồng API (Contracts), Thuật toán cốt lõi, Kịch bản huấn luyện AI LoRA và Mô hình máy trạng thái (State Machine).
   * Trên cơ sở đó, từng thành viên (**Lợi, Thành, Tùng, Trí**) sẽ tự tay thiết kế chi tiết mã nguồn, thuật toán và triển khai từ đầu (from scratch) cho phân hệ của mình.
3. **Chi phí bên thứ ba = 0 VNĐ**:
   * Tuyệt đối không dùng API trả phí (FASHN.ai).
   * Toàn bộ mô hình AI sử dụng mã nguồn mở SOTA (YOLOv8-pose, BiRefNet/RMBG-1.4, CatVTON) và **tự huấn luyện LoRA trên máy tính có GPU NVIDIA của thành viên An Đức Minh Trí**.

---

## MỤC LỤC

- **PHẦN 1. BẢN THIẾT KẾ KIẾN TRÚC NỀN TẢNG (BASELINE SYSTEM DESIGN)**
  - 1.1. Sơ đồ Kiến trúc Tổng thể (SOA System Blueprint)
  - 1.2. Thiết kế Cơ bản: Giao diện Phòng phối đồ AI & Camera Guide
  - 1.3. Thiết kế Cơ bản: Backend Gateway, Database & Quản lý Phiên
  - 1.4. Thiết kế Cơ bản: AI Stylist & Thuật toán Phân tầng Layering
  - 1.5. Thiết kế Cơ bản: AI Vision Pipeline 2 Bước & Huấn luyện LoRA
  - 1.6. Chuẩn hóa Hợp đồng API Dùng chung (OpenAPI 3.0 JSON Specifications)
- **PHẦN 2. KẾ HOẠCH PHÂN CÔNG NHIỆM VỤ API CHO 5 THÀNH VIÊN**
  - 2.1. Cấu trúc thư mục đặc tả JSON (`docs/api/`) và Phân định sở hữu
  - 2.2. Chi tiết đầu việc API từng thành viên (Lợi, Tường, Tùng, Thành, Trí)
  - 2.3. Quy chuẩn chung (API Governance) và Đầu việc nhóm
  - 2.4. Tổng hợp phân bổ khối lượng (Cân bằng 20% / thành viên)
- **PHẦN 3. TIẾN ĐỘ, KIỂM THỬ VÀ NGHIỆM THU HỌC THUẬT**
  - 3.1. Lộ trình 14 ngày và Ma trận bàn giao
  - 3.2. 10 Kịch bản kiểm thử tích hợp End-to-End (K01 – K10)
  - 3.3. Hồ sơ học thuật phục vụ báo cáo (Loss Curve, SSIM, CLIP Score)
  - 3.4. Phân chia thuyết trình và kịch bản demo

---

# PHẦN 1. BẢN THIẾT KẾ KIẾN TRÚC NỀN TẢNG (BASELINE SYSTEM DESIGN)

### 1.1. Sơ đồ Kiến trúc Tổng thể (SOA System Blueprint)

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        TẦNG TRÌNH DIỄN (FRONTEND)                     │
│  ┌───────────────────────────────┐   ┌──────────────────────────────┐  │
│  │     Shop & Chatbot UI         │   │  Fitting Room & Camera Guide │  │
│  │     (GIỮ NGUYÊN UI CŨ)        │   │    (THIẾT KẾ MỚI TỪ ĐẦU)     │  │
│  │  Nguyễn Xuân Tường phụ trách  │   │  Nguyễn Phúc Thành phụ trách │  │
│  └──────────────┬────────────────┘   └──────────────┬───────────────┘  │
└─────────────────┼───────────────────────────────────┼──────────────────┘
                  │ HTTP / REST API                   │
                  ▼                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  TẦNG TRUNG TÂM & NỀN TẢNG (BACKEND API GATEWAY)        │
│                    (Doãn Duy Lợi thiết kế & phát triển)                │
│  - Session Manager & Guest Identity (Cookie HttpOnly)                  │
│  - Catalog, Cart & Order Services (SQLite / PostgreSQL)                │
│  - Privacy Manager: Cron Job tự động xóa ảnh sau 24h (TTL 24h)         │
│  - Asynchronous Task Dispatcher & In-memory Result Cache               │
│  - Reverse Proxy kết nối tới AI Microservice trên PC của Trí           │
└─────────────────┬───────────────────────────────────┬──────────────────┘
                  │                                   │
         Internal │ REST                     Internal │ REST (LAN / Tunnel)
                  ▼                                   ▼
┌──────────────────────────────────┐ ┌───────────────────────────────────┐
│     AI STYLIST MICROSERVICE      │ │    AI VISION TRY-ON MICROSERVICE  │
│  (Hoàng Lâm Tùng tự phát triển)  │ │   (An Đức Minh Trí tự phát triển) │
│ - Chatbot LLM tư vấn phong cách  │ │     [Chạy trên GPU PC của Trí]    │
│ - Chuẩn hóa Dataset 24 đồ shop   │ │ - Endpoint 1: YOLO + BiRefNet     │
│ - Thuật toán giải quyết xung đột │ │   (Validate & Tách nền trắng)     │
│   slot và sắp xếp Layer 1 / 2    │ │ - Endpoint 2: CatVTON + LoRA      │
│ - Đề xuất phối đồ theo dịp       │ │   (Inference với weights đã train)│
└──────────────────────────────────┘ └───────────────────────────────────┘
```

---

### 1.2. Thiết kế Cơ bản: Giao diện Phòng phối đồ AI & Camera Guide (Nguyễn Phúc Thành)

Thành viên **Nguyễn Phúc Thành** tự tay thiết kế và lập trình giao diện Phòng thử đồ từ đầu tại thư mục `frontend/src/features/fitting-room/`.

#### 1. Cấu trúc Layout 3 Cột (3-Column Layout)
* **Cột 1: Ảnh Người Dùng, Camera Guide & Bước 1 (`fit-profile`)**:
  * Hỗ trợ 3 chế độ khung hình có khuôn mặt: `Toàn thân (full_body)`, `Nửa người (half_body)`, `Cận mặt & vai (portrait_upper)` hoặc `Tự động (auto)`.
  * Tích hợp **Camera Silhouette Guide**, đo ánh sáng realtime và hẹn giờ đếm ngược `3s / 5s` để người dùng kịp đứng vào khung hình.
  * Nút bấm *"Bước 1: Kiểm tra & Tách nền"* chuẩn hóa ảnh về nền trắng thuần `#FFFFFF` (`768×1024`).
* **Cột 2: Khung hình Trung tâm & Trình diễn (`fit-stage`)**:
  * Bộ công cụ so sánh **Before / After** (`Trước (Gốc)`, `Sau (Thử đồ)`, và thanh kéo `So sánh` dùng `clip-path` chồng khít 100%).
  * Các nút chức năng: *"Lưu kết quả"*, *"Lịch sử phối đồ đã lưu"*, *"Tải ảnh kết quả"* và *"Thêm cả bộ vào giỏ"*.
* **Cột 3: Tủ đồ & Quản lý Slot / Phối lớp (`fit-wardrobe`)**:
  * Hiển thị 4 ô slot trực quan kèm chọn size: `Áo trong (top)`, `Khoác ngoài (outer)`, `Quần / Váy (bottom)`, `Đầm liền (dress)`.
  * Danh sách 24 sản phẩm từ `data/catalog.mjs`; khi chọn trùng slot hoặc chuyển đổi giữa Đầm và Áo/Quần sẽ tự động giải quyết xung đột và báo hiệu rõ ràng.
  * Nút bấm *"Bước 2: Bắt đầu phối đồ AI"*.

#### 2. Máy trạng thái giao diện (State Machine Diagram)
```text
[Khởi tạo: Chưa có ảnh]
         │ (Bấm "Tải ảnh" hoặc "Bật Camera + Hẹn giờ 3s/5s")
         ▼
[Chụp/Chọn ảnh] ──► [Chọn khung hình: Tự động / Toàn thân / Nửa người / Cận vai]
                            │
                            ▼ (Bấm "Bước 1: Kiểm tra & Tách nền")
                 [Gửi sang Backend: Bước 1]
                            │
            ┌───────────────┴───────────────┐
            ▼ (Thành công: 1 người + rõ mặt) ▼ (Lỗi: Thiếu mặt/nhiều người/mờ/tối)
   [Hiển thị ảnh nền trắng #FFFFFF] [Hiển thị thông báo lỗi tiếng Việt]
            │                              └──► (Yêu cầu chụp/chọn lại)
            ▼ (Chọn đồ theo Slot & Bấm "Bước 2: Bắt đầu phối đồ AI")
   [Gửi sang Backend: Bước 2 (Kèm kiểm tra Cache Hash)]
            │
            ▼ (Hoàn tất)
   [Hiển thị kết quả Before/After] ──► [Lưu lịch sử / Thêm cả bộ vào giỏ / Tải về]
```

---

### 1.3. Thiết kế Cơ bản: Backend Gateway, Database & Quản lý Phiên (Doãn Duy Lợi)

Thành viên **Doãn Duy Lợi** tự tay thiết kế kiến trúc Backend Gateway tại `backend/src/`.

#### 1. Lược đồ Cơ sở Dữ liệu SQLite (`backend/src/platform/store.mjs`)
```sql
PRAGMA journal_mode = WAL;

-- 1. Bảng Tài khoản Người dùng & Quản trị
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password TEXT NOT NULL,            -- scrypt salt:hash
    role TEXT NOT NULL                 -- 'member' | 'admin'
);

-- 2. Bảng Phiên (Guest g:<uuid> & Member u:<userId>)
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,            -- SHA-256 hash của cookie forme_sid
    owner TEXT NOT NULL,
    user_id TEXT,
    expires INTEGER NOT NULL
);

-- 3. Bảng Trạng thái Phiên (Hồ sơ vóc dáng, Giỏ hàng, Hội thoại Stylist)
CREATE TABLE IF NOT EXISTS states (
    owner TEXT PRIMARY KEY,
    value TEXT NOT NULL,               -- JSON { profile, profileVersion, faceId, cart, messages, conversationId }
    updated INTEGER NOT NULL
);

-- 4. Bảng Lưu trữ Ảnh Nhị phân Tạm thời (TTL 24h cho khách, 30 ngày khi user lưu)
CREATE TABLE IF NOT EXISTS media (
    id TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    kind TEXT NOT NULL,                -- 'face' | 'avatar' | 'try-on'
    data BLOB NOT NULL,
    hash TEXT NOT NULL,
    expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS media_exp ON media(expires);

-- 5. Bảng Tác vụ Thử đồ & Bộ nhớ đệm Cache Hash (TTL 24h)
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    type TEXT NOT NULL,                -- 'avatar' | 'try-on'
    cache_key TEXT NOT NULL,           -- SHA-256 hash chống chạy lặp lại cùng bộ phối
    status TEXT NOT NULL,              -- 'queued' | 'processing' | 'completed' | 'failed'
    payload TEXT NOT NULL,             -- JSON { stage, profileVersion, productId, productIds, mode, imageId, saved, engine }
    created INTEGER NOT NULL,
    expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS jobs_cache ON jobs(owner, type, cache_key, created);

-- 6. Bảng Định mức Sử dụng AI Theo Ngày
CREATE TABLE IF NOT EXISTS usage (
    date TEXT PRIMARY KEY,
    count INTEGER NOT NULL
);
```

#### 2. Cơ chế Bảo mật Dữ liệu & Tự động Xóa ảnh sau 24h (Privacy Engine)
* Mọi ảnh và lượt thử đồ của phiên khách được gán thời hạn `expires = now() + 86400000` (24 giờ). Khi người dùng đăng nhập và bấm **Lưu kết quả**, thời hạn được gia hạn lên 30 ngày.
* Định kỳ mỗi 60 giây, tiến trình `store.sweep()` tự động chạy trong transaction để thu hồi toàn bộ phiên, trạng thái khách, ảnh BLOB và jobs đã hết hạn:
  ```javascript
  const sweep = () => txn(() => {
    run('DELETE FROM sessions WHERE expires<=?', now());
    run("DELETE FROM states WHERE owner LIKE 'g:%' AND owner NOT IN (SELECT owner FROM sessions)");
    run('DELETE FROM media WHERE expires<=?', now());
    run('DELETE FROM jobs WHERE expires<=?', now());
  });
  ```

#### 3. Reverse Proxy & Bộ nhớ đệm Điều phối sang PC của Trí
* Gateway đóng vai trò điều phối tác vụ (Task Dispatcher).
* Khi nhận request `POST /api/ai/try-on`, Gateway chuẩn hóa danh sách món đồ và tính `cacheKey = SHA256(['ai-v2.2', framing, SHA256(personImage), sortedItems])`:
  * Nếu `cacheKey` đã tồn tại trong bảng `jobs` của `owner` và còn hạn → Trả ngay kết quả `cached: true` cùng ảnh PNG từ bảng `media` trong `< 0.1s`.
  * Nếu chưa có → Gửi sang `AI_SERVICE_URL` (`http://192.168.x.x:5001`) hoặc tự động fallback sang bộ ghép phân tầng 2D tại Gateway khi AI Microservice offline, sau đó lưu vào `media` + `jobs`.

---

### 1.4. Thiết kế Cơ bản: AI Stylist & Thuật toán Phân tầng Layering (Hoàng Lâm Tùng)

Thành viên **Hoàng Lâm Tùng** tự tay thiết kế và lập trình module Stylist tại `backend/src/modules/stylist/` và `backend/src/routes/stylist.routes.mjs`.

#### 1. Chuẩn hóa Bộ Dataset 24 Sản phẩm của Shop (`data/catalog.mjs`)
Tùng thu thập, chuẩn hóa ảnh và biên soạn danh mục 24 sản phẩm trong `data/catalog.mjs` cùng bộ ảnh tách nền trong suốt tại `frontend/public/images/garments/*.png`:
* 24 sản phẩm chia đều thành 3 nhóm danh mục (`8 tops`, `8 bottoms`, `8 dresses`), ánh xạ vào 4 slot phối đồ:
  * **7 Áo trong (`slot: 'top'`, `layer_level: 1`)**: Sơ mi, áo thun, áo dệt kim, áo sát nách.
  * **1 Áo khoác ngoài (`slot: 'outer'`, `layer_level: 2`)**: Blazer cổ ve Muse (`cut: 'blazer'`).
  * **8 Quần & Chân váy (`slot: 'bottom'`, `layer_level: 1`)**: Quần ống suông, quần tây, quần jeans, quần shorts, chân váy chữ A / midi.
  * **8 Đầm liền (`slot: 'dress'`, `layer_level: 1`)**: Đầm midi, đầm hai dây, đầm cổ V, đầm sơ mi, đầm quấn.
* Mỗi sản phẩm có đầy đủ: Ảnh sản phẩm WebP, ảnh garment PNG tách nền để thử đồ & huấn luyện LoRA, bảng thông số size (`XS` → `3XL`), tồn kho theo size, tông da và dịp mặc phù hợp.

#### 2. Thuật toán Tiền xử lý Set đồ & Sắp xếp Thứ tự Layer (`validateAndOrderOutfit`)
Khi người dùng chọn nhiều món hoặc nhận gợi ý từ Stylist, thuật toán giải quyết xung đột giữa 4 slot (`top`, `bottom`, `outer`, `dress`) và sắp xếp theo thứ tự lớp mặc (`layer_level` và `SLOT_ORDER = { bottom: 1, top: 2, dress: 3, outer: 4 }`):
```javascript
// Thuật toán Chuẩn hóa Set đồ & Phân tầng Layer (backend/src/routes/stylist.routes.mjs)
const SLOT_ORDER = { bottom: 1, top: 2, dress: 3, outer: 4 };

export function validateAndOrderOutfit(productIds) {
  const slots = { top: null, bottom: null, outer: null, dress: null };
  const notifications = [];

  for (const id of productIds) {
    const prod = byId.get(id);
    if (!prod) continue;
    const isOuter = prod.cut === 'blazer';
    const slot = isOuter ? 'outer' : (prod.category === 'bottoms' ? 'bottom' : (prod.category === 'dresses' ? 'dress' : 'top'));
    const layer_level = isOuter ? 2 : 1;
    // Giải quyết xung đột: Đầm thay thế Top + Bottom; chọn Top/Bottom sẽ gỡ Đầm; cùng slot tự ghi đè
    // ...
  }

  const orderedItems = Object.values(slots)
    .filter(Boolean)
    .sort((a, b) => (a.layer_level - b.layer_level) || ((SLOT_ORDER[a.slot] || 9) - (SLOT_ORDER[b.slot] || 9)));

  return { orderedItems, notifications };
}
```

#### 3. Thiết kế AI Stylist Chatbot (`rules.mjs` + `llm.mjs`)
* Phân tích ngữ cảnh tiếng Việt có dấu/không dấu: danh mục, kiểu cắt (`cut`), màu sắc, dịp mặc (`office`, `casual`, `formal`), ngân sách (`dưới 500k`, `1,2 triệu`), tông da, vóc dáng và tư vấn size theo số đo 3 vòng.
* Khi có `OPENAI_API_KEY`, module `llm.mjs` viết lại lời tư vấn tự nhiên và tuyệt đối chỉ sử dụng sản phẩm có thật từ kết quả xếp hạng (`rules.mjs`), chống hallucination 100%.

---

### 1.5. Thiết kế Cơ bản: AI Vision Pipeline 2 Bước & Huấn luyện LoRA (An Đức Minh Trí)

Thành viên **An Đức Minh Trí** tự tay thiết kế cấu trúc AI Microservice tại `ai-service/app.py` và kịch bản huấn luyện tại `scripts/train/train_lora.py`.

#### 1. Quy trình Huấn luyện LoRA Offline (`scripts/train/train_lora.py`)
* **Mô hình Base**: Stable Diffusion Inpainting (`runwayml/stable-diffusion-inpainting`) kết hợp PEFT LoRA.
* **Kỹ thuật**: Gắn LoRA adapters vào các tầng Cross-Attention (`to_k`, `to_q`, `to_v`, `to_out.0`) của U-Net với tham số:
  * Rank $r = 16$, LoRA Alpha $\alpha = 32$, LoRA Dropout $= 0.05$.
  * Optimizer: `AdamW`, Learning Rate: $1\times 10^{-4}$, Batch size: 2, Số epochs: 50.
* **Tập dữ liệu**: 24 ảnh sản phẩm từ `frontend/public/images/garments` kèm caption mô tả.
* **Kết quả đầu ra**: Tệp trọng số `ai-service/weights/fashion_lora.safetensors` và nhật ký hội tụ hàm mất mát `ai-service/weights/loss_log.json`.

#### 2. BƯỚC 1: Kiểm tra Khuôn mặt / Khung hình & Tách nền trắng (`/api/ai/validate-and-matting`)
* **Hỗ trợ linh hoạt 3 chế độ khung hình (`full_body`, `half_body`, `portrait_upper`)**:
  * Kiểm tra kích thước tối thiểu ($\ge 200\times 200\text{ px}$), tỉ lệ khung hình không méo panorama ($W \le 1.85 \times H$), độ nét ($\text{Var}(\text{Laplacian}) \ge 45$) và độ sáng trung bình ($38 \le \bar{I} \le 246$).
  * Chạy **YOLOv8-Pose** (17 keypoints) kết hợp **OpenCV Haar Cascade Face Detection**: Bắt buộc có **đúng 1 người** và **nhận diện rõ khuôn mặt**.
  * Tự động phân loại khung hình (hoặc áp dụng `preferredFraming` người dùng chọn):
    * `full_body` (Toàn thân): Thấy đủ vai, hông và đầu gối/cổ chân → Hỗ trợ thử `top`, `outer`, `bottom`, `dress`.
    * `half_body` (Nửa người): Thấy mặt, vai và thân trên/hông → Hỗ trợ thử `top`, `outer`, `dress`.
    * `portrait_upper` (Cận mặt & vai): Thấy rõ khuôn mặt và vùng cổ/vai → Hỗ trợ thử `top`, `outer`.
  * *Nếu vi phạm*: Trả thông báo tiếng Việt cụ thể (VD: *"Ảnh có nhiều hơn 1 người. Vui lòng chỉ chụp một mình bạn."* hoặc *"Chưa nhận diện rõ khuôn mặt..."*).
* **Tách nền chuyên dụng**:
  * Đưa ảnh hợp lệ qua **BiRefNet / Rembg** (kèm fallback tách nền OpenCV).
  * Phủ nền trắng thuần `#FFFFFF` và chuẩn hóa về khung `768×1024` bằng `ImageOps.pad` (căn giữa cho ảnh toàn thân, căn chạm đáy cho ảnh nửa người/cận vai).

#### 3. BƯỚC 2: AI Virtual Try-On Thích ứng theo Khung hình (`/api/ai/try-on`)
* **Đầu vào**: Ảnh người mẫu nền trắng từ Bước 1 + Danh sách trang phục đã giải quyết xung đột slot và sắp xếp theo thứ tự lớp (`bottom` → `top` → `dress` → `outer`).
* **Xử lý ghép đồ**:
  * Tự động kiểm tra các món đồ so với `supportedSlots` của khung hình hiện tại: nếu ảnh ở chế độ `portrait_upper` hoặc `half_body` mà chọn kèm quần/chân váy (`bottom`), hệ thống tự động bỏ qua món không thuộc khung hình và trả về cảnh báo trong mảng `warnings`.
  * Tính toán hộp tọa độ trang phục (`compute_garment_box`) bám sát keypoints vai/hông/mắt cá từ YOLOv8-Pose hoặc suy luận tỉ lệ giải phẫu từ vị trí khuôn mặt.
  * Nếu có GPU + Diffusers (`fashion_lora.safetensors`), chạy Inpainting hòa trộn nếp vải và ánh sáng; nếu chạy CPU, sử dụng Pose/Face-Guided 2D Compositing theo đúng thứ tự lớp Layer 1 → Layer 2.
  * Giữ nguyên 100% khuôn mặt, màu da, kiểu tóc và nền trắng `#FFFFFF`.

---

### 1.6. Chuẩn hóa Hợp đồng API Dùng chung (OpenAPI 3.0 JSON Specifications)

Toàn bộ API của hệ thống được đặc tả bằng chuẩn **OpenAPI 3.0 định dạng JSON** tại thư mục `docs/api/` (dùng `$ref` tham chiếu schema dùng chung từ `docs/api/common-schemas.json`) và được API Gateway tự động hợp nhất phục vụ tại `GET /api/openapi.json`:

```text
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                  DANH MỤC API DÙNG CHUNG & PHÂN CHIA 5 FILE JSON SPEC                    │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ 0. SCHEMA DÙNG CHUNG (docs/api/common-schemas.json - Cả nhóm thống nhất)                 │
│    ErrorResponse { code, message, requestId }, HealthResponse, PaginationMeta            │
│    GET  /api/openapi.json            -> Hợp nhất toàn bộ 5 file OpenAPI JSON của hệ thống│
│                                                                                          │
│ 1. IDENTITY, SESSION & PROFILE (docs/api/01-identity-profile.json - Doãn Duy Lợi)        │
│    GET  /api/health                  -> Kiểm tra trạng thái sống của Backend Gateway     │
│    GET  /api/session                 -> Lấy thông tin phiên khách / user & state hiện tại│
│    POST /api/auth/register           -> Đăng ký tài khoản + merge guest session          │
│    POST /api/auth/login              -> Đăng nhập + merge guest session                  │
│    POST /api/auth/logout             -> Đăng xuất & cấp phiên khách mới                  │
│    GET  /api/profile                 -> Lấy hồ sơ vóc dáng & profileVersion              │
│    PUT  /api/profile                 -> Cập nhật số đo, tông da, phong cách, dáng mặt    │
│    GET  /api/admin/overview          -> Thống kê tổng quan (chỉ admin demo)              │
│                                                                                          │
│ 2. CATALOG, SEARCH & CART (docs/api/02-catalog-cart.json - Nguyễn Xuân Tường)            │
│    GET  /api/products                -> Danh sách sản phẩm phân trang & lọc              │
│    GET  /api/products/:id            -> Chi tiết 1 sản phẩm                              │
│    GET  /api/recommendations         -> Gợi ý sản phẩm xếp hạng theo hồ sơ               │
│    POST /api/search                  -> Tìm kiếm & xếp hạng nâng cao theo bộ lọc         │
│    GET  /api/cart                    -> Lấy thông tin giỏ hàng & tổng tiền               │
│    POST/PATCH/DELETE /api/cart/items -> Thêm, sửa số lượng, xóa sản phẩm trong giỏ       │
│                                                                                          │
│ 3. AI STYLIST & CONVERSATION (docs/api/03-stylist-chat.json - Hoàng Lâm Tùng)            │
│    GET  /api/conversations/:id       -> Lấy lịch sử hội thoại theo session               │
│    POST /api/chat                    -> Gửi câu hỏi Stylist, nhận tư vấn & product cards │
│    POST /api/stylist/validate-outfit -> Kiểm tra xung đột slot & sắp xếp layer_level     │
│                                                                                          │
│ 4. MEDIA & ASYNC TRY-ON JOBS (docs/api/04-media-tryon-jobs.json - Nguyễn Phúc Thành)     │
│    POST /api/media                   -> Tải ảnh người dùng lên (tối đa 5MB/7MB payload)  │
│    GET/DELETE /api/media/:id         -> Đọc ảnh PNG (no-store) hoặc xóa ảnh theo owner   │
│    POST /api/avatars, /api/try-ons   -> Tạo tác vụ bất đồng bộ (202 Accepted)            │
│    GET  /api/jobs/:id                -> Polling trạng thái & tiến trình tác vụ           │
│    GET  /api/try-ons                 -> Lịch sử các lượt thử đồ đã lưu của owner         │
│    PATCH /api/try-ons/:id            -> Lưu lượt thử đồ vào tài khoản (gia hạn TTL)      │
│                                                                                          │
│ 5. AI VISION MICROSERVICE & GATEWAY (docs/api/05-ai-vision.json - An Đức Minh Trí)      │
│    GET  /health, /api/health         -> Kiểm tra trạng thái AI Microservice (FastAPI)    │
│    POST /api/ai/validate-and-matting -> Bước 1: YOLOv8-Pose + tách nền trắng #FFFFFF     │
│    POST /api/ai/try-on               -> Bước 2: Phối đồ nhiều lớp + Cache + Lưu lịch sử  │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

# PHẦN 2. KẾ HOẠCH PHÂN CÔNG TOÀN DIỆN (API JSON + WEB + AI) CHO 5 THÀNH VIÊN

Dự án chia đều cho **5 thành viên (20% khối lượng / người)**. Mỗi thành viên phụ trách trọn vẹn **cả 2 lớp công việc** trong phân hệ của mình:
- **Lớp A (Chuẩn SOA & API JSON):** Viết đặc tả OpenAPI 3.0 `.json` tại `docs/api/`, sở hữu 1 file router độc lập tại `backend/src/routes/`, viết automated test.
- **Lớp B (Web / Hệ thống / AI Chuyên sâu):** Hoàn thiện giao diện, trải nghiệm người dùng, nhận diện hình ảnh lúc chụp và mô hình AI thực tế.

### 2.1. Cấu trúc sở hữu đặc tả JSON (`docs/api/`), Router SOA và Phân hệ

| Thành viên | File đặc tả JSON & Router SOA | Phân hệ Web / Hệ thống / AI phụ trách | Tỷ trọng |
| :--- | :--- | :--- | :---: |
| **Doãn Duy Lợi** | `docs/api/common-schemas.json`<br>`docs/api/01-identity-profile.json`<br>`backend/src/routes/identity.routes.mjs` | **API Gateway, SQLite Store, Auth/Session & Privacy Engine:** Cookie HttpOnly, CSRF Origin, Rate-limit, Merge Session, TTL 24h Sweep, endpoint `/api/openapi.json` | **20%** |
| **Nguyễn Xuân Tường** | `docs/api/02-catalog-cart.json`<br>`backend/src/routes/catalog-cart.routes.mjs` | **Web Shop UI, Cart & Chatbot Integration:** Duy trì giao diện bán hàng, lọc/tìm kiếm thật, giỏ hàng hỗ trợ thêm cả set, nút *"Thử ngay"* & *"Phối cả set này"* | **20%** |
| **Hoàng Lâm Tùng** | `docs/api/03-stylist-chat.json`<br>`backend/src/routes/stylist.routes.mjs` | **AI Stylist, Layering & Dataset 24 Sản phẩm:** Thuật toán xếp layer & giải quyết xung đột slot (`/api/stylist/validate-outfit`), LLM + fallback rules, chuẩn hóa 24 ảnh/caption cho Trí train LoRA | **20%** |
| **Nguyễn Phúc Thành** | `docs/api/04-media-tryon-jobs.json`<br>`backend/src/routes/media-jobs.routes.mjs` | **Phòng phối đồ AI, Camera Guidance & Lịch sử:** Layout 3 cột, Camera Silhouette + kiểm tra ánh sáng/tỉ lệ realtime + đếm ngược chụp 3s/5s, Before/After `clip-path`, nối API Lưu & Lịch sử thật | **20%** |
| **An Đức Minh Trí** | `docs/api/05-ai-vision.json`<br>`backend/src/routes/ai-vision.routes.mjs` | **AI Vision Microservice (FastAPI) & Train LoRA:** YOLOv8-Pose kiểm tra 17 keypoints toàn thân + BiRefNet/Rembg tách nền `#FFFFFF`, CatVTON/Diffusers + LoRA thật (`scripts/train/train_lora.py`), Cache hash, đo Loss/SSIM/CLIP | **20%** |

---

### 2.2. Chi tiết đầu việc từng thành viên (API + Web/AI)

#### 1. Doãn Duy Lợi — Identity, Session, Profile & API Gateway
* **L1 (API JSON & Router):** Hoàn thiện `docs/api/common-schemas.json`, `docs/api/01-identity-profile.json`, `backend/src/routes/identity.routes.mjs` và endpoint gộp spec `GET /api/openapi.json`.
* **L2 (Bảo mật & Session):** Chuẩn hóa Cookie `HttpOnly`, kiểm tra `Origin` (`403 ORIGIN`), rate-limit auth (`429`), merge guest session vào account và RBAC Admin (`403 FORBIDDEN`).
* **L3 (Database & Privacy TTL 24h):** Đảm bảo cơ chế `sweep()` trong `backend/src/platform/store.mjs` tự động dọn session, media và jobs hết hạn sau 24 giờ.
* **L4 (Kiểm thử):** Duy trì & mở rộng bộ test Auth/Profile/RBAC/OpenAPI trong `tests/soa.test.mjs` và `tests/demo.test.mjs`.

#### 2. Nguyễn Xuân Tường — Catalog, Search, Cart API & Shop UI
* **Tu1 (API JSON & Router):** Hoàn thiện `docs/api/02-catalog-cart.json` và `backend/src/routes/catalog-cart.routes.mjs` (phân trang `page`/`limit`, lọc theo profile, kiểm tra tồn kho `stock[size]`).
* **Tu2 (Web Shop & Search):** Đấu nối tìm kiếm, lọc theo vóc dáng/tông da/giá và nút *"Thử ngay"* trên toàn bộ 24 sản phẩm.
* **Tu3 (Chat → Fitting Set & Cart):** Bổ sung nút *"Phối cả set này"* trong `Chat.jsx` để chuyển nhiều món sang phòng thử cùng lúc; đảm bảo giỏ hàng thêm từng món hoặc cả set chính xác.
* **Tu4 (Kiểm thử):** Kiểm thử responsive Shop/Cart/Account và test API sản phẩm/giỏ hàng (kể cả vượt tồn kho `422`).

#### 3. Hoàng Lâm Tùng — AI Stylist, Layering API & Dataset 24 Sản phẩm
* **T1 (API JSON & Router):** Hoàn thiện `docs/api/03-stylist-chat.json` và `backend/src/routes/stylist.routes.mjs` (bao gồm `GET /api/conversations/:id`, `POST /api/chat`, `POST /api/stylist/validate-outfit`).
* **T2 (Concurrency & Fallback):** Kiểm soát khóa `chatBusy` (`409`), `SESSION_CHANGED` (`409`), rate-limit (`20 req/phút`), fallback mượt giữa `llm.mjs` và `rules.mjs`, chống hallucination `productId`.
* **T3 (Thuật toán Layering & Dataset):** Chuẩn hóa quy tắc xung đột slot (Đầm thay Top+Bottom; chọn món cùng slot tự ghi đè) và thứ tự lớp (`bottom` → `top layer 1` → `dress` → `outer layer 2`); chuẩn bị ảnh phẳng & caption 24 món cho Trí huấn luyện LoRA.
* **T4 (Kiểm thử):** Test 20 kịch bản tư vấn phong cách + unit/API test `validate-outfit` và `chat`.

#### 4. Nguyễn Phúc Thành — Media, Try-On Jobs API & Phòng Phối Đồ AI
* **Th1 (API JSON & Router):** Hoàn thiện `docs/api/04-media-tryon-jobs.json` và `backend/src/routes/media-jobs.routes.mjs` (Media upload/stream/delete theo `owner`, Async Job `202 Accepted` + polling, lịch sử & lưu lượt thử).
* **Th2 (Camera Guidance & Hẹn giờ chụp):** Nâng cấp `Fitting.jsx` với khung Silhouette Guide, kiểm tra ánh sáng/tỉ lệ khung hình trực tiếp khi bật camera, và **chế độ đếm ngược 3s / 5s** để người dùng kịp đứng toàn thân.
* **Th3 (Trải nghiệm So sánh, Lưu & Giỏ hàng):** Sửa thanh trượt Before/After dùng `clip-path` chồng khít 100%; nối nút *"Lưu kết quả"* và *"Lịch sử phối đồ"* với DB thực; sửa nút *"Thêm cả bộ vào giỏ"* thêm trọn set vào giỏ hàng kèm chọn size tự động/thủ công; nhận nhiều món từ URL `?items=...`.
* **Th4 (Kiểm thử):** Kiểm thử giao diện đa màn hình và viết API test cho `/api/media`, `/api/try-ons`, `/api/jobs/:id`.

#### 5. An Đức Minh Trí — AI Vision Microservice, Gateway Proxy & LoRA Thật
* **Tr1 (API JSON & Router):** Hoàn thiện `docs/api/05-ai-vision.json` và `backend/src/routes/ai-vision.routes.mjs` (Gateway proxy sang `AI_SERVICE_URL`, timeout 25s/35s, **cache kết quả theo hash** và lưu lịch sử try-on vào SQLite/TTL 24h).
* **Tr2 (Bước 1 — Nhận diện Khuôn mặt/Khung hình & Tách nền `#FFFFFF`):** Triển khai `YOLOv8-Pose` + nhận diện khuôn mặt hỗ trợ linh hoạt **Toàn thân (`full_body`) / Nửa người (`half_body`) / Cận mặt & vai (`portrait_upper`)** (bắt buộc đúng 1 người, thấy rõ khuôn mặt, đủ sáng/nét) + `BiRefNet`/`Rembg` tách nền trắng thuần `#FFFFFF` căn khung thông minh không cắt đầu/chân (`ImageOps.pad`).
* **Tr3 (Bước 2 — Train LoRA thật & Virtual Try-On Thích ứng):** Dùng script huấn luyện Diffusers + PEFT LoRA thật tại `scripts/train/train_lora.py` trên GPU với dataset 24 sản phẩm; tích hợp inference Diffusers/CatVTON + LoRA (kèm fallback Pose/Face-Guided tự căn cổ & vai theo khuôn mặt cho ảnh nửa người/cận vai) tại `ai-service/app.py`.
* **Tr4 (Kiểm thử & Học thuật):** Đo Loss Curve thật, SSIM/CLIP Score trên bộ ảnh kiểm thử và viết API test cho `/api/ai/validate-and-matting`, `/api/ai/try-on` (cache hit + error handling).

---

### 2.3. Quy chuẩn chung (API Governance) và Đầu việc nhóm

1. **Contract-First với JSON:** Mọi endpoint đều phải được khai báo trong `docs/api/*.json` với đầy đủ `parameters`, `requestBody`, `responses` (`2xx`, `4xx`, `5xx`) và ví dụ JSON thực tế.
2. **Định dạng lỗi thống nhất (khớp 100% giữa Code, Test và JSON Spec):**
   ```json
   {
     "code": "INVALID_PROFILE",
     "message": "Chiều cao phải nằm trong khoảng 145–190.",
     "requestId": "uuid"
   }
   ```
3. **Quy ước mã HTTP chuẩn:** `200` (OK), `201` (Created), `202` (Accepted - Async Job), `400` (Bad Request / AI Validation), `401` (Unauthorized), `403` (Forbidden / Origin), `404` (Not Found), `409` (Conflict), `413` (Body Limit), `415` (Content-Type), `422` (Validation Error), `429` (Rate Limit), `500` (Internal Error).
4. **Đầu việc chung của cả 5 thành viên:**
   * **G01:** Thống nhất `docs/api/common-schemas.json` và kiểm tra `/api/openapi.json` trên Swagger Editor / Postman.
   * **G02:** Ghép luồng xuyên suốt: Shop → Chatbot (*"Phối cả set này"*) → Camera Countdown → Bước 1 (Pose + Nền trắng) → Bước 2 (Try-On + Cache + Lưu lịch sử) → Thêm cả bộ vào giỏ.
   * **G03:** Chạy `npm.cmd test` và `npm.cmd run build` xanh toàn bộ trước khi chốt báo cáo & thuyết trình.

---

### 2.4. Tổng hợp phân bổ khối lượng (Cân bằng 20% / thành viên)

| Thành viên | File đặc tả JSON & Router | Nhiệm vụ Web / Hệ thống / AI | Tỷ trọng |
| :--- | :--- | :--- | :---: |
| **Doãn Duy Lợi** | `01-identity-profile.json` + `common-schemas.json` + `identity.routes.mjs` | Gateway, SQLite, Auth/Session, TTL 24h, `/api/openapi.json` | **20%** |
| **Nguyễn Xuân Tường** | `02-catalog-cart.json` + `catalog-cart.routes.mjs` | Shop UI, Search/Filter, Cart cả set, Chat → Fitting | **20%** |
| **Hoàng Lâm Tùng** | `03-stylist-chat.json` + `stylist.routes.mjs` | AI Stylist LLM/Rules, Layering, Dataset 24 sản phẩm | **20%** |
| **Nguyễn Phúc Thành** | `04-media-tryon-jobs.json` + `media-jobs.routes.mjs` | Phòng thử đồ 3 cột, Camera Guide + Countdown, Before/After, Lưu/Lịch sử | **20%** |
| **An Đức Minh Trí** | `05-ai-vision.json` + `ai-vision.routes.mjs` | YOLOv8-Pose + BiRefNet, Train LoRA thật + CatVTON/Try-On, Cache, SSIM/Loss | **20%** |
| **TỔNG** | **6 file JSON OpenAPI + 5 Router Modules** | **Full-stack SOA + Web + AI Vision Pipeline** | **100%** |

---

# PHẦN 3. TIẾN ĐỘ, KIỂM THỬ VÀ NGHIỆM THU HỌC THUẬT

### 3.1. Lộ trình 14 ngày và Ma trận bàn giao

```text
[N1-N2] Tùng (Dataset 24 sản phẩm + Caption) ──────► Trí (Nạp GPU PC test train LoRA)
        Tường (Cung cấp Layout Shop có sẵn) ───────► Thành (Thiết kế Phòng thử đồng bộ)
        Lợi (Khởi tạo DB Schema & API Gateway) ────► Cả nhóm (Dùng mock contracts)
        Trí (Thiết lập GPU PC & script train) ─────► Cả nhóm (Xác nhận hạ tầng AI)

[N3-N5] Lợi (Session, Upload API & Proxy) ─────────► Thành (Nối Camera Guide & Upload)
        Tùng (Thuật toán Layering & Gợi ý set) ────► Thành (UI chọn đồ theo vị trí)
        Trí (Hoàn thiện API Bước 1 BiRefNet) ──────► Thành (Hiển thị ảnh nền trắng #FFFFFF)

[N6-N8] Trí (Train xong LoRA, Deploy Bước 2) ──────► Lợi (Gateway Dispatcher) ──► Thành (Hiển thị kết quả thử đồ)
        Tùng (Chatbot LLM tư vấn) ─────────────────► Tường (Widget Chat Shop) ──► Thành (Chuyển set đồ thử)

[N9-N10] Lợi (Cache & Dọn ảnh tạm 24h) ───────────► Cả nhóm (Bản MVP tích hợp hoàn chỉnh)
[N11-N12] Trí (Đồ thị Loss, SSIM) + Cả nhóm ──────► Bảng nghiệm thu học thuật & Đóng băng mã nguồn
[N13-N14] Ghép tài liệu, slide báo cáo, video demo và tổng duyệt thuyết trình.
```

---

### 3.2. 10 Kịch bản kiểm thử tích hợp End-to-End (K01 – K10)

| Mã | Tên kịch bản | Thao tác thực hiện | Kết quả mong đợi | Phụ trách chính |
| :--- | :--- | :--- | :--- | :--- |
| **K01** | Kiểm tra ảnh lỗi & phân loại khung hình linh hoạt | (a) Tải ảnh quá nhỏ / panorama quá ngang / thiếu mặt; (b) Tải ảnh nửa người hoặc cận mặt & vai có rõ khuôn mặt | (a) Bước 1 chặn lại ngay với mã HTTP 400 và thông báo tiếng Việt rõ ràng; (b) Ảnh nửa người / cận vai có mặt được nhận diện đúng framing (`half_body` / `portrait_upper`), tách nền trắng `#FFFFFF` và khi thử kèm quần sẽ tự cảnh báo trong `warnings` | Trí + Thành |
| **K02** | Kiểm tra ảnh có nhiều người | Tải ảnh chụp nhóm 2 người trở lên | Báo lỗi tiếng Việt: *"Ảnh có nhiều hơn 1 người. Vui lòng chỉ chụp một mình bạn."* | Trí + Thành |
| **K03** | Tách nền ảnh đạt chuẩn | Tải ảnh toàn thân hoặc nửa người rõ nét | Nền cũ bị xóa hoàn toàn; thay bằng nền trắng thuần `#FFFFFF` chuẩn khung `768×1024`; viền tóc tự nhiên, giữ 100% gương mặt và tỉ lệ người | Trí + Thành |
| **K04** | Phối 1 món đơn lẻ có LoRA Weights | Chọn ảnh từ Bước 1 và chọn 1 áo sơ mi / áo thun của shop | Áo mới được ghép khớp cổ áo, vai áo theo dáng đứng và tọa độ khuôn mặt/keypoints; chất liệu và màu sắc hiển thị sắc nét | Trí + Thành |
| **K05** | Phối cả bộ đa tầng (Áo trong + Quần/Váy + Blazer khoác ngoài) | Chọn đồng thời Áo sơ mi (`top`), Quần ống suông (`bottom`) và Blazer (`outer`) | Cả 3 món xuất hiện đồng bộ trên người theo đúng thứ tự lớp (`bottom` → `top` → `outer`); ánh sáng tổng thể đồng nhất | Trí + Thành + Tùng |
| **K06** | Xử lý trùng slot & xung đột Đầm vs Áo/Quần | (a) Chọn Quần jeans rồi bấm chọn Quần tây; (b) Đang chọn Đầm rồi bấm chọn Áo hoặc Quần | (a) Tự động thay Quần jeans bằng Quần tây và báo *"Đã đổi sang Quần tây Noir cho phần thân dưới"*; (b) Tự động gỡ Đầm và báo *"Đã bỏ Đầm ... để phối cùng ..."* | Tùng + Thành |
| **K07** | Phối nhiều lớp (Layering) | Chọn 1 Áo thun trắng (`layer_level: 1`) và 1 Áo blazer (`layer_level: 2`) | Hệ thống sắp xếp đúng thứ tự: Áo thun mặc bên trong, Blazer khoác bên ngoài tự nhiên, không bị lộn lớp | Trí + Tùng |
| **K08** | Khôi phục lượt thử đã lưu & So sánh Before/After | Lưu kết quả thử đồ, mở từ Lịch sử hoặc trang Tài khoản (`?look=<jobId>`) và kéo thanh trượt So sánh | Nạp lại đúng ảnh kết quả cùng toàn bộ các món trong set; thanh trượt Before/After (`clip-path`) chồng khít 100% với ảnh nền trắng Bước 1 | Thành + Tường |
| **K09** | Tư vấn từ Chatbot → Chuyển sang thử cả set | Hỏi Chatbot: *"Phối set đi làm dưới 1,2 triệu"*, bấm *"Phối cả set này"* | Điều hướng sang `/fitting-room?items=...`; gọi `/api/stylist/validate-outfit` tự động nạp sẵn Áo và Quần vào các slot tương ứng | Tùng + Tường + Thành |
| **K10** | Kiểm tra Cache Hash & Bảo mật TTL 24h | Thử lại đúng set đồ và khung hình đã thử trước đó; kiểm tra cơ chế `store.sweep()` sau 24 giờ | Lần thử lại trả kết quả tức thì từ Cache (`cached: true`, `< 0.1s`); sau 24h dữ liệu ảnh tạm của phiên khách tự động bị xóa khỏi SQLite | Lợi + Trí |

---

### 3.3. Hồ sơ học thuật phục vụ báo cáo

Để chứng minh năng lực kỹ thuật và đạt điểm tối đa từ hội đồng phản biện môn học SOA:
1. **Đồ thị Hội tụ Hàm mất mát (Training Loss Curve)**: Biểu đồ thể hiện Loss giảm dần và ổn định qua các Epochs khi huấn luyện LoRA trên GPU của Trí.
2. **Bảng Đối sánh Định lượng (Quantitative Evaluation Table)**:
   * **SSIM (Structural Similarity)**: Đo độ bảo toàn cấu trúc cơ thể người và họa tiết áo.
   * **CLIP Score**: Đo mức độ khớp giữa văn bản mô tả sản phẩm và ảnh kết quả sau khi sinh.
3. **Sơ đồ Kiến trúc Hướng Dịch vụ (SOA Architecture Diagram)**: Trình bày sự độc lập, tách rời (loose coupling) giữa Web Gateway, Stylist Microservice và AI Microservice.

---

### 3.4. Phân chia thuyết trình và kịch bản demo

* **Nguyễn Xuân Tường (Nhóm trưởng)**: Mở đầu báo cáo, giới thiệu bài toán thương mại điện tử thời trang, kiến trúc tổng quan hệ thống và demo giao diện Cửa hàng, Giỏ hàng.
* **Nguyễn Phúc Thành**: Thuyết trình chi tiết thiết kế Phòng phối đồ AI, giải thích cơ chế Camera Silhouette Guide và demo tương tác thử đồ đa món Before/After.
* **Hoàng Lâm Tùng**: Thuyết trình về AI Stylist, thuật toán giải quyết xung đột slot, cơ chế sắp xếp thứ tự phân tầng layer và quy trình chuẩn bị dataset 24 sản phẩm.
* **An Đức Minh Trí**: Thuyết trình chuyên sâu về AI Vision Pipeline 2 bước: Thuật toán kiểm tra toàn thân YOLOv8, kỹ thuật tách nền BiRefNet, quy trình Huấn luyện LoRA trên GPU PC và phân tích các chỉ số học thuật (Loss, SSIM).
* **Doãn Duy Lợi**: Thuyết trình về Kiến trúc Backend Gateway SOA, cơ chế bảo mật xóa ảnh sau 24h (TTL 24h), quản lý phiên khách, hệ thống Caching và tổng kết dự án.

---
*(Bản thiết kế cơ bản đã hoàn thiện đầy đủ khung kiến trúc, lược đồ database, hợp đồng API và thông số kỹ thuật để từng thành viên tự tay thiết kế và lập trình mã nguồn).*
