# Tài liệu Đặc tả Giao diện & Kiến trúc Hệ thống

---

## I. Giao diện Thử đồ (Virtual Fitting Room)

### 1. Thứ tự Pipeline AI chuẩn (Chống lệch khớp & lệch màu da)

Bạn không nên cắt dán khuôn mặt bằng code 2D thông thường (dễ bị giả và lộ viền cổ), mà hãy dùng **AI Face Swap** (Hoán đổi khuôn mặt) kết hợp với **AI Virtual Try-On** theo trình tự 2 giai đoạn:

#### Giai đoạn 1: Tạo "Phôi người mẫu cá nhân hóa" (Mặt thật + Dáng 2D)
* **Bước 1:** Người dùng chỉnh số đo (chiều cao, cân nặng, 3 vòng, màu da) trên Model 2D (SVG/Canvas) $\rightarrow$ xuất ra `body_2d.png` (tỷ lệ `768x1024`, nền xám nhạt `#F3F4F6`).
* **Bước 2 (Nếu user tải ảnh khuôn mặt lên):** Backend gửi `body_2d.png` (ảnh đích) và `user_face.jpg` (ảnh mặt user) qua API Face Swap (như `fal-ai/face-swap` hoặc `inswapper` trên Replicate).
* **Tại sao dùng Face Swap?** AI Face Swap sẽ tự động căn chỉnh góc mặt, tỷ lệ đầu-cổ và tự đồng bộ màu da khuôn mặt với màu da của thân hình Model 2D mà user đã chọn, giúp phần cổ nối liền mạch tự nhiên như người thật.
* **Lưu cache:** Lưu kết quả này làm `base_avatar.png` của user. Chừng nào user chưa đổi số đo hay đổi ảnh mặt thì không cần chạy lại bước này nữa!

#### Giai đoạn 2: Mặc đồ bằng AI Virtual Try-On
* Mỗi lần user bấm chọn một món đồ (áo/quần) ở cột bên phải, Backend chỉ cần lấy `base_avatar.png` (đã có sẵn mặt user và đúng số đo) + `garment_image.png` gửi vào API **IDM-VTON** (`fal-ai/idm-vton`).
* Kết quả trả về là bức ảnh hoàn chỉnh: **Khuôn mặt user + Tỷ lệ cơ thể user + Bộ đồ có nếp gấp và độ rủ chân thực.**

---

### 2. Yêu cầu kỹ thuật đối với Model 2D để Face Swap hoạt động tốt

Các model Face Swap (như InsightFace / InSwapper) cần nhận diện được vùng khuôn mặt trên ảnh đích (`body_2d.png`) thì mới thay thế được. Vì vậy, phần đầu của Model 2D không được vẽ quá hoạt hình (chibi/anime mắt to), mà cần lưu ý 3 điểm sau:

* **Phong cách đầu/mặt của Model 2D:** Dùng khuôn mặt Mannequin bán tả thực (Semi-realistic) có đầy đủ mắt, mũi, miệng cân đối tỷ lệ người thật (tỷ lệ đầu chiếm khoảng $1/7$ đến $1/7.5$ tổng chiều cao cơ thể).
* **Tóc gọn gàng:** Nên để Model 2D mặc định kiểu tóc gọn (tóc búi cao hoặc tóc ngắn ôm sát đầu) để khi Face Swap đưa tóc và khuôn mặt thật của user vào không bị đè lên tóc vẽ sẵn của model.
* **Khóa tỷ lệ vùng đầu khi co giãn cơ thể:** Khi user kéo thanh trượt tăng/giảm cân nặng hay chiều cao trên SVG/Canvas, chỉ co giãn (scale) phần thân (torso), vai, hông và chân, giữ nguyên tỷ lệ khung đầu để mặt không bị méo khi đưa vào AI.

---

### 3. Bố cục giao diện Trang Thử Đồ (Virtual Fitting Room)

Chia màn hình thành **3 cột trực quan** (tận dụng tốt không gian màn hình desktop) kèm khung Chatbot nổi ở góc dưới phải:

