# KẾ HOẠCH TRIỂN KHAI VÀ PHÂN CÔNG NHIỆM VỤ DỰ ÁN

**Đề tài:** Hệ thống bán hàng và phối đồ cá nhân hóa có tích hợp AI  
**Thời gian thực hiện:** 2 tuần, tương đương 14 ngày lịch  
**Quy mô nhóm:** 5 thành viên

| Hạng mục | Chi tiết |
| :--- | :--- |
| **Thành viên** | Nguyễn Xuân Tường; Doãn Duy Lợi; Nguyễn Phúc Thành; Hoàng Lâm Tùng; An Đức Minh Trí |
| **Tài liệu yêu cầu** | `Tai_Lieu.md` |
| **Tài liệu mẫu phân công** | `Tasks_ML_project.md` |
| **Hiện trạng** | Đã có giao diện bán hàng demo; chưa có chatbot và AI thử đồ. Đợt triển khai này thiết kế, sinh và xây dựng lại giao diện bán hàng, phòng thử đồ, đăng nhập theo tài liệu mới. |
| **Mục tiêu bàn giao** | Một bản MVP chạy được xuyên suốt: xem hàng → được AI tư vấn → cá nhân hóa mannequin → thử đồ → thêm giỏ hàng → lưu hồ sơ/lịch sử theo phiên hoặc tài khoản. |
| **Nguyên tắc phân công** | Mỗi người sở hữu một phân hệ chính, tự kiểm thử và viết tài liệu phần mình; cùng tham gia tích hợp, review và thuyết trình. |
| **Ngân sách thời gian** | Mỗi người **44 giờ kế hoạch + 4 giờ dự phòng = 48 giờ**, tương đương **20%** tổng nguồn lực. |

**Quy ước:** N1–N14 là ngày thứ 1–14 kể từ khi bắt đầu dự án; chưa gắn ngày cụ thể. Kế hoạch giả định nhóm được dùng API AI có sẵn và thống nhất ngân sách trong N1. Chưa có thông tin về chuyên môn từng người nên phân công dưới đây dựa trên khối lượng và độ phức tạp của các phân hệ.

---

## MỤC LỤC

- **CHƯƠNG 1. TỔNG QUAN VÀ PHẠM VI TRIỂN KHAI**
  - 1.1. Mục tiêu dự án
  - 1.2. Phạm vi và giới hạn của bản MVP
  - 1.3. Tiến độ 2 tuần
- **CHƯƠNG 2. GIẢI PHÁP KỸ THUẬT VÀ HỢP ĐỒNG TÍCH HỢP**
  - 2.1. Các phân hệ và công nghệ
  - 2.2. Pipeline cá nhân hóa và thử đồ AI
  - 2.3. Chatbot, đề xuất sản phẩm và tư vấn size
  - 2.4. Session, cache và dữ liệu
  - 2.5. Hợp đồng API dùng chung
- **CHƯƠNG 3. KẾ HOẠCH TRIỂN KHAI VÀ PHÂN CÔNG**
  - 3.1. Vai trò và quyền sở hữu mã nguồn
  - 3.2. Bảng hạng mục công việc
  - 3.3. Tổng hợp khối lượng và nguyên tắc công bằng
  - 3.4. Phụ thuộc và lịch bàn giao
  - 3.5. Mốc tiến độ và tiêu chí nghiệm thu
  - 3.6. Review, kiểm thử và phối hợp
  - 3.7. Rủi ro và phương án xử lý
  - 3.8. Hồ sơ bàn giao và phân chia thuyết trình

---

## CHƯƠNG 1. TỔNG QUAN VÀ PHẠM VI TRIỂN KHAI

### 1.1. Mục tiêu dự án

Xây dựng hệ thống gồm ba giao diện chính theo `Tai_Lieu.md`:

1. **Cửa hàng:** navbar, tìm kiếm, banner cá nhân hóa, bộ lọc, lưới sản phẩm, gợi ý AI, giỏ hàng và liên kết sang phòng thử đồ.
2. **Phòng thử đồ:** bố cục ba cột, nhập số đo, chọn màu da, tải ảnh mặt tùy chọn, mannequin 2D, chọn trang phục và xem kết quả AI.
3. **Đăng nhập:** cho phép khách sử dụng chức năng cơ bản theo phiên; tài khoản dùng để lưu và khôi phục hồ sơ, hội thoại, kết quả đã chọn lưu.

Chatbot AI Stylist xuất hiện ở góc phải phía dưới trên cả cửa hàng và phòng thử đồ, dùng chung hồ sơ và lịch sử hội thoại.

### 1.2. Phạm vi và giới hạn của bản MVP

| Nhóm chức năng | Nội dung phải triển khai | Giới hạn để hoàn thành trong 2 tuần |
| :--- | :--- | :--- |
| **Giao diện mới** | Thiết kế/sinh giao diện mới, chuyển thành component chạy được, thống nhất màu sắc và trạng thái tương tác | Tái sử dụng logic hoặc tài nguyên hợp lệ của demo cũ; nghiệm thu bằng giao diện có kết nối dữ liệu, không chỉ bằng ảnh thiết kế |
| **Cửa hàng** | Navbar, hero, tìm kiếm, lọc, sắp xếp, thẻ sản phẩm, hồ sơ nhanh, thêm giỏ, chuyển trang thử đồ | Dữ liệu mẫu 24 sản phẩm: 8 áo, 8 quần/váy, 8 đầm liền; có tag tư vấn và bảng size |
| **Phòng thử đồ** | Ba cột desktop; bố cục xếp lại trên tablet/mobile; khung model 3:4; trạng thái từng bước | Có chuyển giữa phôi 2D và kết quả AI; không làm mô hình 3D hay camera thời gian thực |
| **Mannequin 2D** | Chiều cao 145–190 cm, cân nặng 40–100 kg, ngực/eo/hông, 5–6 màu da; xuất PNG 768×1024 | Chuyển số đo thành tỉ lệ minh họa; giữ cấu trúc vùng đầu ổn định, không tuyên bố chính xác cơ thể theo từng centimet |
| **Cá nhân hóa khuôn mặt** | Thử nghiệm Face Swap từ ảnh mặt tùy chọn và phôi 2D; cache phôi cá nhân hóa | Điều kiện bật chức năng là thử nghiệm đầu vào đạt yêu cầu ở N2; bỏ ảnh mặt vẫn dùng được mannequin mặc định |
| **AI thử đồ** | Tạo tác vụ từ phôi đã chọn và ảnh sản phẩm, hiển thị kết quả hoặc lỗi, tái sử dụng kết quả hợp lệ | Một món mỗi tác vụ. Kiểm chứng từng loại áo, quần/váy, đầm; chỉ bật loại API thực sự hỗ trợ. Phối set là gợi ý nhiều món, không mặc định API ghép cả set trong một lần |
| **Chatbot và đề xuất** | Hiểu nhu cầu, dùng hồ sơ, trả thẻ sản phẩm thật, nút “Thử ngay”, câu hỏi nhanh | Lọc dữ liệu + quy tắc phối đồ + LLM; danh mục nhỏ chưa cần cơ sở dữ liệu vector |
| **Đăng nhập và phiên** | Đăng ký email/mật khẩu, đăng nhập/đăng xuất, phiên khách, lưu và khôi phục hồ sơ | Phần đăng nhập trong tài liệu gốc chưa hoàn chỉnh; đây là phạm vi bổ sung để triển khai. Chưa làm đăng nhập mạng xã hội, xác thực email và quên mật khẩu |
| **Giỏ hàng** | Chọn size, thêm/xóa, cập nhật số lượng và tổng tiền | Thanh toán thực, vận chuyển, quản trị bán hàng và xử lý đơn hàng không nằm trong đợt này |

