# BÁO CÁO ĐÁNH GIÁ HIỆN TRẠNG PROJECT

**Project:** `ManhT005/Kiem-thu-nhom-3`  
**Vai trò review:** Tech Lead / Senior Developer  
**Ngày đánh giá:** 25/09/2026  
**Baseline:** `main` / `develop` tại commit `5d169de8bab9c47d12d7e77f610905bb24a30591`  
**Tài liệu tham chiếu:** `docs/PROJECT_SCALING_PLAN.md`, `docs/MASTER_TEST_PLAN.md`

---

## 1. Executive Summary

Project hiện tại là một hệ thống bán quần áo được kế thừa từ project cũ, sử dụng:

- Backend: Node.js, Express 4, MySQL (`mysql2`)
- Frontend: HTML/CSS/JavaScript thuần
- Authentication: JWT + bcrypt
- Upload: Multer
- Payment demo: MoMo Sandbox
- Test định hướng: Postman + Newman

Hệ thống **đã có đủ khung nghiệp vụ cơ bản để làm nền cho môn Kiểm thử phần mềm**, gồm Auth, User, Product, Category, Cart, Order, Inventory và giao diện Admin/Staff/User.

Tuy nhiên, trạng thái hiện tại chưa phù hợp để mở rộng ngay các module lớn như Voucher, Dashboard hoặc Goods Receipt. Vấn đề lớn nhất không nằm ở số lượng tính năng, mà ở **độ tin cậy của API contract, authorization, transaction, validation và khả năng tái tạo môi trường kiểm thử**.

Kết luận kỹ thuật:

> Không nên bắt đầu bằng việc thêm nhiều chức năng mới. Nên thực hiện một Phase ổn định nền tảng trước, sau đó mới phát triển State Machine, Inventory, Voucher và Dashboard.

Phase đầu tiên đề xuất: **Stabilization & API Contract Foundation**.

---

## 2. Kiến trúc hiện tại

### 2.1. Backend

Cấu trúc chính:

```text
backend/
├── config/
│   ├── config.js
│   └── db.js
├── controllers/
│   ├── auth.controller.js
│   ├── cart.controller.js
│   ├── category.controller.js
│   ├── kho.controller.js
│   ├── order.controller.js
│   ├── product.controller.js
│   └── user.controller.js
├── middleware/
│   └── auth.middleware.js
├── models/
│   ├── Cart.js
│   ├── Category.js
│   ├── Product.js
│   └── users.js
├── routes/
├── server.js
└── package.json
```

Backend đang theo mô hình gần với:

```text
Route -> Controller -> Model/Raw SQL -> MySQL
```

Đây là kiến trúc chấp nhận được cho project môn học quy mô nhỏ, nhưng business logic hiện đang nằm nhiều trong Controller và chưa có Service Layer.

### 2.2. Frontend

Frontend là multi-page application:

```text
frontend/
├── html/
├── css/
├── js/
└── Asset/
```

Các chức năng đã có:

- đăng nhập / đăng ký
- trang chủ / tìm kiếm
- chi tiết sản phẩm
- giỏ hàng
- checkout
- profile + địa chỉ
- admin management
- staff inventory + order management

### 2.3. Database

Schema gốc từng được lưu trong `dbshop.sql`, nhưng hiện file `.sql` đã bị loại khỏi branch hiện tại do `.gitignore` chứa:

```gitignore
*.sql
```

Schema cũ vẫn có thể phục hồi từ Git history, ví dụ commit:

```text
164dc65e85d9f00ad70cdc1b5e979aa4e3a9ee9a
```

Các bảng nền tảng đã tồn tại trong schema cũ:

- `users`
- `danhMuc`
- `Size`
- `SanPham`
- `ChiTietSanPham`
- `SanPham_DanhMuc`
- `GioHang`
- `ChiTietGioHang`
- `phuongThucThanhToan`
- `GiamGia`
- `DiaChi`
- `DonHang`
- `ChiTietDonHang`

