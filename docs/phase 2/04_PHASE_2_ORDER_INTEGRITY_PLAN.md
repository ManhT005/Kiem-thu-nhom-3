# PHASE 2 IMPLEMENTATION PLAN
# ORDER INTEGRITY, STATE MACHINE & TRANSACTION

**Project:** `ManhT005/Kiem-thu-nhom-3`  
**Baseline reviewed:** `main @ 76ae4ce23fc987ea04b423da7230e6988bfd0d9d`  
**Branch đề xuất:** `feat/phase-2-order-integrity`  
**Tài liệu liên quan:** `02_UPDATE_ROADMAP.md`, `03_PHASE_1_STABILIZATION_PLAN.md`, `MASTER_TEST_PLAN.md`, `PROJECT_SCALING_PLAN.md`  
**Mục tiêu:** Biến module Order hiện tại từ luồng CRUD/callback rời rạc thành một luồng nghiệp vụ transaction-safe, có State Machine, kiểm soát tồn kho, tính tiền phía server, hủy đơn an toàn và Audit Trail đầy đủ.

---

## 1. KẾT LUẬN REVIEW TRƯỚC KHI LẬP PHASE 2

Phase 1 đã được merge vào `main` và đã tạo được các nền tảng quan trọng:

- middleware xác thực/phân quyền;
- validation bằng `express-validator`;
- database baseline;
- Postman/Newman smoke suite;
- cấu trúc response/error foundation;
- frontend dùng same-origin API URL;
- route Order/Inventory đã được bảo vệ bằng RBAC.

Tuy nhiên, riêng module Order vẫn còn nhiều logic legacy và chính là vùng cần ưu tiên ở Phase 2.

### 1.1. Các gap thực tế đang tồn tại trong `main`

| ID | Hiện trạng | Rủi ro | Mức độ | Xử lý trong Phase 2 |
|---|---|---|---|---|
| GAP-01 | `createOrder` tin `tongTien` từ request | Client có thể sửa tổng tiền | Critical | Tính lại toàn bộ ở backend |
| GAP-02 | `item.gia` lấy trực tiếp từ request | Có thể mua với giá giả | Critical | Query giá từ `SanPham` |
| GAP-03 | Tạo đơn, tạo chi tiết, trừ kho, xóa giỏ chạy rời rạc | Có thể tạo đơn nhưng không trừ kho hoặc chỉ xử lý một phần | Critical | Transaction duy nhất |
| GAP-04 | Trừ kho chạy bằng `forEach` async và response trả trước khi hoàn tất | API báo thành công khi update kho chưa hoàn tất/thất bại | Critical | `await` tuần tự/batch trong transaction |
| GAP-05 | Không xử lý `affectedRows === 0` khi stock không đủ | Đơn vẫn có thể được tạo dù kho không đủ | Critical | Lock/check stock trước insert |
| GAP-06 | Không có row lock khi hai request cùng mua | Có nguy cơ oversell/race condition | Critical | `SELECT ... FOR UPDATE` |
| GAP-07 | `updateOrderStatus` chấp nhận gần như mọi trạng thái | State Transition sai nghiệp vụ | Major | State Machine explicit |
| GAP-08 | Hủy nhiều lần có thể hoàn kho nhiều lần | Tồn kho bị cộng sai | Critical | Idempotency + row lock |
| GAP-09 | Hoàn kho khi hủy không nằm cùng transaction đổi trạng thái | Trạng thái và kho có thể lệch nhau | Critical | Atomic cancel transaction |
| GAP-10 | Chưa có `LichSuDonHang` | Không trace được ai đổi trạng thái | Major | Migration + Audit Trail |
| GAP-11 | Chưa có API user tự hủy đơn theo ownership | Master Test Plan chưa thực thi đủ E2E | Major | Thêm endpoint cancel |
| GAP-12 | Chưa có admin/staff order filter | Thiếu scope trong Scaling Plan | Medium | Thêm filter + pagination |
| GAP-13 | Order controller vẫn trả response JSON legacy/raw error ở nhiều chỗ | Contract Phase 1 chưa đồng nhất | Major | Migrate Order về API contract chung |
| GAP-14 | `backend/.env` vẫn đang xuất hiện trong Git tree | Không đạt hygiene gate của Phase 1 | Critical nếu chứa secret thật | Fix trước khi code Phase 2 |

> **Quy tắc:** Không bắt đầu feature business mới của Phase 2 trước khi xử lý GAP-14 và xác nhận secrets không bị lộ.