**Điểm kỹ thuật cần kiểm chứng:** Các mô tả trong tài liệu về Face Swap tự đồng bộ màu da, xử lý tóc, giữ chính xác số đo và tạo độ rủ như thật được coi là mục tiêu chất lượng, không phải khả năng đã được xác nhận. API có thể không nhận diện tốt khuôn mặt hoặc tư thế trên mannequin SVG/Canvas. Nhóm phải lưu kết quả thử nghiệm và công bố giới hạn thực tế; ảnh mặc thử là minh họa, còn tư vấn size dựa trên số đo và bảng size.

### 1.3. Tiến độ 2 tuần

- **N1–N2:** chốt giao diện, dữ liệu, hợp đồng API; thử đầu vào mannequin với Face Swap và Virtual Try-On.
- **N3–N5:** hoàn thiện nền tảng UI, mannequin, phiên/hồ sơ và bộ đề xuất; các phần dùng chung mock đúng hợp đồng.
- **N6–N8:** tích hợp chatbot, phòng thử đồ và tác vụ AI; cuối N7 có một luồng tối thiểu chạy thật, N8 hoàn thiện các nhánh còn lại.
- **N9–N10:** hoàn thiện tìm kiếm thông minh, giỏ hàng, đăng nhập, cache, lỗi và bản triển khai; cuối N10 đóng băng tính năng.
- **N11–N12:** kiểm thử, review chéo, sửa lỗi và chốt phiên bản.
- **N13–N14:** hoàn thiện tài liệu, slide, video dự phòng và tổng duyệt. Chỉ sửa lỗi cản trở demo sau khi chốt phiên bản.

---

## CHƯƠNG 2. GIẢI PHÁP KỸ THUẬT VÀ HỢP ĐỒNG TÍCH HỢP

### 2.1. Các phân hệ và công nghệ

Giữ ngôn ngữ/framework mà nhóm đang thành thạo; chốt lựa chọn trong N1. Nếu chưa có nền tảng phù hợp, có thể dùng React/TypeScript + Tailwind cho frontend, Node.js/TypeScript cho backend và PostgreSQL cho dữ liệu. Gọi dịch vụ AI qua backend, không cần huấn luyện mô hình hoặc dựng thêm backend Python chỉ để chuyển tiếp API.

Các ranh giới nghiệp vụ và thư mục dưới đây là cấu trúc đề xuất, được điều chỉnh theo repo thực tế trong N1:

```text
frontend/src/
  app/                    # Layout, router, provider và trạng thái dùng chung
  components/ui/          # Component nền tảng và design tokens
  features/shop/          # Cửa hàng, giỏ hàng, tài khoản
  features/chat/          # Widget và thẻ sản phẩm trong hội thoại
  features/fitting-room/  # Form số đo, mannequin, hiển thị tác vụ AI

backend/src/
  platform/               # Cấu hình, database, middleware, phiên và xác thực
  modules/catalog/        # Sản phẩm và giỏ hàng
  modules/profiles/       # Hồ sơ cơ thể và sở thích
  modules/stylist/        # Đề xuất, tìm kiếm thông minh, hội thoại, LLM
  modules/tryon/          # Ảnh, phôi cá nhân hóa, tác vụ và adapter AI

shared/contracts/         # Schema API, mã lỗi và fixture dùng chung
data/                     # Dữ liệu seed và metadata sản phẩm
docs/                     # Kiến trúc, kiểm thử, kết quả AI và báo cáo
deploy/                   # Cấu hình chạy và triển khai
```

Các phân hệ trao đổi qua hợp đồng API rõ ràng. Đối với bản MVP, có thể chạy chung một backend; yêu cầu tách tiến trình triển khai nếu có từ môn học cần được chốt ngay N1. Tùng và Trí tự viết route, logic và phần lưu dữ liệu của module mình; Thành cung cấp hạ tầng dùng chung và hỗ trợ tích hợp.

### 2.2. Pipeline cá nhân hóa và thử đồ AI

```text
Số đo + màu da
       ↓
Mannequin 2D → body_2d.png
       ↓
Ảnh mặt tùy chọn → Face Swap khi đủ điều kiện → base_avatar.png
       ↓
Cache theo phiên/tài khoản + phiên bản hồ sơ + ảnh mặt + cấu hình tạo phôi
       ↓
Chọn sản phẩm → Virtual Try-On(base_avatar, garment_image)
       ↓
Tác vụ hoàn thành → lưu ảnh kết quả → hiển thị → tùy chọn lưu lịch sử
```

Quy tắc triển khai:

1. N1 phải có phôi thử tối thiểu từ Lợi để Trí kiểm chứng API ở N2. Tên nhà cung cấp/endpoint trong `Tai_Lieu.md` là ứng viên; cần kiểm tra khả năng truy cập, đầu vào, giá và điều kiện sử dụng trước khi chốt.
2. Không tải ảnh mặt thì bỏ qua Face Swap và dùng phôi mặc định tương thích đã được kiểm chứng.
3. Thay đổi slider chỉ cập nhật preview 2D. Nút “Cập nhật vóc dáng” mới tạo phôi AI, tránh phát sinh phí theo từng lần kéo.
4. Sửa số đo, màu da hoặc ảnh mặt làm phôi cũ hết hiệu lực cho lần thử mới. Kết quả đến muộn phải gắn đúng phiên bản hồ sơ, không ghi đè kết quả hiện tại.
5. Tạo tác vụ bất đồng bộ; frontend truy vấn trạng thái. Khóa thao tác trùng khi đang tạo cùng một yêu cầu; backend có kiểm tra trùng để tránh tính phí lặp.
6. Khóa cache kết quả phải bao gồm chủ sở hữu, phiên bản phôi/ảnh, sản phẩm/phiên bản ảnh và cấu hình mô hình. Chỉ tái sử dụng kết quả còn hạn và còn ảnh.
7. Ảnh kết quả cần lưu về kho ảnh của ứng dụng nếu muốn giữ lâu hơn thời hạn URL của nhà cung cấp. API key chỉ lưu ở backend.
8. Nếu pipeline mannequin → Face Swap → Try-On không đạt ở N2, ghi rõ tính năng bị giảm phạm vi. Ảnh người mẫu bán tả thực hoặc ảnh toàn thân có thể dùng để chứng minh VTON như phương án dự phòng; kết quả này không được ghi là đã đạt đầy đủ yêu cầu mannequin cá nhân hóa.

### 2.3. Chatbot, đề xuất sản phẩm và tư vấn size