Điều này rất hữu ích: **không cần thiết kế database từ đầu**, nhưng cần đưa schema trở lại repo theo hướng migration/seed có kiểm soát.

---

## 3. Mức độ hoàn thiện theo module

| Module | Hiện trạng | Mức độ | Nhận xét |
|---|---|---:|---|
| Authentication | Register/Login/JWT có sẵn | Partial | Validation yếu, JWT secret hard-code |
| User/Profile | Profile, address, role admin | Partial | Chưa có lock/unlock account |
| Product | CRUD + size + image | Tương đối tốt | Thiếu transaction/validation chuẩn |
| Category | CRUD cơ bản | Có | Cần chuẩn response/error |
| Cart | CRUD giỏ hàng | Partial | Chưa enforce tồn kho chặt chẽ |
| Order | Create/list/status | Partial/Risky | Không transaction, state transition chưa enforce |
| Inventory | Xem/sửa tồn trực tiếp | Legacy | Chưa có phiếu nhập/lịch sử biến động |
| Voucher | Chưa triển khai | Missing | Chỉ có bảng `GiamGia` cũ |
| Dashboard | Chưa triển khai | Missing | Không có API analytics |
| MoMo | Sandbox demo | Partial | Chưa có payment lifecycle/IPN chuẩn |
| Automated Test | Chưa có | Missing | Không thấy Postman collection/Newman/CI |
| DB Migration/Seed | Chưa có | Missing | Schema không tái tạo được từ current branch |

---

## 4. Các vấn đề kỹ thuật quan trọng

## 4.1. P0 - Authorization middleware đang không strict

File:

```text
backend/middleware/auth.middleware.js
```

`verifyToken` hiện tại:

- không có Authorization header -> `next()`
- token sai -> `next()`
- token hết hạn -> `next()`

Điều này chỉ phù hợp với một middleware kiểu `optionalAuth`, nhưng nó lại đang được dùng cho protected endpoints.

### Hậu quả

Ví dụ:

```text
GET /api/cart
GET /api/users/profile
POST /api/orders/create
```

Controller truy cập:

```js
req.user.id
```

Nếu không có token, `req.user` có thể `undefined`, dẫn đến lỗi runtime/HTTP 500 thay vì `401 Unauthorized`.

Nghiêm trọng hơn, các endpoint không sử dụng `req.user` có thể đi tiếp hoàn toàn.

---

## 4.2. P0 - Order management có thể truy cập không đúng quyền

Routes:

```text
GET /api/orders/all
PUT /api/orders/:id/status
```

chỉ dùng:

```text
verifyToken
```

mà không dùng `verifyAdmin` / Staff authorization.

Do `verifyToken` hiện tại lại cho qua cả request không có token, hai API này có rủi ro cho phép:

- đọc toàn bộ đơn hàng
- thay đổi trạng thái đơn hàng

mà không có authorization server-side đủ mạnh.

Đây là lỗi cần xử lý trước khi viết test suite RBAC.

---

## 4.3. P0 - Inventory hiện có API chỉnh trực tiếp mà không bảo vệ quyền

Routes:

```text
GET /api/kho
PUT /api/kho/:maSP
```

không có auth middleware.

Đặc biệt:

```text
PUT /api/kho/:maSP
```

cho phép chỉnh trực tiếp `soLuongTon`.

Điều này trái với mục tiêu trong `PROJECT_SCALING_PLAN.md` là chuyển sang nghiệp vụ phiếu nhập kho và lịch sử biến động.

---

## 4.4. P0 - createOrder chưa đảm bảo ACID

`createOrder` hiện xử lý:

1. INSERT `DonHang`
2. INSERT `ChiTietDonHang`
3. xóa item khỏi giỏ
4. trừ tồn kho

nhưng không dùng transaction.

Ngoài ra bước 3 và 4 chạy theo kiểu callback bất đồng bộ trong `forEach`, response `201` có thể được gửi trước khi toàn bộ stock update hoàn tất.

### Rủi ro