---

# 2. MỤC TIÊU PHASE 2

Sau Phase 2, hệ thống phải bảo đảm:

```text
Client request
    ↓
Validate input
    ↓
Authenticate + RBAC / Ownership
    ↓
Order Service
    ↓
Begin Transaction
    ↓
Lock order/product rows
    ↓
Validate business rules
    ↓
Server-side calculation
    ↓
Order + Details + Stock + Audit + Cart
    ↓
Commit
    ↓
Standard API Response
```

Các thuộc tính bắt buộc:

```text
Atomic
Consistent
Race-aware
Server-authoritative
State-machine controlled
Auditable
Regression-testable
```

---

# 3. OUT OF SCOPE

Không mở rộng Phase 2 sang các phần sau:

- Phiếu nhập kho / Goods Receipt hoàn chỉnh;
- Inventory Movement tổng quát;
- Voucher/Promotion;
- Account lock lifecycle;
- Dashboard doanh thu;
- MoMo IPN/payment lifecycle;
- rewrite toàn backend sang TypeScript;
- thay framework frontend;
- microservice;
- Redis/distributed locking.

Phase 2 chỉ tạo nền tảng Order đủ chắc để Phase 3 nối Inventory Movement vào sau.

---

# 4. PRE-FLIGHT GATE – KHÓA NỢ PHASE 1

## P2-GATE-01 – Loại `.env` khỏi Git tracking

Thực hiện:

```bash
git rm --cached backend/.env
```

Đảm bảo `.gitignore` có:

```gitignore
.env
backend/.env
```

Giữ:

```text
backend/.env.example
```

### Acceptance

```bash
git ls-files backend/.env
```

không trả kết quả.

Nếu file từng chứa credential thật:

1. rotate password/key tương ứng;
2. không copy secret vào issue/report;
3. kiểm tra commit history trước khi public release.

---

## P2-GATE-02 – Chuẩn hóa riêng module Order về contract Phase 1

Toàn bộ endpoint Order phải dùng utility chung:

```json
{
  "success": true,
  "code": "ORDER_CREATED",
  "message": "Order created successfully",
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "code": "INSUFFICIENT_STOCK",
  "message": "Insufficient stock",
  "errors": []
}
```

Không trả:

```text
err.message
raw SQL error
stack trace
```

cho client production.

---

# 5. KIẾN TRÚC TRIỂN KHAI ĐỀ XUẤT

Không cần rewrite project, nhưng nên tách business logic Order khỏi controller.

```text
backend/
├── controllers/
│   └── order.controller.js
├── services/
│   └── order.service.js
├── repositories/
│   └── order.repository.js
├── domain/
│   └── order-status.js
├── validators/
│   └── order.validator.js
├── utils/
│   └── transaction.js
└── routes/
    └── order.routes.js
```

### Trách nhiệm

| Layer | Trách nhiệm |
|---|---|
| Route | middleware chain, RBAC |
| Validator | shape/type/range của request |
| Controller | HTTP input/output, gọi service |
| Service | business rules, transaction, State Machine |
| Repository | SQL parameterized |
| Domain | constants + transition map |

Không đặt SQL business-critical mới trực tiếp trong route.

---

# 6. DATABASE CONNECTION & TRANSACTION FOUNDATION

## 6.1. Chuyển từ single connection sang pool

Current DB dùng `mysql2.createConnection()`.

Đề xuất Phase 2:

```js
mysql.createPool(...)
```

Lý do:

- legacy `pool.query(..., callback)` vẫn tương thích với phần lớn code hiện tại;
- Order transaction có thể dùng `pool.promise().getConnection()`;
- một transaction luôn chạy trên cùng một connection;
- phù hợp concurrency tốt hơn single global connection.

### Pattern

```js
const connection = await pool.promise().getConnection();

try {
  await connection.beginTransaction();

  // all Order operations through `connection`

  await connection.commit();
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.release();
}
```

### Quy tắc bắt buộc

Trong transaction không được trộn:

```text
connection.query(...)
```

với:

```text
db.query(...)
```

cho các thao tác phải atomic.

---

# 7. ORDER STATUS DOMAIN MODEL

Giữ giá trị DB hiện có trong Phase 2 để tránh breaking change diện rộng, nhưng gom chúng thành constant duy nhất.

```js
export const ORDER_STATUS = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  SHIPPING: "Đang giao",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
};
```

## 7.1. Transition map

