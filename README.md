# FORME° Studio

Bản demo của [đề tài bán hàng và phối đồ cá nhân hóa](docs/Tasks.md). Dùng React + Vite, Node.js và SQLite; toàn bộ dữ liệu và hình ảnh mẫu chạy được trên máy mà không cần tài khoản dịch vụ ngoài.

## Chạy trên máy

Cần Node.js **24 trở lên**.

```powershell
npm.cmd ci
npm.cmd run db:seed
npm.cmd run dev
```

Mở **http://127.0.0.1:5173** (Giao diện web) và **http://127.0.0.1:5173/api/docs** (Swagger UI tương tác từ `/api/openapi.json`). Trên macOS/Linux dùng `npm` thay cho `npm.cmd`. Đổi cổng bằng `npm run dev -- --port 5174`. Để chạy bản build: `npm run build` rồi `npm start`. (Tùy chọn AI Python Microservice: `pip install -r requirements.txt`.)

## Tài liệu API, Kiểm thử & Báo cáo Tuần 12–13

| Hạng mục | Đường dẫn |
| --- | --- |
| OpenAPI 3.0.3 (hợp nhất 25 endpoints) | `docs/api/openapi.json` (tạo lại bằng `npm.cmd run openapi:export`), live tại `GET /api/openapi.json` |
| Swagger UI | `http://127.0.0.1:5173/api/docs` |
| Postman Collection (Happy + Negative) | `docs/postman/FORME_Studio_API.postman_collection.json` |
| Khởi tạo Schema & Dữ liệu mẫu SQLite | `scripts/db-seed.mjs` (`npm.cmd run db:seed`) |
| Sản phẩm Tuần 12 (Design Review) | `docs/tuan-12/` (Project Brief & Thiết kế `.docx`, Báo cáo tiến độ `.docx`, Slide 7 trang `.pptx`) |
| Sản phẩm Tuần 13 (Implementation Review) | `docs/tuan-13/` (Báo cáo tiến độ `.docx`, Bằng chứng kiểm thử `.docx`, Slide 6 trang `.pptx`) |

### Phân công nhóm (5 thành viên — 20% / người)
- **Doãn Duy Lợi:** API Gateway, SQLite Store, Auth/Session, Swagger UI, `01-identity-profile.json`
- **Nguyễn Xuân Tường:** Catalog, Search, Cart & Shop UI, `02-catalog-cart.json`
- **Hoàng Lâm Tùng:** AI Stylist (Rules/LLM), Layering & Conflict Resolution, `03-stylist-chat.json`
- **Nguyễn Phúc Thành:** Media TTL, Async Try-On Jobs & Fitting Room UI, `04-media-tryon-jobs.json`
- **An Đức Minh Trí:** AI Vision 2 bước, Cache Hash SHA-256 & FastAPI Microservice, `05-ai-vision.json`

Mở biểu tượng tài khoản và chọn **Vào bằng tài khoản quản trị demo**. Có thể đăng nhập thủ công bằng `studio@forme.demo` / `FormeStudio2026!`. Tài khoản có quyền cao nhất trong ứng dụng demo và vào được bảng tổng quan. Mỗi thành viên cũng có thể đăng ký tài khoản riêng để thử lưu và khôi phục dữ liệu. Khi đưa lên máy chủ chia sẻ, đặt `DEMO_ADMIN=0`, bật HTTPS và cấu hình `COOKIE_SECURE=1` cùng `PUBLIC_ORIGIN`.

## Kịch bản demo

1. Tìm “áo sơ mi đi làm cho da ngăm dưới 500k”, hoặc mở Stylist và chọn một câu hỏi nhanh.
2. Bấm **Thử ngay**, đổi số đo và tông da, rồi bấm **Cập nhật vóc dáng**. Chuyển giữa **Phôi 2D** và **Kết quả thử**. Có thể tải phôi PNG 768 × 1024 hoặc lưu lượt thử.
3. Chọn size và thêm giỏ. Đăng ký hoặc đăng nhập để gộp giỏ và mở lại hồ sơ, hội thoại và các lượt thử đã lưu phù hợp.

## Chỗ chỉnh sửa

| Phần | Thư mục hoặc tệp |
| --- | --- |
| Điều hướng, giao diện cửa hàng và tài khoản | `frontend/src/app/`, `frontend/src/features/shop/`, `frontend/src/components/ui/` |
| Giao diện chung | `frontend/src/styles.css` |
| Phòng thử đồ và phôi | `frontend/src/features/fitting-room/`, `shared/contracts/mannequin.mjs` |
| Phiên, hồ sơ, giỏ và xác thực | `backend/src/platform/`, `backend/src/server.mjs` |
| Stylist, tìm kiếm và danh mục | `backend/src/modules/stylist/`, `frontend/src/features/chat/`, `data/catalog.mjs` |
| Tác vụ ảnh và dịch vụ AI | `backend/src/modules/tryon/` |

Sửa danh mục tại `data/catalog.mjs`. Chạy `npm run assets` để tạo lại ảnh minh họa từ mẫu trong `scripts/assets.mjs`, hoặc thay ảnh thẻ sản phẩm trong `frontend/public/images/products/` và ảnh đầu vào thử AI trong `frontend/public/images/garments/`. Tăng `imageVersion` khi thay ảnh đầu vào để làm mới khóa cache. Banner lấy từ [Pexels, ảnh số 6311395](https://www.pexels.com/photo/6311395/) theo [giấy phép Pexels](https://www.pexels.com/license/).

## Bật dịch vụ AI

Tạo `.env` từ [cấu hình mẫu](.env.example), đặt khóa ở máy chạy backend rồi khởi động lại. Không cần khóa cho chế độ mặc định. `OPENAI_API_KEY` bật diễn giải bằng LLM; danh sách thẻ sản phẩm vẫn do bộ lọc chọn. `FASHN_API_KEY` và `TRYON_AI_CATEGORIES` bật thử đồ AI theo nhóm hàng. `REPLICATE_API_TOKEN` và `FACE_SWAP_ENABLED=1` bật tùy chọn hoán đổi khuôn mặt. Phòng thử yêu cầu người dùng đồng ý trước khi gửi ảnh sang dịch vụ AI.

Các adapter đã được viết theo tài liệu nhà cung cấp, chưa chạy với khóa thật. Bản mặc định dùng ảnh minh họa 2D và gắn nhãn trong giao diện. Xem [kiến trúc, kiểm thử và các việc còn lại](docs/Demo.md) trước khi bật từng loại ảnh AI.

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run test:browser
```

Kiểm thử trình duyệt dùng Chrome đã cài, hoặc đặt `PLAYWRIGHT_CHANNEL=msedge` để dùng Edge. Ảnh kiểm thử được lưu trong `.runtime/qa/`.