- tạo DonHang thành công nhưng ChiTietDonHang lỗi
- tạo order thành công nhưng trừ kho lỗi
- xóa cart thành công nhưng trừ kho lỗi
- một item đủ tồn, một item thiếu tồn
- dữ liệu trạng thái nửa thành công/nửa thất bại

Đây chính là gap được tài liệu scaling plan nhận diện đúng.

---

## 4.5. P0 - Server tin `tongTien` và `gia` do frontend gửi lên

Checkout gửi:

```text
tongTien
items[].gia
```

Backend dùng trực tiếp các giá trị này để tạo order.

Người dùng có thể sửa request bằng Postman/DevTools và gửi:

```json
{
  "tongTien": 1000,
  "items": [
    {
      "maSP": 1,
      "gia": 1
    }
  ]
}
```

Backend phải lấy giá sản phẩm từ database và tự tính tổng.

### Nguyên tắc

> Client chỉ gửi `maSP`, `maSize`, `soLuong`; server phải là source of truth cho giá và tổng tiền.

---

## 4.6. P0 - Hủy đơn nhiều lần có thể cộng tồn kho nhiều lần

`updateOrderStatus` hiện có logic:

```text
nếu trangThai mới == "Đã hủy"
    cộng stock trở lại
```

nhưng không kiểm tra transition hợp lệ.

Nếu cùng một order được gửi `Đã hủy` nhiều lần, logic hoàn kho có thể chạy nhiều lần.

Đây là lỗi data integrity rất phù hợp để chứng minh giá trị của State Transition Testing trong đồ án.

---

## 4.7. P1 - Chưa có Order State Machine thực tế

Frontend đang hiển thị các trạng thái:

- Chờ xác nhận
- Đang xử lý
- Đang giao
- Hoàn thành
- Đã hủy

Trong khi plan định nghĩa:

- Pending
- Confirmed
- Shipping
- Completed
- Cancelled

Backend hiện cho phép cập nhật trạng thái tự do.

Chưa có:

- transition map
- terminal state protection
- audit log
- cancellation reason
- actor tracking
- stock restoration atomicity

---

## 4.8. P1 - Validation phân tán và không đồng nhất

Ví dụ:

- Auth chỉ kiểm tra field có tồn tại
- Cart chủ yếu chỉ check `maSize`
- Product check `tenSP`, `gia`
- User address check string rỗng
- Checkout validation nằm ở frontend nhiều hơn backend

Frontend validation không phải security control.

Cần central validation middleware để test BVA/EP ổn định.

---

## 4.9. P1 - API response contract chưa thống nhất

Các API hiện trả nhiều format:

```json
{ "message": "..." }
```

```json
{ "error": "..." }
```

```json
{ "products": [] }
```

```json
[]
```

```json
{
  "message": "...",
  "error": "..."
}
```

Điều này khiến Postman assertion phức tạp và làm test automation khó tái sử dụng.

Target nên theo tài liệu:

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "...",
  "data": {}
}
```

và:

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "...",
  "errors": []
}
```

---

## 4.10. P1 - Chưa có centralized error handling

Controller tự xử lý `500` ở nhiều nơi.

Một số response đưa trực tiếp:

```js
err.message
```

hoặc:

```js
error: err
```

ra client.

Nên tránh leak internal DB details và chuẩn hóa error mapping.

---

## 4.11. P1 - JWT secret hard-code

JWT secret hiện là:

```text
SECRET_KEY_123
```

và nằm trong source code.

Cần chuyển sang:

```text
JWT_SECRET
JWT_EXPIRES_IN
```

qua environment.

---

## 4.12. P1 - `.env` đang được commit

Current tree có:

```text
backend/.env
```

Mặc dù nội dung hiện chưa chứa password thật, pattern này không nên duy trì.

Cần:

```text
backend/.env.example
```

và ignore `.env`.

---

## 4.13. P1 - dotenv được cài nhưng chưa thấy load trong server

`dotenv` nằm trong dependencies nhưng `server.js`/entry point chưa có:

```js
import "dotenv/config";
```

hoặc:

```js
dotenv.config();
```