```js
PENDING   -> CONFIRMED
PENDING   -> CANCELLED

CONFIRMED -> SHIPPING
CONFIRMED -> CANCELLED

SHIPPING  -> COMPLETED

COMPLETED -> no transition
CANCELLED -> no transition
```

### Ma trận

| From | To | Admin/Staff | User | Kết quả |
|---|---|---:|---:|---|
| PENDING | CONFIRMED | ✅ | ❌ | Valid |
| PENDING | CANCELLED | ✅ | ✅ own order | Valid |
| CONFIRMED | SHIPPING | ✅ | ❌ | Valid |
| CONFIRMED | CANCELLED | ✅ | ❌ mặc định | Valid |
| SHIPPING | COMPLETED | ✅ | ❌ | Valid |
| SHIPPING | CANCELLED | ❌ | ❌ | Invalid |
| COMPLETED | bất kỳ | ❌ | ❌ | Invalid |
| CANCELLED | bất kỳ | ❌ | ❌ | Invalid |
| PENDING | PENDING | ❌ | ❌ | No-op không hợp lệ |

### Error code

```text
INVALID_ORDER_TRANSITION
ORDER_STATUS_UNCHANGED
ORDER_ALREADY_CANCELLED
```

---

# 8. DATABASE MIGRATION PHASE 2

Tạo:

```text
database/migrations/002_order_integrity.sql
```

## 8.1. Bảng `LichSuDonHang`

Đề xuất:

```sql
CREATE TABLE IF NOT EXISTS LichSuDonHang (
    maLichSu BIGINT AUTO_INCREMENT PRIMARY KEY,
    maDonHang INT NOT NULL,
    trangThaiCu VARCHAR(50),
    trangThaiMoi VARCHAR(50) NOT NULL,
    nguoiThayDoi INT NULL,
    lyDo VARCHAR(500) NULL,
    thoiGian DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (maDonHang)
        REFERENCES DonHang(maDonHang)
        ON DELETE CASCADE,
    FOREIGN KEY (nguoiThayDoi)
        REFERENCES users(id)
        ON DELETE SET NULL,
    INDEX idx_lichsu_donhang (maDonHang, thoiGian)
);
```

## 8.2. Index Order

Khuyến nghị:

```sql
CREATE INDEX idx_donhang_user_date
ON DonHang(id, ngayDat);

CREATE INDEX idx_donhang_status_date
ON DonHang(trangThai, ngayDat);
```

Phục vụ:

- My Orders;
- admin filter;
- regression dataset lớn hơn.

## 8.3. Không sửa migration `001`

`001_initial_schema.sql` là baseline đã phát hành.

Mọi thay đổi Phase 2 phải vào migration mới.

---

# 9. CREATE ORDER – THIẾT KẾ LẠI LUỒNG

## 9.1. Request contract

Không nhận:

```text
tongTien
item.gia
```

làm source of truth.

Có thể tạm cho frontend gửi để backward compatibility, nhưng backend **bỏ qua** chúng.

Target request:

```json
{
  "tenNguoiNhan": "Nguyen Van A",
  "sdt": "0912345678",
  "diaChiGiaoHang": "Ha Noi",
  "ghiChu": "",
  "maPTTT": 1,
  "items": [
    {
      "maSP": 10,
      "maSize": 2,
      "soLuongMua": 2
    }
  ]
}
```

## 9.2. Validation

Bổ sung:

- `tenNguoiNhan`: required, trim, giới hạn độ dài;
- `sdt`: format hợp lệ;
- `diaChiGiaoHang`: required;
- `maPTTT`: positive integer;
- `items`: min 1;
- `items.*.maSP`: positive integer;
- `items.*.maSize`: positive integer;
- `items.*.soLuongMua`: integer >= 1;
- reject duplicate `(maSP, maSize)` hoặc normalize trước xử lý.

Không còn bắt buộc:

```text
items.*.gia
```

## 9.3. Transaction algorithm

```text
BEGIN
  ↓
Validate payment method exists
  ↓
Normalize + sort items by maSP/maSize
  ↓
SELECT product + stock rows FOR UPDATE
  ↓
Validate every requested variant exists
  ↓
Validate stock for every item
  ↓
Read price from SanPham
  ↓
Calculate serverTotal = SUM(price * qty)
  ↓
INSERT DonHang
  ↓
INSERT ChiTietDonHang with server price snapshot
  ↓
UPDATE stock for every item
  ↓
DELETE purchased cart rows
  ↓
INSERT initial Audit record
  ↓
COMMIT
```

