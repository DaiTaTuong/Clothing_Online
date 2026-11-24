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
* **Cột 1: Tủ đồ & Bộ chọn Slot (Slot Selector Panel)**:
  * Hiển thị các ô slot trực quan: `Top` (Áo thun/sơ mi), `Bottom` (Quần/Váy), `Outer` (Áo khoác), `Shoes` (Giày), `Accessory` (Phụ kiện).
  * Danh sách đồ lấy từ catalog, người dùng nhấp chọn để gán vào slot; nếu chọn trùng nhóm slot (vd: 2 quần) sẽ tự động ghi đè và báo hiệu nhẹ.
* **Cột 2: Khung hình Trung tâm & Trình diễn (Canvas Stage)**:
  * Tích hợp **Camera Silhouette Guide**: Khi bật webcam/camera điện thoại, hiển thị khung viền mờ dáng người đứng thẳng giúp người dùng căn trọn vẹn từ đỉnh đầu đến gót chân.
  * Hiển thị thanh tiến trình 2 bước: `[1] Đang tách nền trắng...` → `[2] Đang uốn nếp phối đồ...`.
  * Bộ công cụ so sánh **Before / After** (dạng thanh trượt kéo ngang hoặc chuyển đổi tab xem ảnh gốc vs ảnh đã thử đồ).
* **Cột 3: Bảng điều khiển & Hành động (Action Panel)**:
  * Nút tải ảnh lên từ máy tính hoặc chụp từ camera.
  * Danh sách tóm tắt các món đồ đang mặc thử kèm giá và bảng chọn size.
  * Nút bấm: *"Bắt đầu phối đồ AI"*, *"Thêm cả set này vào giỏ hàng"*, *"Tải ảnh kết quả"*.

#### 2. Máy trạng thái giao diện (State Machine Diagram)
```text
[Khởi tạo: Chưa có ảnh]
         │ (Bấm "Tải ảnh" hoặc "Bật Camera")
         ▼
[Chụp/Chọn ảnh] ──► [Kiểm tra kích thước Client-side]
                            │
                            ▼ (Ảnh hợp lệ)
                 [Gửi sang Backend: Bước 1]
                            │
            ┌───────────────┴───────────────┐
            ▼ (Thành công)                  ▼ (Lỗi: Thiếu chân/đầu/mờ)
   [Hiển thị ảnh nền trắng]        [Hiển thị Toast lỗi tiếng Việt]
            │                              └──► (Yêu cầu chụp lại)
            ▼ (Chọn đồ & Bấm "Thử đồ")
   [Gửi sang Backend: Bước 2]
            │
            ▼ (Hoàn tất)
   [Hiển thị kết quả Before/After] ──► [Thêm vào giỏ / Tải về]
```

---

### 1.3. Thiết kế Cơ bản: Backend Gateway, Database & Quản lý Phiên (Doãn Duy Lợi)

Thành viên **Doãn Duy Lợi** tự tay thiết kế kiến trúc Backend Gateway tại `backend/src/`.

#### 1. Lược đồ Cơ sở Dữ liệu Quan hệ (Relational DB Schema)
```sql
-- 1. Bảng Người dùng & Phiên
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    is_guest BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- 2. Bảng Danh mục Sản phẩm Thời trang
CREATE TABLE products (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,     -- 'tops', 'bottoms', 'outerwear', 'shoes'
    slot VARCHAR(50) NOT NULL,         -- 'top', 'bottom', 'outer', 'shoes'
    layer_level INT DEFAULT 1,         -- 1: Trong (T-shirt), 2: Ngoài (Blazer)
    price DECIMAL(12, 2) NOT NULL,
    sizes JSON,                        -- ["S", "M", "L", "XL"]
    image_flat_url TEXT NOT NULL,      -- Ảnh chụp phẳng để thử AI
    image_model_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Bảng Tác vụ Thử đồ & Quản lý Ảnh (TTL 24h)
CREATE TABLE tryon_jobs (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(64) REFERENCES sessions(id) ON DELETE CASCADE,
    original_image_path TEXT NOT NULL,
    matted_image_path TEXT,            -- Kết quả Bước 1 (nền trắng #FFFFFF)
    result_image_path TEXT,            -- Kết quả Bước 2
    selected_product_ids JSON NOT NULL,-- ["prod_01", "prod_02"]
    status VARCHAR(20) DEFAULT 'queued',-- 'queued','matting','fitting','completed','failed'
    error_message TEXT,
    cache_hash VARCHAR(64),            -- Hash kiểm tra trùng kết quả
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ttl_expires_at TIMESTAMP NOT NULL  -- Mặc định created_at + 24 hours
);

-- 4. Bảng Giỏ hàng
CREATE TABLE cart_items (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(64) REFERENCES sessions(id) ON DELETE CASCADE,
    product_id VARCHAR(36) REFERENCES products(id),
    size VARCHAR(10) NOT NULL,
    quantity INT DEFAULT 1,
    outfit_group_id VARCHAR(36)        -- Đánh dấu các món thuộc cùng 1 set phối
);
```

