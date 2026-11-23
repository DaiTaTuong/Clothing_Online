# TÀI LIỆU THIẾT KẾ KIẾN TRÚC CƠ BẢN VÀ KẾ HOẠCH PHÂN CÔNG (SOA & AI)

**Đề tài:** Hệ thống thương mại điện tử thời trang tích hợp AI Stylist và AI Phối đồ thực tế (Virtual Try-On 2 bước)  
**Kiến trúc:** Service-Oriented Architecture (SOA) kết hợp AI Microservice tự huấn luyện (Self-hosted & Fine-tuned on Local GPU)  
**Thời gian thực hiện:** 2 tuần (14 ngày lịch) | **Quy mô nhóm:** 5 thành viên

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
  - 1.2. Thiết kế Cơ bản: Giao diện Phòng phối đồ AI & Camera Guide (Nguyễn Phúc Thành)
  - 1.3. Thiết kế Cơ bản: Backend Gateway, Database & Quản lý Phiên (Doãn Duy Lợi)
  - 1.4. Thiết kế Cơ bản: AI Stylist & Thuật toán Phân tầng Layering (Hoàng Lâm Tùng)
  - 1.5. Thiết kế Cơ bản: AI Vision Pipeline 2 Bước & Huấn luyện LoRA (An Đức Minh Trí)
  - 1.6. Chuẩn hóa Hợp đồng API Dùng chung (REST API Specifications)
- **PHẦN 2. KẾ HOẠCH PHÂN CÔNG VÀ DANH MỤC CÔNG VIỆC (TASK BREAKDOWN)**
  - 2.1. Phân định vai trò và phạm vi mã nguồn
  - 2.2. Chi tiết 30 đầu việc chuyên môn (T01 – T30)
  - 2.3. Đầu việc chung (G01 – G04) và Quỹ dự phòng (R01)
  - 2.4. Tổng hợp ngân sách thời gian (Cân bằng 48h / người)
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

### 1.6. Chuẩn hóa Hợp đồng API Dùng chung (REST API Specifications)