* **Cột trái (25% — Bảng thông số & Cá nhân hóa):**
  * **Khu vực khuôn mặt:** Nút *"Tải ảnh chân dung của bạn"* (hiển thị ảnh preview tròn + nút xóa nếu muốn quay lại mặt mặc định).
  * **Bảng chọn màu da:** 5–6 ô màu (Palette) từ trắng sáng, trung tính đến da ngăm.
  * **Thanh trượt số đo (Sliders):** Chiều cao (`145–190 cm`), Cân nặng (`40–100 kg`), Vòng ngực, Vòng eo, Vòng hông.
  * **Nút hành động:** *"Cập nhật vóc dáng"* (chạy Giai đoạn 1 để tạo `base_avatar.png`).
* **Cột giữa (45% — Sân khấu hiển thị Model):**
  * **Khung hiển thị:** Tỷ lệ `3:4` (`aspect-ratio: 3/4`, dùng `shrink-0` để tránh vỡ khung trên màn hình nhỏ).
  * **Nút gạt chuyển đổi nhanh:** Giữa chế độ *Xem phôi 2D (Chỉnh dáng tức thì)* và *Xem kết quả AI (Đã mặc đồ)*.
  * **Hiệu ứng loading:** Kèm trạng thái từng bước (*"Đang đồng bộ khuôn mặt..."* $\rightarrow$ *"Đang ướm trang phục..."*).
* **Cột phải (30% — Tủ đồ & Gợi ý AI):**
  * **Tab lọc nhanh:** `Áo` | `Quần/Váy` | `Nguyên bộ` | `Gợi ý từ AI Stylist`.
  * **Danh sách thẻ sản phẩm:** Bấm vào món nào là mặc thử ngay món đó; có nút *"Thêm vào giỏ hàng"* ngay bên dưới nếu ưng ý.
* **Góc dưới bên phải:**
  * **Widget Chatbot AI Stylist:** Dạng bong bóng chat thu gọn/mở rộng, tự động đọc dữ liệu màu da, chiều cao, cân nặng hiện tại của user để tư vấn phối đồ và gửi kèm thẻ sản phẩm bấm mặc thử được ngay.

---

## II. Giao diện Bán hàng (E-Commerce Storefront)

### 1. Bố cục tổng thể (Wireframe & UX Flow)

Trang bán hàng được chia làm **5 khu vực chính** từ trên xuống dưới, kèm 1 Widget Chatbot nổi cố định ở góc dưới phải:

1. **Thanh điều hướng trên cùng (Top Navbar — Cao `64px`, `sticky top-0`):**
   * **Trái:** Logo thương hiệu + 2 tab chuyển đổi nhanh: `Cửa hàng (Shop)` | `Phòng thử đồ AI (Virtual Fitting Room)`.
   * **Giữa:** Thanh tìm kiếm thông minh (hỗ trợ tìm theo tên hoặc mô tả, VD: *"áo sơ mi đi làm cho da ngăm"*).
   * **Phải:**
     * **Badge Hồ sơ vóc dáng (Body Profile Pill):** Hiển thị nhanh thông số đang lưu (VD: `1m65 • 52kg • Da trung tính` kèm avatar thu nhỏ). Bấm vào sẽ mở modal sửa nhanh số đo hoặc nhảy sang phòng thử đồ.
     * **Icon Giỏ hàng:** Kèm badge đếm số lượng sản phẩm.
     * **Menu Tài khoản:** Đăng nhập / Đăng xuất / Đơn hàng của tôi.

2. **Hero Banner Cá nhân hóa (Cao `220px – 260px`):**
   * Thay vì banner quảng cáo chung chung, hiển thị lời chào theo user đang đăng nhập: *"Chào [Tên User], khám phá bộ sưu tập hợp với dáng [Đồng hồ cát / Quả lê...] và tông da của bạn"*.
   * **Nút CTA nổi bật:** *"Vào Phòng Thử Đồ 2D Ngay"* + Nút phụ *"Nhờ AI Stylist phối 1 set"*.