#### 2. Cơ chế Bảo mật Dữ liệu & Tự động Xóa ảnh sau 24h (Privacy Engine)
* Mọi ảnh người dùng tải lên được gán `ttl_expires_at = NOW() + INTERVAL '24 HOURS'`.
* Thiết lập một Cron Job (chạy mỗi 30 phút một lần):
  ```javascript
  // Pseudocode Cron Job xóa ảnh
  const expiredJobs = await db.query("SELECT * FROM tryon_jobs WHERE ttl_expires_at < NOW()");
  for (const job of expiredJobs) {
      fs.unlinkSync(job.original_image_path);
      if (job.matted_image_path) fs.unlinkSync(job.matted_image_path);
      if (job.result_image_path) fs.unlinkSync(job.result_image_path);
  }
  await db.query("DELETE FROM tryon_jobs WHERE ttl_expires_at < NOW()");
  ```

#### 3. Reverse Proxy & Hàng đợi Điều phối sang PC của Trí
* Gateway đóng vai trò điều phối tác vụ (Task Dispatcher).
* Khi nhận request tạo job, Gateway tính toán `cache_hash = MD5(session_id + matted_img_hash + sorted_product_ids)`:
  * Nếu hash đã tồn tại trong DB và còn hạn → Trả ngay kết quả `result_image_path` trong 0.2s.
  * Nếu chưa có → Đưa vào queue và gọi sang URL của AI Microservice (`http://192.168.x.x:5001` hoặc `https://tri-pc.trycloudflare.com`).

---

### 1.4. Thiết kế Cơ bản: AI Stylist & Thuật toán Phân tầng Layering (Hoàng Lâm Tùng)

Thành viên **Hoàng Lâm Tùng** tự tay thiết kế và lập trình module Stylist tại `backend/src/modules/stylist/`.

#### 1. Chuẩn hóa Bộ Dataset 24 Sản phẩm của Shop
Tùng thu thập, chuẩn hóa ảnh và biên soạn tệp metadata `data/products_dataset.json`:
* 24 sản phẩm phân bổ đều: 6 Áo trong (`top`), 4 Áo khoác ngoài (`outer`), 6 Quần/Váy (`bottom`), 4 Giày (`shoes`), 4 Phụ kiện.
* Mỗi sản phẩm có đầy đủ: Ảnh phẳng nền trong suốt/trắng, ảnh người mẫu mặc tham chiếu, mặt nạ nhị phân vùng áo (mask), và một đoạn mô tả chi tiết (dense prompt) để bạn Trí dùng train LoRA.

#### 2. Thuật toán Tiền xử lý Set đồ & Sắp xếp Thứ tự Layer (Layering Algorithm)
Khi người dùng bấm chọn nhiều món hoặc nhận gợi ý từ Stylist, thuật toán chuẩn hóa danh sách sản phẩm trước khi gửi sang AI Try-On:
```javascript
// Pseudocode Thuật toán Chuẩn hóa Set đồ
function validateAndOrderOutfit(selectedProducts) {
    const slots = {};
    const messages = [];

    // 1. Giải quyết xung đột slot (Món chọn sau ghi đè món chọn trước)
    for (const prod of selectedProducts) {
        if (slots[prod.slot]) {
            messages.push(`Đã thay thế ${slots[prod.slot].name} bằng ${prod.name}`);
        }
        slots[prod.slot] = prod;
    }

    // 2. Sắp xếp thứ tự mặc lớp (Layering Order)
    // Quy tắc: Top (Layer 1) -> Bottom -> Outer (Layer 2) -> Shoes
    const orderedList = Object.values(slots).sort((a, b) => {
        return a.layer_level - b.layer_level;
    });

    return { orderedProducts: orderedList, notifications: messages };
}
```