- **Đầu vào:** tin nhắn, hồ sơ hiện hành, trang đang mở, sản phẩm đang xem/thử, sở thích và ngân sách.
- **Xử lý:** trích xuất nhu cầu → lọc/xếp hạng sản phẩm thật → đưa danh sách phù hợp cho LLM diễn giải → backend kiểm tra ID sản phẩm → trả lời kèm thẻ sản phẩm.
- **Tìm kiếm:** dùng chung bộ lọc của Stylist cho câu tự nhiên như “áo sơ mi đi làm cho da ngăm”; tìm theo tên/từ khóa vẫn hoạt động khi LLM lỗi.
- **Dữ liệu:** Tùng chuẩn bị 24 sản phẩm cùng `category`, màu, phong cách, dịp mặc, form, size, bảng size, giá, tồn kho và ảnh dùng cho thử đồ. Thành hỗ trợ schema và nạp seed.
- **Size:** ưu tiên số đo ngực/eo/hông và bảng size theo sản phẩm; chiều cao/cân nặng là thông tin bổ trợ. Nếu thiếu dữ liệu, yêu cầu bổ sung hoặc cho người dùng tự chọn trước khi thêm giỏ.
- **Nhãn AI Match:** dùng mức “Phù hợp cao/vừa” có giải thích. Nếu hiển thị phần trăm như bản đặc tả, phải ghi là điểm quy tắc xếp hạng, không thể hiện như xác suất vừa vặn đã được kiểm định.
- **Khuôn mặt:** bản MVP không tự nhận diện hình dáng khuôn mặt; có thể dùng thông tin người dùng tự chọn để tham khảo kiểu cổ áo. Ảnh mặt trong pipeline dùng cho cá nhân hóa hình ảnh.
- **Hội thoại:** widget dùng chung conversation ID và trạng thái giữa hai trang; “Thử ngay” điều hướng đến `/fitting-room?item_id=...` và kích hoạt tác vụ khi phôi hợp lệ.

### 2.4. Session, cache và dữ liệu

| Dữ liệu | Nơi lưu và quy tắc |
| :--- | :--- |
| **Phiên khách/tài khoản** | Cookie ID phiên ngẫu nhiên; `HttpOnly`, `SameSite`, `Secure` khi dùng HTTPS; dữ liệu phiên ở backend, đổi ID khi đăng nhập |
| **Hồ sơ và giỏ hàng** | Gắn với phiên khách hoặc user; khi đăng nhập có quy tắc chuyển/gộp dữ liệu, không mất size và số lượng đã chọn |
| **Hội thoại** | Database, có chủ sở hữu và giới hạn lịch sử gửi tới LLM; tránh gửi toàn bộ hội thoại không cần thiết |
| **Danh mục** | Cache ngắn hạn, ví dụ 5–15 phút; thay dữ liệu phải làm mới cache |
| **Phôi và kết quả AI** | Kho ảnh + metadata trong database; cache theo phiên bản và chủ sở hữu; kiểm tra hạn trước khi dùng lại |
| **Ảnh cá nhân của khách** | Đề xuất xóa sau 24 giờ; có nút xóa và tác vụ dọn dữ liệu. Thông báo việc gửi ảnh sang dịch vụ AI trước khi tải lên |
| **Dữ liệu của tài khoản** | Chỉ giữ kết quả người dùng chọn lưu theo chính sách nhóm công bố; xóa ảnh nguồn phải làm mất hiệu lực cache liên quan |

Mỗi API hồ sơ, hội thoại, ảnh và tác vụ đều phải kiểm tra chủ sở hữu. Cache không thay thế cơ chế xác thực. Chỉ bổ sung Redis nếu thực sự cần hoặc nhóm đã quen; database và cơ chế cache đơn giản có thời hạn đủ cho demo.

### 2.5. Hợp đồng API dùng chung

Thành điều phối tệp hợp đồng; mỗi người phụ trách phần nghiệp vụ của mình. Chốt schema tối thiểu cuối N1, fixture và mã lỗi cuối N2.

| API | Chủ trì | Kết quả chính |
| :--- | :--- | :--- |
| `POST /api/auth/register`, `/login`, `/logout`; `GET /api/session` | Thành | Trạng thái khách/tài khoản và thông tin phiên |
| `GET /api/products`, `GET /api/products/{id}` | Thành | Sản phẩm, phân trang, lọc cơ bản, bảng size |
| `GET /api/profile`, `PUT /api/profile` | Thành | Hồ sơ chuẩn hóa đơn vị, `profileVersion` |
| `GET /api/cart`; `POST`, `PATCH`, `DELETE /api/cart/items...` | Thành | Size, số lượng, tổng giỏ được kiểm tra lại ở server |
| `GET /api/recommendations`, `POST /api/search` | Tùng | ID sản phẩm được xếp hạng, lý do và bộ lọc |
| `POST /api/chat`, `GET /api/conversations/{id}` | Tùng | Hội thoại, nội dung tư vấn và ID sản phẩm hợp lệ |
| `POST /api/media`, `DELETE /api/media/{id}` | Trí | Ảnh hợp lệ, chủ sở hữu và thời hạn lưu |
| `POST /api/avatars`, `POST /api/try-ons` | Trí | `jobId`, loại tác vụ, phiên bản hồ sơ và trạng thái ban đầu |
| `GET /api/jobs/{id}`, `GET /api/try-ons` | Trí | Trạng thái từng bước, kết quả hoặc lỗi; lịch sử đúng chủ sở hữu |

Schema chung phải thống nhất `productId`, `imageId`, `profileVersion`, đơn vị cm/kg, giá VND và thời gian ISO 8601. Tác vụ có trạng thái `queued`, `processing`, `completed`, `failed`; trạng thái giao diện chi tiết lấy từ `stage`. Lỗi dùng cấu trúc chung có `code`, `message`, `requestId`. Frontend gọi backend để lấy trạng thái, không nhận API key của nhà cung cấp.

---

## CHƯƠNG 3. KẾ HOẠCH TRIỂN KHAI VÀ PHÂN CÔNG

### 3.1. Vai trò và quyền sở hữu mã nguồn

**Bảng 3.1. Phân hệ chính của từng thành viên**

| Thành viên | Vai trò chính | Phạm vi sở hữu | Trách nhiệm tích hợp |
| :--- | :--- | :--- | :--- |
| **Nguyễn Xuân Tường** | Giao diện cửa hàng và Chatbot UI | `frontend/src/app/`, `components/ui/`, `features/shop/`, `features/chat/` | Design tokens, router, trang cửa hàng/giỏ/tài khoản, widget dùng chung; phối hợp Lợi về giao diện và Tùng về hội thoại |
| **Doãn Duy Lợi** | Giao diện phòng thử đồ và mannequin 2D | `frontend/src/features/fitting-room/` | Form số đo, export phôi, điều hướng từ cửa hàng/chatbot, hiển thị tiến trình và kết quả từ Trí |
| **Nguyễn Phúc Thành** | Backend nền tảng, dữ liệu và phiên người dùng | `backend/src/platform/`, `modules/catalog/`, `modules/profiles/`, `shared/contracts/`, `deploy/` | Database, auth/session, sản phẩm/giỏ, hợp đồng chung, cấu hình chạy; các module AI tự triển khai nghiệp vụ theo nền tảng này |
| **Hoàng Lâm Tùng** | AI Stylist, tìm kiếm và đề xuất | `backend/src/modules/stylist/`, `data/` | Dữ liệu sản phẩm, luật phối đồ, tư vấn size, LLM, lưu hội thoại; trả kết quả đúng hợp đồng cho Tường/Lợi |
| **An Đức Minh Trí** | Cá nhân hóa khuôn mặt và AI thử đồ | `backend/src/modules/tryon/` | Thử API, upload/kho ảnh, Face Swap, Try-On, tác vụ, cache và hạn lưu; bàn giao kết quả cho Lợi |