Nếu bất kỳ bước nào fail:

```text
ROLLBACK
```

## 9.4. Row locking

Query theo variant:

```sql
SELECT
    sp.maSP,
    sp.gia,
    ct.maSize,
    ct.soLuongTon
FROM SanPham sp
JOIN ChiTietSanPham ct ON ct.maSP = sp.maSP
WHERE (sp.maSP = ? AND ct.maSize = ?)
FOR UPDATE;
```

Với nhiều items:

- sort `(maSP, maSize)` theo thứ tự cố định;
- lock theo cùng thứ tự;
- giảm nguy cơ deadlock.

## 9.5. Stock update

Sau khi lock + validate:

```sql
UPDATE ChiTietSanPham
SET soLuongTon = soLuongTon - ?
WHERE maSP = ?
  AND maSize = ?;
```

Sau mỗi update vẫn kiểm tra:

```text
affectedRows === 1
```

Nếu không:

```text
throw STOCK_UPDATE_FAILED
```

## 9.6. Price snapshot

`ChiTietDonHang.giaMua` phải lưu giá sản phẩm tại thời điểm mua.

Không phụ thuộc giá sản phẩm sau này.

## 9.7. Total calculation

Phase 2:

```text
tongTien = SUM(giaMua * soLuongMua)
```

Voucher và shipping advanced để phase sau.

Nếu `phiGiaoHang` được dùng:

```text
tongTien = subtotal + phiGiaoHang
```

nhưng `phiGiaoHang` cũng phải do server quyết định.

---

# 10. CANCEL ORDER – ATOMIC & IDEMPOTENT

Tạo endpoint user:

```http
PUT /api/orders/:id/cancel
```

Hoặc:

```http
POST /api/orders/:id/cancel
```

Khuyến nghị dùng `PUT` theo style hiện tại.

## 10.1. User cancellation rule

User chỉ được hủy:

```text
own order
AND status == PENDING
```

Không cho hủy order của user khác.

## 10.2. Admin/Staff cancellation

Thông qua endpoint state update:

```text
PENDING -> CANCELLED
CONFIRMED -> CANCELLED
```

## 10.3. Atomic cancellation flow

```text
BEGIN
  ↓
SELECT DonHang FOR UPDATE
  ↓
Check existence
  ↓
Check ownership / role
  ↓
Check current state
  ↓
SELECT ChiTietDonHang
  ↓
Restore stock
  ↓
UPDATE status = CANCELLED
  ↓
INSERT audit
  ↓
COMMIT
```

Không bao giờ:

```text
UPDATE status
COMMIT
then restore stock asynchronously
```

## 10.4. Idempotency

Nếu đơn đã `CANCELLED`:

- không cộng kho;
- không ghi audit duplicate;
- trả `409 ORDER_ALREADY_CANCELLED`.

Test bắt buộc:

```text
cancel lần 1 -> stock +N
cancel lần 2 -> 409
stock không tăng thêm
```

---

# 11. UPDATE ORDER STATUS – STATE MACHINE

Endpoint:

```http
PUT /api/orders/:id/status
```

Body:

```json
{
  "trangThai": "Đã xác nhận",
  "lyDo": "Đã xác minh đơn"
}
```

## 11.1. Flow

```text
BEGIN
  ↓
SELECT order FOR UPDATE
  ↓
Validate target status is known
  ↓
Validate transition map
  ↓
If target CANCELLED -> restore stock
  ↓
UPDATE DonHang
  ↓
INSERT LichSuDonHang
  ↓
COMMIT
```

## 11.2. Không dùng client-provided arbitrary status

Validator nên dùng:

```js
.isIn(Object.values(ORDER_STATUS))
```

Business service tiếp tục kiểm tra transition.

Validator không thay State Machine.

---

# 12. ORDER AUDIT TRAIL

Audit phải ghi cho:

- order creation;
- admin/staff status change;
- user cancellation;
- admin/staff cancellation.

Minimum fields:

```text
maDonHang
trangThaiCu
trangThaiMoi
nguoiThayDoi
lyDo
thoiGian
```

### Initial record

Khi tạo đơn:

```text
null -> Chờ xác nhận
actor = userId
reason = ORDER_CREATED
```

### API đọc history

Đề xuất:

```http
GET /api/orders/:id/history
```

Quyền:

- owner: có thể xem history đơn của mình;
- staff/admin: xem mọi đơn.