#### 3. Thiết kế Prompt AI Stylist Chatbot
Hệ thống sử dụng Gemini API hoặc OpenAI API với System Prompt chuyên gia thời trang:
* *Vai trò*: Chuyên gia định hình phong cách cá nhân cho shop thời trang.
* *Nhiệm vụ*: Đọc hồ sơ người dùng (chiều cao, cân nặng, tông da, dịp mặc), tìm kiếm trong 24 sản phẩm của shop và trả về lời tư vấn ngắn gọn kèm danh sách `product_ids` phù hợp.

---

### 1.5. Thiết kế Cơ bản: AI Vision Pipeline 2 Bước & Huấn luyện LoRA (An Đức Minh Trí)

Thành viên **An Đức Minh Trí** tự tay thiết kế cấu trúc AI Microservice tại `ai-service/` và triển khai trên GPU PC của mình.

#### 1. Quy trình Huấn luyện LoRA Offline (`scripts/train/train_lora.py`)
* **Mô hình Base**: CatVTON hoặc Stable Diffusion Inpainting (`runwayml/stable-diffusion-inpainting`).
* **Kỹ thuật**: Gắn LoRA adapters vào các tầng Cross-Attention của U-Net với tham số:
  * Rank $r = 16$, LoRA Alpha $\alpha = 32$, LoRA Dropout $= 0.05$.
  * Optimizer: `AdamW8bit`, Learning Rate: $1\times 10^{-4}$.
  * Batch size: 2, Số epochs: 50–80.
* **Tập dữ liệu**: 24 sản phẩm từ bạn Tùng (ảnh áo + ảnh mẫu mặc tương ứng).
* **Kết quả đầu ra**: Tệp `fashion_lora.safetensors` (~120MB) ghi nhận đặc trưng chuẩn xác của các sản phẩm shop.
* **Trích xuất số liệu học thuật**: Trí xuất log Loss theo từng Epoch và tính điểm SSIM để làm báo cáo khoa học.

#### 2. BƯỚC 1: Kiểm tra Toàn thân & Tách nền trắng (`/api/ai/validate-and-matting`)
* **Kiểm tra tiêu chuẩn**:
  * Chạy **YOLOv8-Pose**: Trích xuất 17 keypoints.
  * *Toàn thân*: Keypoints mũi/mắt/tai và mắt cá/bàn chân có $y$ nằm trong phạm vi $[0.05 \times H, 0.95 \times H]$.
  * *Số lượng người*: Đếm bounding boxes có class `person`, yêu cầu $= 1$.
  * *Độ nét*: $\text{Var}(\text{Laplacian}(I)) \ge 100$.
  * *Nếu vi phạm*: Trả mã HTTP 400 kèm thông báo tiếng Việt cụ thể (VD: *"Ảnh chưa thấy rõ bàn chân, vui lòng lùi ra xa và chụp lại toàn thân"*).
* **Tách nền chuyên dụng**:
  * Đưa ảnh hợp lệ qua **BiRefNet** hoặc **RMBG-1.4**.
  * Bóc tách nền cảnh cũ, giữ lại từng sợi tóc mảnh tự nhiên.
  * Phủ màu nền mới là trắng thuần `#FFFFFF`. Kích thước và tỉ lệ ảnh gốc được giữ nguyên 100%.