Mỗi người tự làm kiểm thử, tài liệu và slide phần mình. Review chéo và quyết định tích hợp thực hiện trong giờ chung; không giao toàn bộ sửa lỗi, viết báo cáo hoặc triển khai cho một thành viên.

### 3.2. Bảng hạng mục công việc

**Đơn vị ước lượng: giờ làm việc tập trung.** Các công việc chuyên môn dưới đây có đúng một người chịu trách nhiệm chính. Thời gian phối hợp nhóm được tính riêng ở G01–G04, không cộng lại vào giờ của người hỗ trợ. Mỗi thành viên có cùng cấu trúc: **32 giờ xây dựng + 4 giờ kiểm thử/sửa lỗi + 4 giờ tài liệu = 40 giờ chuyên môn**.

#### 3.2.1. Nguyễn Xuân Tường — Giao diện cửa hàng và Chatbot UI

| Mã | Hạng mục | Nội dung và sản phẩm bàn giao | Giờ | Thời gian | Phụ thuộc / tiêu chí nghiệm thu |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **T01** | Thiết kế/sinh giao diện và khung frontend | Bộ thiết kế cửa hàng, chat, giỏ, tài khoản; tokens màu từ đặc tả; layout, navbar, router, component nút/input/card, fixture hiển thị | 6 | N1–N2 | Thống nhất với Lợi; cuối N1 có tokens và khung để hai người làm song song; cuối N2 các route và component nền chạy được |
| **T02** | Cửa hàng mới và danh sách sản phẩm | Hero theo hồ sơ, profile pill, lưới 4/2 cột, tìm kiếm, lọc/sắp xếp, card 3:4, AI Match, CTA; nối API thật khi có | 10 | N3–N5 | T13, T19; lọc và CTA hoạt động với fixture; kết nối T15/T22 trước N10 |
| **T03** | Widget Chatbot dùng chung | Bong bóng/mở rộng, quick prompts, trạng thái gửi/lỗi, hội thoại, product mini-card, nút “Thử ngay”, giữ trạng thái khi đổi trang | 8 | N6–N8 | T21 và hợp đồng chat; N7 gửi được tin nhắn thật và mở được sản phẩm trong phòng thử; N8 xử lý đủ trạng thái |
| **T04** | Giỏ hàng, tài khoản và hoàn thiện responsive | UI đăng ký/đăng nhập/đăng xuất, giỏ hàng chọn size/số lượng, tổng tiền; nối phiên và khôi phục trạng thái; hoàn thiện desktop/tablet/mobile | 8 | N8–N10 | T14, T15; khách dùng được và đăng nhập không làm mất giỏ; widget không che thao tác chính |
| **T05** | Kiểm thử và sửa lỗi phần sở hữu | Kiểm thử lọc, cart, auth UI, chuyển trang, hội thoại, trạng thái rỗng/lỗi và responsive; lưu checklist và bằng chứng | 4 | N11–N12 | T01–T04; không còn lỗi chặn thao tác cửa hàng/chat thuộc phạm vi của Tường |
| **T06** | Báo cáo và demo phần giao diện | Viết UX/design system/luồng mua–chat; chuẩn bị 2–3 slide và đoạn demo cửa hàng–chatbot; tự đưa vào bản chung | 4 | N13 | Có ảnh giao diện cuối, mô tả thành phần và bằng chứng kiểm thử |
| | **Tổng chuyên môn của Tường** | | **40** | | |

#### 3.2.2. Doãn Duy Lợi — Phòng thử đồ và mannequin 2D

| Mã | Hạng mục | Nội dung và sản phẩm bàn giao | Giờ | Thời gian | Phụ thuộc / tiêu chí nghiệm thu |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **T07** | Thiết kế/sinh phòng thử đồ và phôi kiểm chứng | Wireframe ba cột 25/45/30, responsive; xác định đơn vị và giới hạn số đo; tạo phôi bán tả thực tối thiểu có mặt, tư thế đứng rõ | 6 | N1–N2 | Bàn giao phôi thử 768×1024 cho Trí cuối N1; N2 thống nhất thay đổi cần thiết từ thử nghiệm AI |
| **T08** | Mannequin SVG/Canvas và export PNG | Tách vùng đầu/thân/chân; ánh xạ số đo sang tỉ lệ; 5–6 màu da; đồ nền đơn giản; preview và xuất ảnh nền `#F3F4F6` | 10 | N3–N5 | T07, kết luận T25; thay số đo không kéo méo mặt; PNG đúng 768×1024 và mô tả rõ tính minh họa |
| **T09** | Giao diện ba cột và luồng tác vụ | Form/sliders, upload-preview-xóa ảnh mặt, nút cập nhật phôi, tủ đồ/tab, chuyển phôi–kết quả, tiến trình và lỗi; nối API ảnh/avatar/try-on | 8 | N6–N8 | T14, T15, T26, T27; N7 chạy được một luồng chọn áo → chờ → xem kết quả thật |
| **T10** | Đồng bộ hồ sơ và điều hướng thử đồ | Nhận `item_id` từ cửa hàng/chat; tự kích hoạt đúng một lần khi phôi hợp lệ; đồng bộ profile pill; chống kết quả cũ ghi đè, hoàn thiện responsive | 8 | N8–N10 | T03, T21, T28; đổi số đo làm phôi cũ hết hiệu lực; thêm giỏ đúng sản phẩm/size; trạng thái không lẫn giữa tác vụ |
| **T11** | Kiểm thử và sửa lỗi phòng thử đồ | Kiểm tra giới hạn số đo, màu da, PNG, upload/xóa ảnh, không có ảnh mặt, tác vụ lỗi/trễ/trùng, responsive | 4 | N11–N12 | T07–T10; lưu checklist và ảnh các trạng thái chính |
| **T12** | Báo cáo và demo mannequin/phòng thử | Viết quy tắc dựng hình, giới hạn số đo, giao diện ba cột; chuẩn bị 2–3 slide và đoạn demo chỉnh dáng–xem kết quả | 4 | N13 | Có sơ đồ export phôi và minh họa trước/sau; tự đưa nội dung vào bản chung |
| | **Tổng chuyên môn của Lợi** | | **40** | | |

#### 3.2.3. Nguyễn Phúc Thành — Backend nền tảng, phiên và dữ liệu