```text
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                             DANH MỤC API DÙNG CHUNG CỦA HỆ THỐNG                     │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ 1. API CỬA HÀNG & PHIÊN (Do Doãn Duy Lợi phụ trách)                                  │
│    GET  /api/session                 -> Lấy thông tin phiên khách / user             │
│    GET  /api/products                -> Lấy danh sách 24 sản phẩm (có lọc theo slot) │
│    POST /api/cart/items              -> Thêm sản phẩm hoặc nguyên set phối vào giỏ   │
│                                                                                      │
│ 2. API STYLIST & LOGIC TRANG PHỤC (Do Hoàng Lâm Tùng phụ trách)                      │
│    POST /api/stylist/chat            -> Nhận tin nhắn, trả lời tư vấn & thẻ sản phẩm │
│    POST /api/stylist/validate-outfit -> Nhận mảng sản phẩm, trả mảng đã xếp layer    │
│                                                                                      │
│ 3. API AI VISION TRY-ON (Do An Đức Minh Trí phụ trách - Chạy trên PC Trí)            │
│    POST /api/ai/validate-and-matting -> Bước 1: Validate dáng + Tách nền trắng #FFF  │
│    POST /api/ai/try-on               -> Bước 2: Ghép đồ bằng LoRA đã train           │
│                                                                                      │
│ 4. API ĐIỀU PHỐI TÁC VỤ THỬ ĐỒ (Do Doãn Duy Lợi kết nối Frontend <-> AI Trí)         │
│    POST /api/fitting/create-job      -> Nhận ảnh, kiểm tra cache, gọi AI Trí         │
│    GET  /api/fitting/jobs/:id        -> Polling trạng thái tiến trình 2 bước         │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

# PHẦN 2. KẾ HOẠCH PHÂN CÔNG VÀ DANH MỤC CÔNG VIỆC (TASK BREAKDOWN)

Mỗi thành viên đảm nhiệm đúng **40 giờ chuyên môn + 4 giờ việc chung + 4 giờ dự phòng = 48 giờ** (Tổng 240 giờ toàn dự án, chia đều 20% mỗi người).

### 2.1. Phân định vai trò và quyền sở hữu mã nguồn

| Thành viên | Phân hệ đảm nhiệm | Thư mục sở hữu mã nguồn | Trách nhiệm chính |
| :--- | :--- | :--- | :--- |
| **Nguyễn Xuân Tường** | Frontend: Duy trì Shop UI & Đấu nối Chatbot | `frontend/src/features/shop/`, `features/chat/`, `components/ui/` | **Giữ nguyên giao diện Cửa hàng có sẵn**; kết nối API sản phẩm thật; tích hợp widget Chatbot; điều hướng sang phòng thử |
| **Nguyễn Phúc Thành** | Frontend: Phòng phối đồ AI & Camera Guide | `frontend/src/features/fitting-room/` | **Tự tay thiết kế mới từ đầu**: Layout 3 cột phòng thử; Camera guide; quản lý slot và lớp đồ; thanh trượt Before/After |
| **Doãn Duy Lợi** | Backend: Gateway, Session, DB & Bảo mật | `backend/src/platform/`, `modules/catalog/`, `modules/cart/` | **Tự tay thiết kế mới từ đầu**: DB schema, quản lý phiên; Cron job dọn ảnh 24h; Reverse proxy kết nối tới PC của Trí; Caching |
| **Hoàng Lâm Tùng** | AI Stylist, Phân tầng Layering & Dataset | `backend/src/modules/stylist/`, `data/` | **Tự tay thiết kế mới từ đầu**: Chuẩn hóa 24 sản phẩm cho Trí train LoRA; Chatbot LLM Stylist; thuật toán xếp layer và giải quyết xung đột slot |
| **An Đức Minh Trí** | AI Microservice: Train LoRA & Pipeline 2 bước | `ai-service/`, `scripts/train/` | **Tự tay thiết kế mới từ đầu**: Môi trường GPU PC; script train LoRA; API Bước 1 (YOLO + BiRefNet); API Bước 2 (Try-On LoRA); đo chỉ số SSIM |

---

### 2.2. Chi tiết 30 đầu việc chuyên môn (T01 – T30)

#### 1. Nguyễn Xuân Tường — Frontend Cửa hàng & Chatbot UI
* **T01 (6h - N1-N2)**: Rà soát và chuẩn hóa bộ Design Tokens, Component dùng chung từ UI shop sẵn có để hỗ trợ bạn Thành ghép nối phòng thử.
* **T02 (10h - N3-N5)**: Duy trì UI Shop hiện tại, thay thế dữ liệu mock bằng API danh mục 24 sản phẩm thật từ Backend Lợi; bổ sung nút *"Thử đồ"* trên từng thẻ sản phẩm.
* **T03 (8h - N6-N8)**: Tích hợp Widget Chatbot AI Stylist vào góc phải giao diện bán hàng; hiển thị thẻ sản phẩm mini do bot gợi ý kèm nút *"Phối cả set này"*.
* **T04 (8h - N8-N10)**: Hoàn thiện tính năng Giỏ hàng hỗ trợ lưu nguyên set đồ đã phối từ phòng thử; quản lý đăng nhập/đăng xuất theo phiên.
* **T05 (4h - N11-N12)**: Kiểm thử responsive và luồng mua sắm tổng thể; sửa lỗi giao diện và chặn lỗi người dùng.
* **T06 (4h - N13)**: Viết tài liệu UX Cửa hàng, chụp ảnh giao diện và chuẩn bị 2-3 slide thuyết trình.

#### 2. Nguyễn Phúc Thành — Frontend Phòng phối đồ AI & Camera Guide (Tự tay thiết kế)
* **T07 (6h - N1-N2)**: Tự tay thiết kế và dựng khung Layout 3 cột của Phòng phối đồ AI (Cột 1: Tủ đồ/Slot, Cột 2: Khung hình, Cột 3: Bảng điều khiển).
* **T08 (10h - N3-N5)**: Thiết kế module Camera Guide: Vẽ khung hình người mờ (Silhouette Overlay) trên video/canvas để người dùng căn toàn thân; kiểm tra độ phân giải ảnh client-side.
* **T09 (8h - N6-N8)**: Xây dựng bộ quản lý Slot trang phục (Top, Bottom, Outer, Shoes); lập trình tính năng tự động ghi đè món khi chọn trùng vị trí; nhận danh sách món từ Chatbot sang.
* **T10 (8h - N8-N10)**: Thiết kế thanh trạng thái hiển thị tiến trình 2 bước AI; lập trình thanh trượt so sánh Before/After; hiển thị thông báo lỗi tiếng Việt nếu ảnh Bước 1 bị từ chối.
* **T11 (4h - N11-N12)**: Kiểm thử toàn diện phòng phối đồ với nhiều độ phân giải màn hình; tối ưu tốc độ render ảnh lớn.
* **T12 (4h - N13)**: Viết tài liệu thiết kế UX phòng thử đồ, vẽ sơ đồ máy trạng thái và chuẩn bị slide/video demo.

#### 3. Doãn Duy Lợi — Backend Gateway, Session, DB & Bảo mật (Tự tay thiết kế)
* **T13 (6h - N1-N2)**: Khởi tạo cấu trúc dự án Backend Express/Fastify; thiết kế và chạy Migration lược đồ CSDL (Users, Sessions, Products, TryOnJobs, Cart).
* **T14 (10h - N3-N5)**: Xây dựng cơ chế Quản lý phiên khách (Cookie HttpOnly) và **Bộ dọn dẹp ảnh tạm sau 24 giờ (TTL 24h Cron Job)** đảm bảo quyền riêng tư.
* **T15 (8h - N6-N8)**: Viết API CRUD danh mục sản phẩm và giỏ hàng; hỗ trợ lưu trữ thông tin cả bộ đồ được phối chung một nhóm.
* **T16 (8h - N8-N10)**: Thiết kế Reverse Proxy và Asynchronous Task Dispatcher kết nối tới PC của Trí (qua LAN/Tunnel); lập trình bộ nhớ đệm (Cache) theo mã hash ảnh.
* **T17 (4h - N11-N12)**: Kiểm thử hiệu năng Backend, kiểm tra việc tự động xóa ảnh sau 24h và tính an toàn của phiên khách.
* **T18 (4h - N13)**: Viết tài liệu kiến trúc Backend SOA, vẽ sơ đồ ERD, cung cấp file `.env.example` và chuẩn bị slide báo cáo.

#### 4. Hoàng Lâm Tùng — AI Stylist, Phân tầng Layering & Dataset Shop (Tự tay thiết kế)
* **T19 (6h - N1-N2)**: Thu thập và chuẩn hóa bộ Dataset 24 sản phẩm của shop (ảnh phẳng, ảnh mẫu, mask, dense caption) bàn giao cho bạn Trí train LoRA.
* **T20 (10h - N3-N5)**: Thiết kế ma trận phối màu thời trang và thuật toán gợi ý set đồ theo phong cách/dịp mặc.
* **T21 (8h - N6-N8)**: Tích hợp LLM và thiết kế System Prompt chuyên gia thời trang; xây dựng API Chatbot Stylist trả về thẻ sản phẩm thật có trong kho.
* **T22 (8h - N8-N10)**: Lập trình thuật toán kiểm tra xung đột slot và sắp xếp danh sách trang phục theo thứ tự phân tầng layer trước khi gửi sang AI thử đồ.
* **T23 (4h - N11-N12)**: Kiểm thử 20 kịch bản tư vấn phong cách; đo lường độ chính xác của chatbot và khắc phục lỗi hallucination.
* **T24 (4h - N13)**: Viết tài liệu thuật toán thời trang, prompt engineering, bảng ma trận phối màu và chuẩn bị slide báo cáo.

#### 5. An Đức Minh Trí — AI Microservice: Train LoRA & Pipeline 2 bước (Tự tay thiết kế)
* **T25 (6h - N1-N2)**: Thiết lập môi trường CUDA/PyTorch trên GPU PC; cấu hình script huấn luyện `train_lora.py`; kiểm tra chạy thử nghiệm không lỗi OOM.
* **T26 (10h - N3-N5)**: Xây dựng endpoint **Bước 1**: Kiểm tra toàn thân bằng YOLOv8-pose (đủ đầu, chân, 1 người, đủ sáng/nét) + Tách nền trắng `#FFFFFF` bằng BiRefNet; trả thông báo lỗi tiếng Việt nếu ảnh chụp sai.
* **T27 (8h - N6-N8)**: Thực hiện **huấn luyện mô hình LoRA** trên 24 sản phẩm của shop trong 50–80 epochs; ghi log hàm mất mát (Loss) và xuất tệp `fashion_lora.safetensors`.
* **T28 (8h - N8-N10)**: Xây dựng endpoint **Bước 2**: Nạp Base Model gắn LoRA weights; uốn nếp vải theo pose; phối nhiều món theo layer; xử lý pose che khuất và chống dị tật ngón tay.
* **T29 (4h - N11-N12)**: Trích xuất biểu đồ Loss Curve theo Epochs; đo đạc định lượng chỉ số SSIM/CLIP-Score; chạy benchmark trên 20+ bộ ảnh người thật.
* **T30 (4h - N13)**: Viết báo cáo kỹ thuật AI chuyên sâu, chuẩn bị slide thuyết trình và quay video demo chạy trực tiếp từ PC.