Nếu scope team hạn chế, API history có thể P1 trong Phase 2, nhưng bảng audit và write path là P0.

---

# 13. ORDER FILTER FOR ADMIN/STAFF

Endpoint:

```http
GET /api/orders/admin/filter
```

Query:

```text
trangThai
fromDate
toDate
minTotal
maxTotal
keyword
page
limit
```

## 13.1. Rules

- parameterized SQL;
- `page >= 1`;
- `1 <= limit <= 100`;
- `minTotal >= 0`;
- `maxTotal >= minTotal`;
- date ISO hợp lệ;
- status phải thuộc state catalog.

## 13.2. Keyword

Có thể tìm:

```text
maDonHang
tenNguoiNhan
sdt
```

Không concatenate raw input vào SQL.

## 13.3. Response

```json
{
  "success": true,
  "code": "ORDER_LIST_SUCCESS",
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 0,
      "totalPages": 0
    }
  }
}
```

---

# 14. ERROR CODE CATALOG PHASE 2

Bổ sung constants:

```text
ORDER_CREATED
ORDER_NOT_FOUND
ORDER_ACCESS_DENIED
ORDER_INVALID_ITEM
ORDER_DUPLICATE_ITEM
ORDER_VARIANT_NOT_FOUND
INSUFFICIENT_STOCK
ORDER_TOTAL_CALCULATION_FAILED
INVALID_ORDER_STATUS
INVALID_ORDER_TRANSITION
ORDER_STATUS_UNCHANGED
ORDER_ALREADY_CANCELLED
ORDER_CANCEL_NOT_ALLOWED
PAYMENT_METHOD_NOT_FOUND
ORDER_TRANSACTION_FAILED
ORDER_HISTORY_FETCHED
ORDER_LIST_SUCCESS
```

HTTP mapping đề xuất:

| Tình huống | Status |
|---|---:|
| Invalid input | 400 |
| Unauthenticated | 401 |
| Wrong role / ownership | 403 |
| Order/product/payment method not found | 404 |
| Invalid transition / repeated cancel / business conflict | 409 |
| Unexpected server/DB failure | 500 |

---

# 15. TEST STRATEGY PHASE 2

Phase 2 phải được phát triển song song với test, không code xong mới test.

## 15.1. State Transition Testing

Bắt buộc cover:

```text
PENDING -> CONFIRMED       PASS
PENDING -> CANCELLED       PASS

CONFIRMED -> SHIPPING      PASS
CONFIRMED -> CANCELLED     PASS

SHIPPING -> COMPLETED      PASS

SHIPPING -> CANCELLED      FAIL
COMPLETED -> CANCELLED     FAIL
CANCELLED -> COMPLETED     FAIL
COMPLETED -> PENDING       FAIL
PENDING -> SHIPPING        FAIL
```

Pass rate:

```text
100% state matrix
```

---

## 15.2. Transaction rollback tests

### Case A – Item 2 hết hàng

Request gồm:

```text
Item A: đủ hàng
Item B: thiếu hàng
```

Expected:

```text
order không được tạo
order details không được tạo
stock A không đổi
stock B không đổi
cart không bị xóa
```

### Case B – Variant không tồn tại

Expected toàn transaction rollback.

### Case C – Payment method không tồn tại

Expected không tạo order.

---

## 15.3. Server-side pricing test

Client cố gửi:

```json
{
  "tongTien": 1000,
  "items": [
    {
      "maSP": 1,
      "maSize": 1,
      "soLuongMua": 2,
      "gia": 1
    }
  ]
}
```

Expected:

```text
backend bỏ qua giá/tổng giả
giaMua = DB product price
tongTien = DB price * quantity
```

---

## 15.4. Stock boundary tests

Giả sử tồn kho `N`.

Test:

```text
qty = 0      -> 400
qty = 1      -> success
qty = N      -> success
qty = N + 1  -> 409 INSUFFICIENT_STOCK
```

---

## 15.5. Duplicate item test

Request có hai dòng cùng:

```text
maSP + maSize
```

Chọn một policy và test cố định:

### Khuyến nghị

Reject:

```text
400 ORDER_DUPLICATE_ITEM
```

Giúp request deterministic và tránh ambiguity.

---

## 15.6. Ownership & RBAC

| Scenario | Expected |
|---|---|
| No token create order | 401 |
| User create own order | 201 |
| User get own orders | 200 |
| User cancel own PENDING | 200 |
| User cancel user khác | 403/404 theo policy |
| User update arbitrary status | 403 |
| Staff update valid status | 200 |
| Admin update valid status | 200 |
| Staff/Admin invalid transition | 409 |