| Mã | Hạng mục | Nội dung và sản phẩm bàn giao | Giờ | Thời gian | Phụ thuộc / tiêu chí nghiệm thu |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **T13** | Khung backend, database và hợp đồng | Khởi tạo cấu hình/DB/middleware; schema user, session, profile, product, cart; thống nhất ID, mã lỗi và API với Tùng/Trí; khung migration cho module riêng | 6 | N1–N2 | Cuối N1 có schema API tối thiểu; N2 backend health check và fixture dùng chung chạy được |
| **T14** | Auth, phiên khách và hồ sơ | Đăng ký, hash mật khẩu, đăng nhập/đăng xuất, cookie phiên, đổi ID khi login, profileVersion, chuyển/gộp dữ liệu khách sang user | 10 | N3–N5 | T13; tải lại trang vẫn khôi phục phiên, không đọc/sửa được hồ sơ người khác; Tùng/Trí gắn dữ liệu theo cơ chế chủ sở hữu chung |
| **T15** | Sản phẩm và giỏ hàng | Nạp seed từ T19, API danh sách/chi tiết/lọc cơ bản, size/tồn kho; giỏ theo phiên/user, kiểm tra giá và số lượng ở backend | 8 | N6–N8 | T13, T19; N7 có danh mục thật và thao tác thêm giỏ; N8 hoàn thiện cập nhật/xóa/kiểm tra size |
| **T16** | Tích hợp nền tảng và triển khai | Đấu nối module stylist/tryon vào entrypoint; cấu hình môi trường, kho ảnh, giới hạn request, HTTPS/cookie theo môi trường; script chạy/seed, bản triển khai | 8 | N8–N10 | T21, T27; môi trường demo dùng được API thật; mỗi chủ module cung cấp biến môi trường và hướng dẫn phần mình |
| **T17** | Kiểm thử và sửa lỗi backend nền tảng | Kiểm tra auth, ownership, guest→user, profileVersion, giỏ hàng, khởi tạo DB và health check; lưu kết quả | 4 | N11–N12 | T13–T16; hai phiên không xem được dữ liệu riêng của nhau; khởi động lại theo hướng dẫn thành công |
| **T18** | Báo cáo kiến trúc và hướng dẫn chạy | Viết sơ đồ thành phần/ERD/auth/session; chuẩn bị 2–3 slide, hướng dẫn cấu hình và đoạn demo phiên khách→tài khoản | 4 | N13 | Có `.env.example` không chứa khóa thật, lệnh chạy/seed và mô tả quyền truy cập |
| | **Tổng chuyên môn của Thành** | | **40** | | |

#### 3.2.4. Hoàng Lâm Tùng — AI Stylist, tìm kiếm và đề xuất

| Mã | Hạng mục | Nội dung và sản phẩm bàn giao | Giờ | Thời gian | Phụ thuộc / tiêu chí nghiệm thu |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **T19** | Dữ liệu sản phẩm và bộ tình huống tư vấn | Chuẩn bị 24 sản phẩm, ảnh/metadata/bảng size và nguồn ảnh; quy tắc tông da, dịp mặc, form; schema chat/search, bộ câu hỏi mẫu | 6 | N1–N2 | Phối hợp T13; cuối N2 có seed và fixture cho frontend; chọn trước ít nhất 10 món để thử AI |
| **T20** | Bộ lọc và xếp hạng đề xuất | Lọc theo ngân sách, loại, size, tồn kho; chấm điểm theo hồ sơ/sở thích; trả ID và lý do; route và persistence trong module stylist | 10 | N3–N5 | T13, T19; đầu ra chỉ chứa sản phẩm hợp lệ, quy tắc và mức phù hợp giải thích được |
| **T21** | Chatbot LLM và lịch sử hội thoại | Trích xuất nhu cầu, hỏi thêm, gọi bộ đề xuất, diễn giải; lưu hội thoại theo phiên/user; trả product mini-card; gửi ngữ cảnh trang và sản phẩm | 8 | N6–N8 | T14, T20; N7 hội thoại thật nối được widget; N8 có kiểm tra ID, fallback lỗi và giới hạn ngữ cảnh |
| **T22** | Tìm kiếm thông minh và tư vấn size | Câu tìm kiếm tự nhiên → bộ lọc; dùng size chart + số đo; nhãn AI Match; gợi ý set gồm nhiều món; cập nhật hồ sơ mới trong hội thoại | 8 | N8–N10 | T15, T20, T21; có fallback tìm tên/từ khóa; thiếu bảng size không tự kết luận chắc chắn |
| **T23** | Đánh giá và sửa lỗi AI Stylist | Chạy 15 tình huống: ngân sách, vóc dáng, tông da, dịp mặc, thiếu thông tin, không có hàng và đổi hồ sơ; đo tính hợp lệ của ID và bộ lọc | 4 | N11–N12 | T19–T22; lưu bảng đầu vào/đầu ra/đạt-chưa đạt; sửa lỗi bịa sản phẩm hoặc vượt bộ lọc bắt buộc |
| **T24** | Báo cáo và demo AI Stylist | Viết pipeline, quy tắc xếp hạng/size, prompt và kết quả đánh giá; chuẩn bị 2–3 slide và đoạn demo tư vấn–đề xuất | 4 | N13 | Có ví dụ thành công, thất bại và giới hạn; tự đưa nội dung vào bản chung |
| | **Tổng chuyên môn của Tùng** | | **40** | | |

#### 3.2.5. An Đức Minh Trí — Face Swap và AI Virtual Try-On

| Mã | Hạng mục | Nội dung và sản phẩm bàn giao | Giờ | Thời gian | Phụ thuộc / tiêu chí nghiệm thu |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **T25** | Kiểm chứng API và chốt pipeline | Thử phôi từ T07, Face Swap, VTON và khả năng giữ mặt/tư thế; thử áo, quần/váy, đầm; ghi giá, độ trễ, điều kiện ảnh và giới hạn | 6 | N1–N2 | Cuối N2 có báo cáo POC cùng ảnh thật hoặc lỗi cụ thể; chốt provider/loại đồ hỗ trợ và phương án dự phòng, không kéo dài nghiên cứu mở |
| **T26** | Upload, kho ảnh và tạo phôi cá nhân hóa | Route upload/xóa ảnh, kiểm tra loại/dung lượng; nhận phôi PNG; adapter Face Swap tùy chọn, tạo base avatar và lưu metadata/chủ sở hữu | 10 | N3–N5 | T13, T14, T25; không ảnh mặt vẫn dùng được; dữ liệu của từng phiên tách biệt; thành công/lỗi đều có trạng thái |
| **T27** | Tác vụ Virtual Try-On và kết quả | Adapter VTON, tạo/lấy trạng thái tác vụ, lưu result image và lịch sử; tham chiếu sản phẩm hợp lệ; nối API cho phòng thử | 8 | N6–N8 | T26, fixture/ảnh T19; N7 có một cặp phôi–áo chạy xuyên suốt; N8 hoàn thiện trạng thái và loại đồ đã chốt |
| **T28** | Cache, chống trùng, thời hạn và lỗi | Cache theo chủ sở hữu/profileVersion/ảnh/cấu hình; khóa yêu cầu trùng; timeout và retry có giới hạn; xử lý URL hết hạn, xóa dữ liệu, quota API | 8 | N8–N10 | T14, T27; không chạy lại khi cache còn hợp lệ; đổi ảnh/số đo không dùng phôi cũ; không retry mù gây tính phí lặp |
| **T29** | Đánh giá và sửa lỗi pipeline ảnh | Kiểm thử ít nhất 10 cặp phôi–trang phục, có biến thể màu da/vóc dáng; ghi giữ mặt/màu/họa tiết, lỗi vùng cổ/cơ thể và thời gian | 4 | N11–N12 | T25–T28; có tập ảnh và bảng đánh giá; lỗi dữ liệu/tác vụ xử lý được; lỗi mô hình được ghi nhận riêng |
| **T30** | Báo cáo và demo pipeline AI | Viết sơ đồ hai giai đoạn, cache, giới hạn chất lượng/chi phí; chuẩn bị 2–3 slide, ảnh kết quả và video dự phòng | 4 | N13 | Có kết quả thực, cấu hình mô hình và giới hạn; ghi rõ phần nào dùng phương án dự phòng |
| | **Tổng chuyên môn của Trí** | | **40** | | |