---

### 2.3. Đầu việc chung (G01 – G04) và Quỹ dự phòng (R01)

| Mã | Hạng mục | Nội dung và trách nhiệm | Giờ/người | Tổng giờ nhóm | Thời gian |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **G01** | Họp chốt thiết kế cơ bản & Chuẩn API | Cả 5 thành viên thống nhất kiến trúc, schema database, tunnel kết nối PC Trí và bộ dataset 24 món | 1 | 5 | N1–N2 |
| **G02** | Ghép luồng tích hợp hệ thống đầu tiên | Cả nhóm chạy luồng xuyên suốt: Web → Gateway → AI PC Trí (Bước 1 → Bước 2 LoRA) → Web | 1 | 5 | N7 |
| **G03** | Review chéo và Chốt phiên bản đóng băng | Đánh giá chéo chất lượng giữa các phân hệ; Lợi tổng hợp bug tracker và chốt bản Release Candidate | 1 | 5 | N11–N12 |
| **G04** | Ghép tài liệu tổng hợp và Tổng duyệt Demo | Ghép báo cáo lớn, kiểm tra slide chung, phân vai kịch bản thuyết trình và chạy thử demo trực tiếp | 1 | 5 | N14 |
| **R01** | Quỹ thời gian dự phòng cá nhân | Dành cho sự cố mạng tunnel, tinh chỉnh siêu tham số LoRA hoặc sửa lỗi phát sinh sau review | 4 | 20 | N1–N14 |
| | **Tổng công việc chung + Dự phòng** | | **8** | **40** | |