#### 3. BƯỚC 2: AI Virtual Try-On với Trọng số LoRA (`/api/ai/try-on`)
* **Đầu vào**: Ảnh người mẫu nền trắng từ Bước 1 + Danh sách ảnh sản phẩm đã sắp xếp theo layer từ Tùng.
* **Xử lý ghép đồ**:
  * Phân tích pose người mẫu: hướng thân, độ nghiêng vai, góc gập cùi chỏ và đầu gối.
  * Nạp Base Model gắn adapter `fashion_lora.safetensors`.
  * Co nếp vải ôm theo chuyển động cơ thể; đồng nhất ánh sáng và bóng đổ giữa áo và cơ thể người.
  * Ghép theo thứ tự lớp: Áo trong trước (`layer 1`) → Áo khoác ngoài sau (`layer 2`).
  * Giữ nguyên 100% khuôn mặt, màu da, kiểu tóc, dáng người và nền trắng `#FFFFFF`. Không sinh dị tật bàn tay hay ngón tay thừa.

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
| **K01** | Kiểm tra ảnh thiếu chân / thiếu đầu | Người dùng tải ảnh chụp chỉ thấy từ đầu đến thắt lưng | AI Bước 1 chặn lại ngay lập tức; hiển thị thông báo tiếng Việt: *"Ảnh chưa thấy rõ bàn chân, vui lòng lùi ra xa và chụp lại toàn thân"*; không gọi Bước 2 | Trí + Thành |
| **K02** | Kiểm tra ảnh có nhiều người | Tải ảnh chụp nhóm 2 người trở lên | Báo lỗi tiếng Việt: *"Ảnh có nhiều hơn 1 người, vui lòng chỉ chụp một mình bạn"* | Trí + Thành |
| **K03** | Tách nền ảnh đạt chuẩn | Tải ảnh toàn thân rõ nét trong phòng ngủ | Nền cũ bị xóa hoàn toàn; thay bằng nền trắng thuần `#FFFFFF`; viền tóc tự nhiên, không rách viền, giữ 100% gương mặt và tỉ lệ người | Trí + Thành |
| **K04** | Phối 1 món đơn lẻ có LoRA Weights | Chọn ảnh từ Bước 1 và chọn 1 áo thun độc quyền của shop | Áo mới thay thế áo cũ; cổ áo, vai áo khớp chuẩn dáng đứng; logo và họa tiết đặc trưng của shop hiện rõ ràng nhờ LoRA | Trí + Thành |
| **K05** | Phối cả bộ (Áo + Quần + Giày) | Chọn đồng thời 3 món khác slot | Cả 3 món xuất hiện đồng bộ trên người; ống quần vừa chân, giày nằm đúng bàn chân; ánh sáng tổng thể đồng nhất | Trí + Thành + Tùng |
| **K06** | Xử lý trùng slot (Chọn 2 chiếc quần) | Người dùng chọn Quần jeans, sau đó bấm chọn thêm Quần âu | Hệ thống tự động bỏ Quần jeans, áp dụng Quần âu; gửi thông báo: *"Đã đổi sang Quần âu cho phần thân dưới"* | Tùng + Thành |
| **K07** | Phối nhiều lớp (Layering) | Chọn 1 Áo thun trắng (`layer: 1`) và 1 Áo blazer (`layer: 2`) | AI dựng đúng thứ tự: Áo thun bên trong, blazer khoác bên ngoài tự nhiên, không bị lộn xộn lớp | Trí + Tùng |
| **K08** | Tư thế tay che khuất (Khoanh tay) | Người dùng chụp ảnh tư thế khoanh tay trước ngực | Áo mới được luồn phía sau cánh tay; bàn tay và cổ tay khoanh phía trước được giữ nguyên không bị che mất | Trí + Thành |
| **K09** | Tư vấn từ Chatbot → Chuyển sang thử đồ | Hỏi Chatbot: "Gợi ý set đồ đi phỏng vấn", bấm "Thử cả set này" | Điều hướng sang phòng phối đồ; tự động nạp sẵn Áo sơ mi và Quần tây vào các slot tương ứng | Tùng + Tường + Thành |
| **K10** | Kiểm tra Cache & Bảo mật ảnh | Thử lại đúng set đồ đã thử trước đó; kiểm tra sau 24 giờ | Lần thử lại lấy kết quả tức thì từ Cache (<0.5s); sau 24h ảnh gốc của phiên khách tự động bị dọn dẹp khỏi ổ cứng server | Lợi + Trí |

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