#### 3.2.6. Công việc chung và dự phòng

Các giờ trong bảng này là **giờ của từng người**, có quy đổi ra tổng giờ của cả nhóm để tránh tính thiếu hoặc tính trùng.

| Mã | Hạng mục | Nội dung và trách nhiệm | Giờ/người | Tổng giờ nhóm | Thời gian |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **G01** | Chốt phạm vi và hợp đồng | Cả 5 người xác nhận schema, mock, giao diện, ngân sách API và kết luận POC; Tường điều phối, Trí trình bày kết quả thử | 1 | 5 | N1–N2 |
| **G02** | Tích hợp luồng xuyên suốt | Cả nhóm chạy và xác định lỗi giao diện–phiên–chat–phôi–try-on; Lợi điều phối, mỗi chủ module sửa phần mình trong giờ chuyên môn | 1 | 5 | N7 |
| **G03** | Review chéo và chốt phiên bản | Mỗi người review một phân hệ theo bảng 3.7; Thành tổng hợp trạng thái bản chạy và lỗi còn lại | 1 | 5 | N11–N12 |
| **G04** | Ghép hồ sơ và tổng duyệt | Mỗi người đưa phần báo cáo/slide đã chuẩn bị vào bản chung; Tùng điều phối nội dung, Trí điều phối kịch bản demo; cả nhóm tổng duyệt | 1 | 5 | N14 |
| **R01** | Dự phòng đều cho từng người | Mỗi người có 4 giờ cho lỗi khó, điều chỉnh sau POC, hỗ trợ hoặc sửa sau review; phần dùng thực tế phải ghi theo người | 4 | 20 | Phân bổ N1–N14 khi cần |
| | **Tổng chung + dự phòng** | | **8** | **40** | |

### 3.3. Tổng hợp khối lượng và nguyên tắc công bằng

**Bảng 3.3. Ngân sách thời gian của từng thành viên**

| Thành viên | Xây dựng | Kiểm thử/sửa lỗi | Báo cáo/slide/demo | Việc chung | Kế hoạch | Dự phòng | Tổng nguồn lực | Tỷ trọng |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Nguyễn Xuân Tường** | 32 | 4 | 4 | 4 | **44** | 4 | **48** | **20%** |
| **Doãn Duy Lợi** | 32 | 4 | 4 | 4 | **44** | 4 | **48** | **20%** |
| **Nguyễn Phúc Thành** | 32 | 4 | 4 | 4 | **44** | 4 | **48** | **20%** |
| **Hoàng Lâm Tùng** | 32 | 4 | 4 | 4 | **44** | 4 | **48** | **20%** |
| **An Đức Minh Trí** | 32 | 4 | 4 | 4 | **44** | 4 | **48** | **20%** |
| **Tổng nhóm** | **160** | **20** | **20** | **20** | **220** | **20** | **240** | **100%** |

Tổng nguồn lực tương đương khoảng **3,4 giờ/người/ngày** trên 14 ngày lịch. Khoảng ngày trong bảng công việc là cửa sổ thực hiện; mỗi người sắp giờ theo phụ thuộc, tránh dồn việc vào ngày họp. N7 ưu tiên luồng tối thiểu; phần hoàn thiện còn lại của T03/T09/T15/T21/T27 tiếp tục đến N8.

**Cơ sở cân bằng độ khó:**

- **Tường:** nhiều bề mặt giao diện và component dùng chung; không gánh backend hoặc tự viết nghiệp vụ AI.
- **Lợi:** ít trang hơn nhưng có dựng hình, export ảnh, trạng thái bất đồng bộ và đồng bộ phiên bản hồ sơ.
- **Thành:** nền tảng nhiều phụ thuộc và triển khai; Tùng/Trí tự phụ trách backend, persistence và kiểm thử của hai module AI.
- **Tùng:** vừa chuẩn bị dữ liệu vừa làm đề xuất, tìm kiếm, size và hội thoại; dùng luật + LLM, không huấn luyện mô hình riêng.
- **Trí:** tập trung vào rủi ro tích hợp API ảnh; thử nghiệm bị giới hạn ở N1–N2, không giao thêm quản trị hệ thống hoặc toàn bộ báo cáo.

Số giờ là ước lượng để lập kế hoạch, không thay thế đánh giá đóng góp thực tế. Kiểm tra lại cuối N2, N7 và N10. Nếu một người dự kiến vượt **4 giờ** so với ngân sách kế hoạch, chuyển một đầu việc có đầu ra rõ cho người còn khả năng hỗ trợ, ưu tiên dùng dự phòng đều trước; cập nhật cả người nhận, số giờ và phụ thuộc. Không tính số commit, số dòng code hoặc số trang báo cáo làm thước đo công bằng.

### 3.4. Phụ thuộc và lịch bàn giao

**Bảng 3.4. Bàn giao trung gian**

| Hạn | Sản phẩm bàn giao | Người giao → người nhận | Mục đích |
| :--- | :--- | :--- | :--- |
| **Cuối N1** | Tokens/component nền và router; phôi mannequin thử; schema API tối thiểu | Tường → Lợi; Lợi → Trí; Thành ↔ cả nhóm | Tách công việc frontend và cho phép thử API ảnh sớm |
| **Cuối N2** | Fixture/schema đã chốt; seed 24 sản phẩm; POC Face Swap/VTON và danh sách loại đồ được bật | Thành/Tùng → cả nhóm; Trí → Lợi và cả nhóm | Mọi người tiếp tục bằng mock thống nhất; kết luận sớm tính khả thi pipeline |
| **Cuối N5** | Shop dựng xong với fixture; PNG mannequin; phiên/profile API; recommendation API; upload/base-avatar API | Tường, Lợi, Thành, Tùng, Trí trao đổi theo hợp đồng | Đủ nền tảng để ghép luồng thật; các phần không chờ nhau qua trao đổi thủ công |
| **Cuối N7** | Một hội thoại thật → một sản phẩm thật → một tác vụ thử đồ thật → ảnh kết quả | Cả nhóm tại G02 | Chứng minh luồng chính; dùng phiên khách và sản phẩm/phôi đã kiểm chứng |
| **Cuối N8** | Các API và trạng thái đầy đủ của chat/catalog/try-on; UI đã kết nối | Tường/Lợi ↔ Thành/Tùng/Trí | Hoàn thành tích hợp các nhánh còn lại sau luồng tối thiểu |
| **Cuối N10** | Bản triển khai với auth/cart, tìm kiếm thông minh, cache, xử lý lỗi và cấu hình demo | Mỗi người bàn giao phần sở hữu; Thành kiểm tra bản chạy | Đóng băng tính năng và chuyển sang nghiệm thu |
| **Cuối N12** | Checklist, kết quả AI, review chéo và danh sách giới hạn còn lại | Mỗi người → cả nhóm | Chốt phiên bản; phân biệt lỗi ứng dụng với giới hạn mô hình |
| **Cuối N13** | Nội dung báo cáo, 2–3 slide/người và đoạn demo phần mình | Cả 5 người → tài liệu chung | G04 chỉ cần ghép, kiểm tra và tổng duyệt |
| **Cuối N14** | Mã nguồn, hướng dẫn chạy, báo cáo, slide, video demo và bảng đóng góp thực tế | Cả nhóm | Hoàn tất bàn giao |