3. **Thanh lọc & Phân loại ngang (Filter & Sort Bar):**
   * **Danh mục (Tabs):** `Tất cả` | `Áo (Tops)` | `Quần & Váy (Bottoms)` | `Đầm liền (Dresses)` | `Set đồ AI gợi ý`.
   * **Bộ lọc nhanh (Dropdown/Pills):**
     * Lọc theo Tông da phù hợp (*Da sáng, Da trung tính, Da ngăm*).
     * Lọc theo Dịp mặc (*Đi học/Đi làm, Dạo phố, Dự tiệc*).
     * Sắp xếp theo: *AI đề xuất hàng đầu* | *Mới nhất* | *Giá tăng/giảm*.

4. **Lưới sản phẩm chính (Product Grid — 4 cột trên Desktop, 2 cột trên Tablet):**
   * Mỗi **Thẻ sản phẩm (Product Card)** được thiết kế tối ưu cho bài toán thử đồ:
     * **Khung ảnh tỷ lệ 3:4 (`aspect-[3/4]`):** Hiển thị ảnh trang phục nền sạch (`bg-gray-50`).
     * **Nhãn AI Match (Góc trên trái):** Hiển thị độ phù hợp dựa trên hồ sơ người dùng (VD: `✨ 95% Hợp dáng bạn` hoặc `Hợp da ngăm`).
     * **2 Nút hành động (Bottom Card):**
       * **Nút chính (Nổi bật):** `"👗 Thử lên Model"` $\rightarrow$ Bấm vào là chuyển ngay sang trang `/fitting-room?item_id=123` và tự động kích hoạt mặc món đồ đó lên Model 2D của user.
       * **Nút phụ (Icon/Viền):** `"+ Giỏ hàng"` $\rightarrow$ Thêm trực tiếp vào giỏ hàng (tự động chọn sẵn size `S/M/L/XL` đề xuất dựa trên chiều cao/cân nặng của user).

5. **Widget Chatbot AI Stylist (Góc dưới bên phải — `fixed bottom-6 right-6 z-50`):**
   * **Trạng thái thu gọn:** Nút tròn nổi bật kèm icon lấp lánh (Sparkles) và tooltip nhỏ: *"Cần tư vấn phối đồ theo dáng bạn?"*.
   * **Trạng thái mở rộng (Khung `380px x 520px`):**
     * Header hiển thị trạng thái đã đồng bộ hồ sơ (*"Đã kết nối hồ sơ: 1m65 - 52kg"*).
     * Các nút gợi ý câu hỏi nhanh (Quick Prompts): *"Phối đồ đi chơi cuối tuần"*, *"Màu nào tôn da mình?"*, *"Tìm quần hack chiều cao"*.
     * **Product Mini-Card ngay trong tin nhắn AI:** Khi AI đề xuất món nào, khung chat hiển thị luôn ảnh nhỏ, giá tiền và nút *"Thử ngay"* để user bấm thử mà không cần tự đi tìm lại trên trang web.

---

### 2. Bảng màu & Phong cách thiết kế (UI Design System)

Để làm nổi bật màu sắc quần áo và tông da của người dùng, giao diện bán hàng nên đi theo phong cách **Modern Minimalist (Tối giản hiện đại)** giống Zara, Uniqlo hoặc SSENSE:

| Thành phần | Mã màu (Tailwind) | Mục đích sử dụng |
| :--- | :--- | :--- |
| **Nền trang chính** | `#FFFFFF` (`bg-white`) | Tạo không gian thoáng, sạch sẽ, không làm sai lệch màu sắc trang phục. |
| **Nền thẻ ảnh / Khung phụ** | `#F8FAFC` (`bg-slate-50`) | Làm nổi bật ảnh quần áo đã tách nền hoặc nền trắng. |
| **Màu chữ chính** | `#0F172A` (`text-slate-900`) | Tiêu đề, tên sản phẩm, giá tiền rõ nét, độ tương phản cao. |
| **Màu nhấn chính (Primary CTA)** | `#111827` (`bg-gray-900`) | Nút *"Thử lên Model"*, nút *"Thanh toán"* mang lại cảm giác thời trang cao cấp. |
| **Màu nhấn AI (AI Accent)** | `#4F46E5` (`indigo-600`) | Dành riêng cho badge AI Match, khung Chatbot Stylist và nút AI Phối đồ để phân biệt tính năng thông minh. |

---

## III. Giao diện Đăng nhập (Authentication)

*(Đang cập nhật nội dung...)*