---

## 15.7. Cancel idempotency

```text
Initial stock = 10
Order qty = 2
After order = 8
Cancel #1 = 10
Cancel #2 = still 10
```

Cancel #2 không được tạo movement/restore lần hai.

---

## 15.8. Audit tests

Sau chuỗi:

```text
Create
Confirm
Shipping
Complete
```

history phải đúng thứ tự:

```text
null -> PENDING
PENDING -> CONFIRMED
CONFIRMED -> SHIPPING
SHIPPING -> COMPLETED
```

Mỗi row có:

```text
actor
timestamp
old state
new state
```

---

# 16. CONCURRENCY TEST – CHỐNG OVERSELL

Postman/Newman thông thường không đủ mạnh để chứng minh race condition.

Tạo script nhỏ:

```text
tests/integration/order-concurrency.test.js
```

Scenario:

```text
stock = 1

Request A mua 1
Request B mua 1
chạy gần đồng thời
```

Expected:

```text
1 request success
1 request fail INSUFFICIENT_STOCK
final stock = 0
successful orders = 1
```

Không được:

```text
2 order success
stock < 0
```

Có thể chạy bằng:

```bash
npm run test:order-concurrency
```

Đây là gate quan trọng cho Phase 2.

---

# 17. POSTMAN/NEWMAN UPDATE

Mở rộng:

```text
tests/postman/ClothesShop.postman_collection.json
```

Thêm folder:

```text
Phase 2 - Order Integrity
├── Login User
├── Login Staff
├── Login Admin
├── Create Order
├── Create Order - Fake Price
├── Create Order - Insufficient Stock
├── Get My Orders
├── User Cancel Own Pending Order
├── User Cancel Again
├── Staff Confirm
├── Staff Ship
├── Staff Complete
├── Invalid Transition Tests
├── Order History
└── Admin Filter
```

Biến environment:

```text
phase2OrderId
phase2ProductId
phase2SizeId
initialStock
serverPrice
userToken
staffToken
adminToken
```

### Newman commands

Giữ:

```bash
npm run test:api
npm run test:api:report
```

Nếu cần tách:

```bash
npm run test:api:phase2
```

---

# 18. SEED DATA PHASE 2

Seed phải deterministic.

Thêm dữ liệu cho:

```text
user
staff
admin
product stock = 0
product stock = 1
product stock = 5
product stock = 10
payment method
pending order
confirmed order
shipping order
completed order
cancelled order
```

Mục tiêu:

- test không phụ thuộc dữ liệu manual;
- chạy lại Newman sau `db:reset` vẫn pass;
- có fixture rõ cho BVA và State Transition.

---

# 19. IMPLEMENTATION ORDER

Không triển khai Phase 2 ngẫu nhiên.

```text
Step 0  Security/pre-flight gate
        ↓
Step 1  DB pool + transaction helper
        ↓
Step 2  Order status constants + transition map
        ↓
Step 3  Migration 002 + audit table/index
        ↓
Step 4  Repository layer
        ↓
Step 5  OrderService createOrder transaction
        ↓
Step 6  Atomic cancel + ownership
        ↓
Step 7  Status transition + audit
        ↓
Step 8  Order history + admin filter
        ↓
Step 9  Controller response/error normalization
        ↓
Step 10 Postman/Newman Phase 2 suite
        ↓
Step 11 Concurrency test
        ↓
Step 12 Full regression
        ↓
Step 13 Docs + handoff Phase 3
```

---

# 20. TASK BREAKDOWN