**Nguyên tắc tránh chờ phụ thuộc:** Dùng fixture từ N2, thay adapter sang API thật khi bàn giao. Khi đổi schema, người sở hữu đề xuất và cập nhật hợp đồng cùng các bên bị ảnh hưởng trước khi merge. Mỗi người tạo migration trong phạm vi module của mình; Thành rà soát thứ tự chạy chung.

### 3.5. Mốc tiến độ và tiêu chí nghiệm thu

**Bảng 3.5. Milestones**

| Mốc | Hạn | Kết quả phải có | Tiêu chí nghiệm thu |
| :--- | :--- | :--- | :--- |
| **M1 — Chốt đầu vào và tính khả thi** | N2 | Thiết kế, hợp đồng, seed và kết quả POC ảnh | Có phôi đầu vào, ảnh kết quả hoặc log lỗi, nhận định khả năng dùng từng API/loại đồ, ngân sách; phần không đạt được ghi giảm phạm vi |
| **M2 — Chạy luồng chính** | N7 | Shop → chat → chọn áo → phôi → try-on → kết quả | Chạy bằng API thật ít nhất một cặp đã kiểm chứng; giữ cùng phiên khách; nếu phải dùng đầu vào dự phòng phải đánh dấu rõ |
| **M3 — Hoàn thiện bản MVP** | N10 | Giao diện mới, auth/session/cart, đề xuất, tìm kiếm, pipeline và cache | Có bản chạy chung; chuyển trang không mất hội thoại/hồ sơ; không tạo tác vụ trả phí trùng trong cùng thao tác |
| **M4 — Chốt chất lượng** | N12 | Kiểm thử luồng, phân quyền, responsive và chất lượng AI | Không còn lỗi chặn luồng; ID sản phẩm hợp lệ; hai phiên tách biệt; có bảng đánh giá 15 câu tư vấn và ít nhất 10 cặp ảnh |
| **M5 — Bàn giao** | N14 | Repo, tài liệu, slide và demo | Thành viên khác khởi động được theo hướng dẫn; đủ phần đóng góp của 5 người; số liệu và hình ảnh demo có nguồn từ kết quả thực |

**Bảng 3.6. Bộ kịch bản kiểm thử chung**

| Mã | Tình huống | Kết quả mong đợi | Chủ trì kiểm tra |
| :--- | :--- | :--- | :--- |
| **K01** | Vào website khi chưa đăng nhập, chuyển Shop ↔ Fitting Room, tải lại | Giữ phiên, hồ sơ, giỏ và đúng lịch sử chat trong hạn lưu | Thành + Tường |
| **K02** | Lọc/tìm kiếm theo loại, dịp mặc, giá hoặc câu tự nhiên | Sản phẩm tồn tại, đúng bộ lọc bắt buộc; không có hàng thì báo rõ | Tùng + Tường |
| **K03** | Hỏi chatbot, bấm “Thử ngay” | Điều hướng đúng ID; phôi hợp lệ mới tạo tác vụ; không khởi tạo lặp khi render lại | Tường + Lợi |
| **K04** | Chỉnh số đo/màu da, xuất phôi | Preview cập nhật, đầu không méo, PNG 768×1024; phôi cũ hết hiệu lực cho yêu cầu mới | Lợi + Trí |
| **K05** | Có/không có ảnh mặt hoặc ảnh không hợp lệ | Có đường đi không Face Swap; ảnh sai được báo lỗi; giới hạn đầu vào được hướng dẫn | Trí + Lợi |
| **K06** | Chọn lại cùng món, đổi ảnh mặt hoặc nhận kết quả tác vụ cũ | Tái sử dụng cache đúng điều kiện; đổi đầu vào tạo phiên bản mới; không hiển thị nhầm kết quả | Trí + Lợi |
| **K07** | AI lỗi, chậm hoặc hết quota | Có trạng thái lỗi và thử lại có kiểm soát; giữ trang thao tác được; không phát sinh retry vô hạn | Trí + Tùng |
| **K08** | Hai phiên cố lấy hội thoại/ảnh/tác vụ của nhau | Bị từ chối; không lộ dữ liệu hoặc URL ảnh riêng | Thành + Tùng + Trí |
| **K09** | Khách thêm giỏ, đăng nhập, đăng xuất; chọn size thiếu dữ liệu | Gộp dữ liệu đúng quy tắc; giá/số lượng kiểm tra server; thiếu size yêu cầu chọn | Thành + Tường |
| **K10** | Desktop, tablet, mobile; xóa ảnh và hết hạn lưu | Không che CTA, khung model/chat dùng được; ảnh và cache bị thu hồi theo chính sách | Lợi + Tường + Trí |

Người phối hợp xác nhận trong G02/G03 hoặc trong thời gian kiểm thử phần mình. Việc sửa lỗi thuộc chủ sở hữu module, tránh dồn toàn bộ lỗi tích hợp cho một người.

### 3.6. Review, kiểm thử và phối hợp

**Bảng 3.7. Vòng review chéo — mỗi người review đúng một phân hệ**

| Người review | Phân hệ được review | Trọng tâm |
| :--- | :--- | :--- |
| **Nguyễn Xuân Tường** | Phòng thử đồ của Lợi | Tương tác, điều hướng, form, tiến trình và responsive |
| **Doãn Duy Lợi** | AI Stylist của Tùng | Hồ sơ, sản phẩm thật, nút thử và dữ liệu thiếu |
| **Hoàng Lâm Tùng** | Pipeline AI của Trí | Khóa cache, dữ liệu đầu vào, trạng thái và bằng chứng chất lượng |
| **An Đức Minh Trí** | Backend nền tảng của Thành | Phiên, ownership, cấu hình, giới hạn request và tích hợp module |
| **Nguyễn Phúc Thành** | Shop/Chat UI của Tường | Gọi API, đăng nhập, giỏ, giữ phiên và xử lý lỗi |

Quy tắc phối hợp:

1. Mỗi đầu việc có issue theo mã T/G; cập nhật đầu ra, giờ thực tế và vướng mắc ngay trên issue. Cập nhật ngắn hằng ngày được tính trong thời gian của đầu việc.
2. Dùng nhánh `feature/<ma-task>-<noi-dung>`, PR có mô tả và cách kiểm chứng. Thay đổi thuộc module khác trao đổi với chủ sở hữu trước; không sửa chồng file dùng chung.
3. Mỗi người hoàn thiện kiểm thử có ý nghĩa cho phần mình: luồng người dùng, quyền truy cập, điều kiện cache và dữ liệu đầu ra. Không cần kiểm thử chi tiết trang trí CSS.
4. File khởi tạo/router hợp nhất và hợp đồng chung do người sở hữu điều phối; các thành viên cung cấp module mount được để giảm xung đột.
5. API key, mật khẩu, ảnh cá nhân và dữ liệu không được phép công khai không đưa vào repo. Chỉ dùng dữ liệu demo được phép sử dụng.
6. Dữ liệu giả trong giai đoạn làm UI phải được đánh dấu; bản nghiệm thu dùng API thật. Video/ảnh lưu sẵn phục vụ dự phòng được ghi rõ là kết quả của lần chạy trước.
7. Sau N10, lỗi được phân theo mức chặn luồng/cần sửa/có thể ghi giới hạn. Tính năng mới chuyển sang giai đoạn sau.