---

### 2.4. Tổng hợp ngân sách thời gian (Cân bằng 48h / người)

| Thành viên | Phân hệ đảm nhiệm | Xây dựng / Train | Kiểm thử / Fix | Báo cáo / Slide | Việc chung | Kế hoạch | Dự phòng | Tổng cộng | Tỷ trọng |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Nguyễn Xuân Tường** | Frontend Shop UI & Chat Widget | 32 | 4 | 4 | 4 | **44** | 4 | **48 giờ** | **20%** |
| **Nguyễn Phúc Thành** | Frontend Phòng phối đồ & Camera | 32 | 4 | 4 | 4 | **44** | 4 | **48 giờ** | **20%** |
| **Doãn Duy Lợi** | Backend Gateway, Session & Data | 32 | 4 | 4 | 4 | **44** | 4 | **48 giờ** | **20%** |
| **Hoàng Lâm Tùng** | AI Stylist, Layering & Dataset | 32 | 4 | 4 | 4 | **44** | 4 | **48 giờ** | **20%** |
| **An Đức Minh Trí** | AI Microservice, Train LoRA & Try-On | 32 | 4 | 4 | 4 | **44** | 4 | **48 giờ** | **20%** |
| **TỔNG TOÀN DỰ ÁN** | **Toàn bộ hệ thống SOA & AI** | **160** | **20** | **20** | **20** | **220** | **20** | **240 giờ** | **100%** |

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