| ID | Task | Priority | Dependency | Owner gợi ý |
|---|---|---:|---|---|
| P2-00 | Remove tracked `.env`, rotate secret nếu cần | P0 | None | Tech Lead |
| P2-01 | Refactor DB connection thành pool | P0 | P2-00 | Backend |
| P2-02 | Add transaction helper | P0 | P2-01 | Backend |
| P2-03 | Add `order-status.js` constants | P0 | None | Backend |
| P2-04 | Add transition map/helper | P0 | P2-03 | Backend |
| P2-05 | Add migration `002_order_integrity.sql` | P0 | None | Backend/DB |
| P2-06 | Add Order repository | P0 | P2-01, P2-05 | Backend |
| P2-07 | Refactor `createOrder` server-side pricing | P0 | P2-06 | Backend |
| P2-08 | Add stock row locking | P0 | P2-06 | Backend |
| P2-09 | Make create order fully transactional | P0 | P2-07, P2-08 | Backend |
| P2-10 | Make cart cleanup transactional | P0 | P2-09 | Backend |
| P2-11 | Add initial order audit | P0 | P2-05, P2-09 | Backend |
| P2-12 | Add user cancel endpoint | P0 | P2-09 | Backend |
| P2-13 | Add cancel idempotency | P0 | P2-12 | Backend |
| P2-14 | Refactor staff/admin state update | P0 | P2-04, P2-06 | Backend |
| P2-15 | Add audit on every transition | P0 | P2-14 | Backend |
| P2-16 | Add order history API | P1 | P2-15 | Backend |
| P2-17 | Add admin/staff filter + pagination | P1 | P2-06 | Backend |
| P2-18 | Remove `gia`/`tongTien` trust from validator | P0 | P2-07 | Backend |
| P2-19 | Normalize Order API response contract | P0 | P2-07..17 | Backend |
| P2-20 | Add deterministic Phase 2 seeds | P0 | P2-05 | Test/Backend |
| P2-21 | Add Postman State Transition suite | P0 | P2-14 | Test |
| P2-22 | Add rollback/data integrity tests | P0 | P2-09 | Test |
| P2-23 | Add cancel idempotency tests | P0 | P2-13 | Test |
| P2-24 | Add pricing tamper tests | P0 | P2-07 | Test |
| P2-25 | Add RBAC/ownership tests | P0 | P2-12,14 | Test |
| P2-26 | Add concurrency oversell script | P0 | P2-08,09 | Test/Backend |
| P2-27 | Run full Phase 1 regression | P0 | P2-01..26 | Test Lead |
| P2-28 | Update docs/runbook/API examples | P1 | All | Tech Lead |

---

# 21. SUGGESTED COMMITS

Branch:

```text
feat/phase-2-order-integrity
```

Commit sequence:

```text
chore: remove tracked environment file

refactor: use mysql connection pool for transactional workflows

feat: add order status domain and transition rules

chore: add order audit migration and indexes

refactor: add order repository and transaction helper

feat: make order creation transactional with server-side pricing

fix: lock stock rows and prevent overselling

feat: add atomic user order cancellation

feat: enforce order state machine and audit history

feat: add order history and admin filtering

refactor: normalize order api responses and errors

test: add phase 2 order state and rollback coverage

test: add concurrent stock integrity scenario

docs: add phase 2 order integrity implementation notes
```

---

# 22. PULL REQUEST STRATEGY

Nếu team nhỏ có thể dùng một branch Phase 2, nhưng PR phải review theo checkpoint.

## Checkpoint A – Data integrity foundation

Scope:

```text
pool
transaction helper
migration
repository
```

Gate:

```text
DB reset pass
Phase 1 smoke pass
```

## Checkpoint B – Create order integrity

Scope:

```text
server price
stock lock
transaction
cart cleanup
audit create
```

Gate:

```text
rollback tests pass
fake-price test pass
stock BVA pass
```

## Checkpoint C – State lifecycle

Scope:

```text
state machine
cancel
audit
history
filter
```

Gate:

```text
state matrix 100%
cancel idempotency pass
RBAC pass
```

## Checkpoint D – QA

Scope:

```text
Newman
concurrency
regression
docs
```

Gate:

```text
no S1/S2
```

---

# 23. DEFINITION OF DONE – PHASE 2

Phase 2 chỉ Done nếu toàn bộ checklist dưới đây đạt.

## Security / Hygiene

- [ ] `backend/.env` không còn tracked.
- [ ] Không log secret/DB password/JWT.
- [ ] Không trả raw SQL error cho client.

## Create Order

- [ ] Client không quyết định `tongTien`.
- [ ] Client không quyết định `giaMua`.
- [ ] Backend đọc giá từ DB.
- [ ] Backend kiểm tra variant tồn tại.
- [ ] Backend kiểm tra stock.
- [ ] Order + details + stock + cart + audit cùng transaction.
- [ ] Bất kỳ lỗi nào cũng rollback.
- [ ] Không thể tạo successful order với insufficient stock.

## Concurrency

- [ ] Có row lock hoặc cơ chế tương đương.
- [ ] Hai request tranh stock=1 chỉ một request thành công.
- [ ] Tồn kho không âm.

## State Machine

- [ ] Chỉ transition hợp lệ được phép.
- [ ] Terminal state không chuyển tiếp.
- [ ] Same-state update không được silently accepted.
- [ ] Unknown status bị reject.