### 3.7. Rủi ro và phương án xử lý

| Rủi ro | Mốc phát hiện | Xử lý | Phụ trách chính |
| :--- | :--- | :--- | :--- |
| **Face Swap không nhận mặt trên mannequin** | N2 | Điều chỉnh phôi bán tả thực, thử đầu vào đối chứng; nếu vẫn lỗi thì dùng mặt mặc định và ghi tính năng cá nhân hóa chưa đạt. Không coi việc ghép ảnh mặt bằng cắt dán là tương đương pipeline yêu cầu | Trí, Lợi |
| **VTON không nhận tư thế hoặc làm biến dạng phôi 2D** | N2 | Thử tư thế/phôi có đồ nền rõ, ảnh sản phẩm đơn giản. Có thể dùng người mẫu bán tả thực/ảnh người làm đường demo dự phòng; ghi rõ việc giảm phạm vi và giới hạn số đo | Trí, Lợi |
| **Quần/váy/đầm không được API hỗ trợ đủ tốt** | N2 và N8 | Giữ lọc/gợi ý sản phẩm; chỉ bật “Thử AI” cho nhóm đã kiểm chứng, thông báo nhóm chưa hỗ trợ. Ưu tiên áo để giữ luồng chính; ghi các nhóm chưa đạt vào phạm vi tồn đọng | Trí, Tùng, Tường |
| **API tốn phí, giới hạn lượt hoặc phản hồi chậm** | Từ N1 | Đặt trần chi phí và quota; ngân sách thử dự kiến 50–100 ảnh, điều chỉnh sau khi xác minh đơn giá; chống trùng, cache hợp lệ, timeout và video dự phòng | Trí; Tùng kiểm soát phần LLM |
| **LLM bịa sản phẩm hoặc tư vấn thiếu dữ liệu** | N7 | Backend kiểm tra ID, lọc cứng giá/tồn kho, hỏi bổ sung số đo; fallback quy tắc và tìm từ khóa | Tùng |
| **Sinh giao diện đẹp nhưng khó tích hợp** | N2–N5 | Sinh theo design tokens và component đã chốt; thay mock bằng hợp đồng chung; yêu cầu thao tác chạy thật, rà trên nhiều cỡ màn hình | Tường, Lợi |
| **Backend dùng chung làm nghẽn tiến độ** | N2–N7 | Thành bàn giao schema/fixture sớm; Tùng và Trí tự triển khai route, persistence và adapter của module mình; frontend phát triển trên fixture | Thành, Tùng, Trí |
| **Khối lượng thực tế lệch giữa các thành viên** | N2, N7, N10 | Đo giờ còn lại và độ khó, dùng dự phòng, chuyển một phần có đầu ra độc lập như test, seed, UI trạng thái hoặc tài liệu; ghi lại phân công mới | Cả nhóm |
| **Môi trường demo hoặc mạng gặp sự cố** | N10–N14 | Có hướng dẫn chạy local, dữ liệu seed, ảnh/video của kết quả thật và phiên bản đã chốt | Thành và từng chủ module |

**Thứ tự ưu tiên khi thiếu thời gian:** giữ phiên khách → danh mục thật → mannequin xuất được ảnh → thử một áo bằng AI thật → chatbot gắn sản phẩm thật → giỏ/đăng nhập → tối ưu chất lượng và tiện ích. Các yêu cầu chưa đạt phải ghi vào bảng tồn đọng; không thay đổi tiêu chí nghiệm thu bằng cách gọi đầu vào hoặc kết quả dự phòng là tính năng hoàn chỉnh.

### 3.8. Hồ sơ bàn giao và phân chia thuyết trình

Mỗi thành viên bàn giao: mã nguồn module, cấu hình cần thiết, cách kiểm thử, bằng chứng kết quả, giới hạn còn lại, phần báo cáo và 2–3 slide. Giờ chuẩn bị này đã nằm trong T06/T12/T18/T24/T30; ghép và tổng duyệt tính ở G04.

| Thành viên | Phần báo cáo/slide | Phần demo và phản biện |
| :--- | :--- | :--- |
| **Nguyễn Xuân Tường** | Thiết kế giao diện, luồng bán hàng và chatbot UI | Từ cửa hàng tới thẻ sản phẩm trong chat; giải thích component và trạng thái dùng chung |
| **Doãn Duy Lợi** | Mannequin, ánh xạ số đo, export PNG, giao diện phòng thử | Chỉnh dáng, chọn màu da, chuyển chế độ xem; giải thích giới hạn minh họa cơ thể |
| **Nguyễn Phúc Thành** | Kiến trúc, ERD, auth/session, giỏ và triển khai | Khách→đăng nhập, khôi phục dữ liệu; giải thích API và phân quyền |
| **Hoàng Lâm Tùng** | Dữ liệu, đề xuất, tìm kiếm, size và đánh giá chatbot | Hỏi theo hồ sơ/ngân sách; giải thích vì sao chọn sản phẩm, xử lý thiếu dữ liệu |
| **An Đức Minh Trí** | Face Swap, VTON, tác vụ, cache, chi phí và đánh giá ảnh | Pipeline ảnh và cache; giải thích chất lượng thực tế, lỗi mô hình và phương án dự phòng |

**Checklist cuối dự án:**

- [ ] Giao diện mới của Shop, Fitting Room, Chat và tài khoản đã kết nối dữ liệu.
- [ ] Mannequin thay đổi được, xuất PNG đúng kích thước; mức độ chính xác được mô tả đúng.
- [ ] Có kết quả kiểm chứng Face Swap/VTON, danh sách loại trang phục hỗ trợ và bảng yêu cầu còn tồn đọng.
- [ ] Chatbot xuất hiện ở hai trang, giữ hội thoại, trả sản phẩm thật và điều hướng thử đúng món.
- [ ] Khách chưa đăng nhập dùng được theo phiên; tài khoản lưu/khôi phục dữ liệu đúng quy tắc.
- [ ] Có chống yêu cầu AI trùng, cache theo phiên bản, giới hạn chi phí và xử lý lỗi.
- [ ] Kiểm tra được việc tách dữ liệu của hai người dùng; ảnh có thời hạn lưu và cơ chế xóa.
- [ ] Có bản chạy chung, hướng dẫn local, cấu hình mẫu và seed.
- [ ] Có kết quả kiểm thử, đánh giá AI, báo cáo, slide và video dự phòng.
- [ ] Bảng giờ thực tế, nhiệm vụ đã chuyển giao và phần trình bày của cả 5 thành viên đã được cập nhật.

**Tổng kế hoạch:** 30 đầu việc chuyên môn, 4 đầu việc chung, dự phòng đều cho 5 người; **220 giờ kế hoạch + 20 giờ dự phòng = 240 giờ**, mỗi thành viên **48 giờ và 20% nguồn lực**.