Do đó local `.env` không đảm bảo được load tự động.

---

## 4.14. P1 - `node_modules` vẫn đang được track

Repo tree hiện vẫn có:

```text
backend/node_modules/
```

dù `.gitignore` đã có:

```gitignore
node_modules/
```

Nguyên nhân: thư mục đã được commit từ trước nên `.gitignore` không tự untrack.

Cần:

```bash
git rm -r --cached backend/node_modules
```

sau đó commit cleanup.

---

## 4.15. P1 - Database schema không reproducible

`.gitignore` đang bỏ toàn bộ:

```text
*.sql
```

Trong khi project lại phụ thuộc mạnh vào MySQL schema.

Đối với project testing, đây là vấn đề lớn vì:

> Tester phải có khả năng reset database về trạng thái biết trước.

Nên đổi thành:

```text
database/
├── migrations/
├── seeds/
└── README.md
```

Các migration/seed phải được commit.

Chỉ ignore dump cá nhân:

```text
*.local.sql
*.dump.sql
```

---

## 4.16. P1 - Frontend hard-code API URL

Nhiều file gọi trực tiếp:

```text
http://localhost:3000/api/...
```

Ví dụ:

- `frontend/js/login.js`
- `frontend/js/Header.js`
- `frontend/js/staff.js`
- `frontend/js/checkout.js`

Điều này gây khó deploy và khó chạy test ở nhiều environment.

Nên tạo:

```text
frontend/js/config.js
frontend/js/api-client.js
```

hoặc dùng relative URL:

```text
/api/...
```

vì frontend đang được Express serve cùng origin.

---

## 4.17. P1 - Token lưu localStorage

Frontend lưu JWT tại:

```text
localStorage.token
```

Với phạm vi đồ án môn học, có thể giữ cơ chế này trong ngắn hạn để tránh mở rộng scope quá lớn, nhưng cần ghi nhận risk XSS.

Quan trọng hơn: **backend authorization không được tin role/user object trong localStorage**.

---

## 4.18. P1 - CORS đang mở toàn bộ

`server.js` hiện:

```js
app.use(cors());
```

Development có thể chấp nhận, nhưng config nên tách:

```text
CORS_ORIGIN
```

và whitelist môi trường.

---

## 4.19. P2 - Single MySQL connection

Hiện dùng:

```js
mysql.createConnection()
```

Khi bắt đầu dùng transaction và chạy test tự động liên tục, nên chuyển sang:

```js
mysql.createPool()
```

để:

- lấy connection riêng cho transaction
- release connection đúng cách
- tránh single connection bottleneck

---

## 4.20. P2 - Controller đang chứa nhiều business logic

Ví dụ:

- Order calculation
- Inventory update
- status handling
- user deletion cascade

đang nằm trực tiếp trong controller/model callback.

Nên tiến dần tới:

```text
Route
 -> Validation Middleware
 -> Auth/RBAC Middleware
 -> Controller
 -> Service
 -> Repository/DB
```

Không cần refactor toàn bộ project trong một lần.

---

## 5. Đối chiếu với PROJECT_SCALING_PLAN

| Nội dung kế hoạch | Code hiện tại | Gap |
|---|---|---|
| Standard API response | Chưa | Cần Phase 1 |
| Central validation | Chưa | Cần Phase 1 |
| Order State Machine | Chưa enforce | Phase 2 |
| Order Audit Trail | Chưa | Phase 2 |
| Order advanced filter | Chưa | Phase 2 |
| Order Transaction | Chưa | Phase 2 |
| Goods Receipt | Chưa | Phase 3 |
| Low Stock API | Chưa | Phase 3 |
| Inventory History | Chưa | Phase 3 |
| Account Lock/Unlock | Chưa | Phase 4 |
| RBAC Matrix | Một phần | Baseline Phase 1 + hoàn thiện Phase 4 |
| Voucher | Chưa | Phase 4 |
| Dashboard | Chưa | Phase 5 |
| Test Data Seed | Chưa | Bắt đầu Phase 1 |
| Postman/Newman | Chưa thấy asset | Bắt đầu Phase 1 |