## Cancellation

- [ ] User chỉ hủy order của mình.
- [ ] User chỉ hủy PENDING.
- [ ] Staff/Admin cancel theo policy.
- [ ] Restore stock cùng transaction.
- [ ] Cancel lần hai không restore lại stock.

## Audit

- [ ] Create order có audit.
- [ ] Mọi status change có audit.
- [ ] Actor được ghi nhận.
- [ ] Old/new status chính xác.
- [ ] Audit không tạo duplicate do retry logic thông thường.

## Filtering

- [ ] Filter parameterized.
- [ ] Pagination hoạt động.
- [ ] Date/status/total/keyword filter có test.

## Testing

- [ ] State Transition matrix pass 100%.
- [ ] Transaction rollback suite pass 100%.
- [ ] Pricing tamper test pass.
- [ ] Ownership/RBAC pass.
- [ ] Cancel idempotency pass.
- [ ] Concurrency test pass.
- [ ] Phase 1 smoke regression vẫn pass.
- [ ] Newman report sinh thành công.

---

# 24. RELEASE GATE

Không merge vào `main` nếu còn bất kỳ lỗi sau:

```text
S1:
- server crash
- transaction để lại dữ liệu nửa chừng
- credential leak

S2:
- oversell
- stock âm
- fake price được chấp nhận
- cancel cộng kho nhiều lần
- user thao tác order của người khác
- invalid transition vẫn thành công
```

S3 có thể defer nếu có issue rõ ràng, owner và plan.

---

# 25. RỦI RO & BIỆN PHÁP

| Rủi ro | Khả năng | Ảnh hưởng | Biện pháp |
|---|---:|---:|---|
| Refactor DB connection làm regression module khác | Medium | High | `createPool` giữ callback query compatible + full smoke |
| Deadlock khi nhiều items | Low/Medium | High | Lock variants theo thứ tự cố định, rollback |
| Frontend vẫn gửi `gia/tongTien` | High | Low | Backend ignore, giữ compatibility tạm thời |
| Status string phụ thuộc UI cũ | High | Medium | Giữ Vietnamese DB values trong Phase 2, centralize constants |
| Test data bị bẩn giữa lần chạy | High | Medium | deterministic seed + reset |
| Audit table làm lỗi FK actor | Low | Medium | `ON DELETE SET NULL` |
| Retry request cancel | Medium | High | lock order + terminal state check |
| Long transaction | Medium | Medium | validate trước phần có thể validate, transaction chỉ bao vùng DB critical |

---

# 26. HANDOFF SANG PHASE 3

Phase 3 chỉ bắt đầu khi Phase 2 đạt release gate.

Khi đó nền tảng có thể mở rộng:

```text
Inventory Movement
Goods Receipt
Stock Adjustment
Low Stock
Order Sale Movement
Cancel Return Movement
```

Điểm quan trọng:

Phase 2 đã bảo đảm Order là source tạo thay đổi stock an toàn.  
Phase 3 chỉ cần thay phần stock write trực tiếp bằng movement ledger mà không phải sửa lại toàn bộ lifecycle Order.

Target sau Phase 3:

```text
Order transaction-safe
        +
Inventory movement traceable
        =
Business Integrity Ready
```

---

# 27. KẾT LUẬN TECH LEAD

Phase tiếp theo **không nên đi thẳng sang Voucher, Dashboard hay UI mới**.

Repo hiện tại cần khóa chặt `Order` trước vì đây là module giao nhau giữa:

```text
User
Cart
Product
Stock
Payment Method
Authorization
Data Integrity
Testing
```

Thứ tự ưu tiên của Phase 2:

```text
1. Security pre-flight
2. Transaction
3. Server-side pricing
4. Stock locking
5. State Machine
6. Atomic cancellation
7. Audit Trail
8. Order filtering
9. Automated integrity tests
10. Concurrency gate
```

Nếu Phase 2 hoàn thành đúng kế hoạch, project sẽ có đủ chiều sâu để thực hành và chứng minh các kỹ thuật:

```text
State Transition Testing
Boundary Value Analysis
RBAC Testing
Negative API Testing
Transaction/Data Integrity Testing
Concurrency Testing
End-to-End Testing
```

Đây là bước chuyển quan trọng từ một project CRUD kế thừa sang một hệ thống đủ ổn định để tiếp tục Phase 3 – Inventory & Goods Receipt.