---

## 6. Đối chiếu với MASTER_TEST_PLAN

Master Test Plan hiện **đi trước code**.

Các test technique đã được thiết kế tốt:

- Equivalence Partitioning
- Boundary Value Analysis
- Decision Table
- State Transition
- RBAC
- E2E Workflow

Nhưng để các test này chạy ổn định, hệ thống cần trước hết có:

1. API response contract cố định
2. deterministic DB state
3. auth semantics 401/403 đúng
4. validation backend rõ ràng
5. transaction cho business-critical flow
6. seed data
7. test collection thực tế
8. Newman script + report

Do đó docs hiện tại nên được xem là **target specification**, không phải mô tả trạng thái implementation đã hoàn thành.

---

## 7. Điểm mạnh nên giữ lại

Không nên rewrite project từ đầu.

Các phần nên kế thừa:

- cấu trúc Express routes/controllers hiện có
- MySQL schema cũ
- CRUD Product/Category
- size-based inventory model
- cart model
- profile/address flow
- admin/staff UI hiện có
- order/detail schema
- MoMo sandbox demo làm nền
- tài liệu Scaling Plan và Master Test Plan

Định hướng nên là:

> Incremental modernization, not rewrite.

---

## 8. Risk Register

| ID | Risk | Severity | Probability | Impact |
|---|---|---:|---:|---|
| R-01 | Unauthorized order/status access | Critical | High | Security/Data integrity |
| R-02 | Public inventory mutation | Critical | High | Stock corruption |
| R-03 | Order partial commit | Critical | High | Data inconsistency |
| R-04 | Client price tampering | Critical | High | Financial integrity |
| R-05 | Duplicate cancellation restores stock repeatedly | Critical | Medium/High | Inventory corruption |
| R-06 | Missing DB baseline | High | High | Team cannot reproduce tests |
| R-07 | Inconsistent response | High | High | Automation unstable |
| R-08 | Missing validation | High | High | Negative tests fail unpredictably |
| R-09 | Hard-coded secrets/config | High | Medium | Security/deployment |
| R-10 | Hard-coded localhost | Medium | High | Environment portability |
| R-11 | node_modules tracked | Medium | High | Repo hygiene/performance |
| R-12 | No CI/Newman suite | Medium | High | Regression undetected |

---

## 9. Đề xuất kiến trúc mục tiêu gần hạn

Không cần chuyển framework.

Target Phase 1-2:

```text
backend/
├── config/
├── controllers/
├── middleware/
│   ├── auth.middleware.js
│   ├── authorize.middleware.js
│   ├── validate.middleware.js
│   ├── notFound.middleware.js
│   └── error.middleware.js
├── validators/
├── services/
│   ├── order.service.js
│   └── ...
├── repositories/ hoặc giữ models/
├── routes/
├── utils/
│   ├── api-response.js
│   ├── app-error.js
│   └── async-handler.js
└── server.js

database/
├── migrations/
├── seeds/
└── README.md

tests/
└── postman/
```

---

## 10. Kết luận Tech Lead

Project hiện tại **có nền nghiệp vụ đủ tốt để kế thừa**, nhưng chưa phải baseline an toàn để phát triển tiếp theo kiểu feature-first.

Thứ tự đúng nên là:

```text
Ổn định foundation
        ↓
Order integrity & State Machine
        ↓
Inventory transaction/audit
        ↓
Voucher + User lifecycle + RBAC
        ↓
Dashboard + Payment hardening
        ↓
Regression / Performance / Final QA
```

Phase 1 không cần làm lại toàn bộ code. Mục tiêu là tạo ra một baseline mà:

- team chạy được giống nhau
- API trả response thống nhất
- 401/403 đúng
- request invalid bị reject nhất quán
- DB reset được
- Postman/Newman có thể bắt đầu automation
- các phase tiếp theo không tiếp tục tích lũy technical debt

Đây là điều kiện cần trước khi mở rộng project theo tài liệu hiện có.
