# PHASE 2 TEST PLAN
# ORDER INTEGRITY, STATE MACHINE & TRANSACTION

**Project:** `ManhT005/Kiem-thu-nhom-3`  
**Phase:** Phase 2 – Order Integrity, State Machine & Transaction  
**Baseline:** `main @ 76ae4ce23fc987ea04b423da7230e6988bfd0d9d`  
**Test Lead scope:** Order, Stock, Transaction, State Machine, Cancellation, Audit Trail, RBAC/Ownership, Filtering, Regression  
**Primary tools:** Postman, Newman, MySQL, Node.js  
**Related documents:** `MASTER_TEST_PLAN.md`, `04_PHASE_2_ORDER_INTEGRITY_PLAN.md`

---

# 1. MỤC TIÊU KIỂM THỬ

Phase 2 phải chứng minh rằng module Order hoạt động đúng không chỉ ở happy path mà còn trong các tình huống lỗi, rollback và tranh chấp tài nguyên.

Mục tiêu chính:

1. Xác nhận backend là **source of truth** cho giá và tổng tiền.
2. Xác nhận tạo đơn hàng là **atomic transaction**.
3. Xác nhận hệ thống không cho phép **oversell**.
4. Xác nhận Order State Machine chỉ cho phép các transition hợp lệ.
5. Xác nhận hủy đơn là **atomic + idempotent**.
6. Xác nhận toàn bộ thay đổi trạng thái được ghi Audit Trail.
7. Xác nhận ownership và RBAC đúng.
8. Xác nhận filter/pagination hoạt động đúng.
9. Xác nhận Phase 2 không làm regression các chức năng Phase 1.
10. Xác nhận bộ test có thể chạy lặp lại bằng Newman trên dữ liệu deterministic.

---

# 2. PHẠM VI KIỂM THỬ

## 2.1. In Scope

### A. Create Order

```http
POST /api/orders/create
```

Kiểm thử:

- authentication;
- request validation;
- server-side price;
- server-side total;
- product/variant validation;
- stock validation;
- transaction;
- cart cleanup;
- initial audit;
- rollback.

### B. Get My Orders

```http
GET /api/orders/my-orders
```

Kiểm thử:

- chỉ trả đơn của user hiện tại;
- structure dữ liệu;
- dữ liệu order detail;
- không leak order user khác.

### C. Cancel Order

```http
PUT /api/orders/:id/cancel
```

Kiểm thử:

- ownership;
- status rule;
- restore stock;
- atomic transaction;
- idempotency;
- audit.

### D. Staff/Admin State Update

```http
PUT /api/orders/:id/status
```

Kiểm thử:

- RBAC;
- State Machine;
- terminal states;
- invalid transition;
- cancellation restore stock;
- audit.

### E. Order History

```http
GET /api/orders/:id/history
```

Kiểm thử:

- owner access;
- admin/staff access;
- unauthorized access;
- chronology;
- old/new state;
- actor;
- timestamp.

### F. Admin/Staff Filter

```http
GET /api/orders/admin/filter
```

Kiểm thử:

- status;
- date range;
- min/max total;
- keyword;
- pagination;
- combined filter;
- invalid parameters.

### G. Data Integrity

Kiểm thử:

- DonHang;
- ChiTietDonHang;
- ChiTietSanPham;
- ChiTietGioHang;
- LichSuDonHang.

### H. Concurrency

Kiểm thử:

- hai request cùng mua stock cuối;
- không stock âm;
- không tạo hai successful order khi chỉ còn một đơn vị tồn.

---

## 2.2. Out of Scope

Không kiểm thử sâu trong Phase 2:

- Voucher;
- Goods Receipt;
- Inventory Movement đầy đủ;
- Dashboard;
- MoMo IPN;
- load test quy mô lớn;
- UI/UX browser;
- security penetration test chuyên sâu.

---

# 3. TEST APPROACH

Phase 2 sử dụng kết hợp:

```text
Equivalence Partitioning
Boundary Value Analysis
State Transition Testing
Negative Testing
RBAC Testing
Ownership Testing
Transaction Testing
Data Integrity Testing
Concurrency Testing
Regression Testing
End-to-End Testing
```

---

# 4. ENTRY CRITERIA

Chỉ bắt đầu test chính thức khi:

- [ ] branch Phase 2 build/start thành công;
- [ ] migration Phase 2 chạy thành công;
- [ ] seed data Phase 2 có thể reset;
- [ ] `.env` không còn được Git track;
- [ ] API Order không trả raw SQL error;
- [ ] Postman environment có đủ account user/staff/admin;
- [ ] tester có DB access để đối chiếu data integrity;
- [ ] route và API contract Phase 2 đã được chốt;
- [ ] không còn blocker ở Phase 1 smoke suite.

---

# 5. TEST ENVIRONMENT

## 5.1. Backend

```text
Node.js 18+
Express
mysql2
```

## 5.2. Database

```text
MySQL 8.x
Database: clothes_db
```

## 5.3. API Base URL

```text
http://localhost:3000/api
```

## 5.4. Tools

```text
Postman Desktop
Newman
newman-reporter-htmlextra
MySQL Workbench / CLI
Node.js concurrency script
```

---

# 6. TEST DATA STRATEGY

Test data phải deterministic.

## 6.1. Accounts

| Role | Mục đích |
|---|---|
| userA | tạo/hủy order của chính mình |
| userB | kiểm thử ownership |
| staff | cập nhật trạng thái |
| admin | full access |

---

## 6.2. Product Fixtures

| Product | Stock | Mục đích |
|---|---:|---|
| P_ZERO | 0 | Out of stock |
| P_ONE | 1 | Concurrency |
| P_FIVE | 5 | Boundary |
| P_TEN | 10 | Standard happy path |

Mỗi product cần ít nhất một size hợp lệ.

---

## 6.3. Order Fixtures

Tạo sẵn:

```text
ORDER_PENDING
ORDER_CONFIRMED
ORDER_SHIPPING
ORDER_COMPLETED
ORDER_CANCELLED
```

Dùng cho State Transition Testing.

---

## 6.4. Payment Fixtures

Ít nhất:

```text
valid payment method
invalid payment method ID
```

---

# 7. PRIORITY MODEL

## P0 – Critical

Phải pass trước merge:

- transaction rollback;
- server-side pricing;
- stock correctness;
- concurrency;
- cancel idempotency;
- ownership;
- RBAC;
- State Machine.

## P1 – High

Phải pass trước release:

- audit trail;
- history;
- filter;
- pagination;
- API contract.

## P2 – Medium

Có thể sửa sau nếu không ảnh hưởng correctness:

- error message wording;
- optional filter UX;
- minor response metadata.

---

# 8. CREATE ORDER TEST MATRIX

## 8.1. Authentication

| ID | Scenario | Expected |
|---|---|---|
| ORD-AUTH-01 | Không token | `401` |
| ORD-AUTH-02 | Token invalid | `401` |
| ORD-AUTH-03 | Token hợp lệ | Request được xử lý |

---

## 8.2. Required Fields

| ID | Input | Expected |
|---|---|---|
| ORD-VAL-01 | thiếu `items` | `400 VALIDATION_ERROR` |
| ORD-VAL-02 | `items=[]` | `400` |
| ORD-VAL-03 | thiếu `tenNguoiNhan` | `400` |
| ORD-VAL-04 | thiếu `sdt` | `400` |
| ORD-VAL-05 | thiếu `diaChiGiaoHang` | `400` |
| ORD-VAL-06 | invalid `maPTTT` type | `400` |

---

## 8.3. Quantity BVA

Giả sử stock = `N`.

| ID | Qty | Expected |
|---|---:|---|
| ORD-BVA-01 | 0 | `400` |
| ORD-BVA-02 | 1 | Success |
| ORD-BVA-03 | N | Success |
| ORD-BVA-04 | N+1 | `409 INSUFFICIENT_STOCK` |

---

## 8.4. Product/Variant

| ID | Scenario | Expected |
|---|---|---|
| ORD-PROD-01 | Product không tồn tại | `404` |
| ORD-PROD-02 | Size không tồn tại | `404` |
| ORD-PROD-03 | Product tồn tại nhưng variant không tồn tại | `404 ORDER_VARIANT_NOT_FOUND` |
| ORD-PROD-04 | Stock = 0 | `409 INSUFFICIENT_STOCK` |
| ORD-PROD-05 | Duplicate maSP + maSize trong request | `400 ORDER_DUPLICATE_ITEM` hoặc policy đã chốt |

---

# 9. SERVER-SIDE PRICING TESTS

Đây là nhóm test Critical.

## TC-PRICE-01 – Fake item price

Client gửi:

```json
{
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
giaMua lưu trong DB = giá SanPham
không phải 1
```

---

## TC-PRICE-02 – Fake order total

Client gửi:

```json
{
  "tongTien": 1000
}
```

Expected:

```text
DonHang.tongTien = SUM(DB_price × quantity)
```

---

## TC-PRICE-03 – Product price thay đổi

1. Lấy giá hiện tại.
2. Tạo order.
3. Admin đổi giá product.
4. Kiểm tra order cũ.

Expected:

```text
ChiTietDonHang.giaMua không đổi
```

---

# 10. TRANSACTION TEST MATRIX

## 10.1. Happy Path

### TC-TXN-01

Input:

```text
2 items hợp lệ
stock đủ
payment hợp lệ
```

Expected:

```text
DonHang +1
ChiTietDonHang đúng số dòng
Stock giảm đúng
Cart items bị xóa
Audit create được ghi
Transaction commit
```

---

## 10.2. Rollback – Item 2 hết hàng

### TC-TXN-02

Input:

```text
Item A: đủ stock
Item B: thiếu stock
```

Expected:

```text
không có DonHang mới
không có ChiTietDonHang
stock A không đổi
stock B không đổi
cart không đổi
không có audit mới
```

---

## 10.3. Rollback – Variant không tồn tại

### TC-TXN-03

Expected:

```text
toàn bộ rollback
```

---

## 10.4. Rollback – Payment invalid

### TC-TXN-04

Expected:

```text
không insert order
không trừ stock
```

---

## 10.5. Rollback – Simulated DB failure

Nếu team có test hook/dev-only failure injection:

```text
fail sau INSERT DonHang
```

Expected:

```text
rollback toàn bộ
```

Nếu không có hook, có thể test bằng fixture vi phạm FK.

---

# 11. CART INTEGRITY TESTS

| ID | Scenario | Expected |
|---|---|---|
| CART-01 | Checkout thành công | item đã mua bị xóa khỏi cart |
| CART-02 | Checkout rollback | cart giữ nguyên |
| CART-03 | Cart không tồn tại nhưng request order hợp lệ | xử lý theo contract đã chốt |
| CART-04 | Cart chứa item khác không checkout | item khác không bị xóa |

---

# 12. STATE TRANSITION TEST MATRIX

## 12.1. Valid Transitions

| ID | From | To | Expected |
|---|---|---|---|
| ST-01 | PENDING | CONFIRMED | 200 |
| ST-02 | PENDING | CANCELLED | 200 |
| ST-03 | CONFIRMED | SHIPPING | 200 |
| ST-04 | CONFIRMED | CANCELLED | 200 |
| ST-05 | SHIPPING | COMPLETED | 200 |

---

## 12.2. Invalid Transitions

| ID | From | To | Expected |
|---|---|---|---|
| ST-06 | PENDING | SHIPPING | 409 |
| ST-07 | PENDING | COMPLETED | 409 |
| ST-08 | CONFIRMED | COMPLETED | 409 |
| ST-09 | SHIPPING | CANCELLED | 409 |
| ST-10 | COMPLETED | CANCELLED | 409 |
| ST-11 | COMPLETED | PENDING | 409 |
| ST-12 | CANCELLED | PENDING | 409 |
| ST-13 | CANCELLED | COMPLETED | 409 |
| ST-14 | PENDING | PENDING | 409 |
| ST-15 | unknown | arbitrary status | 400 |

---

# 13. CANCELLATION TEST PLAN

## 13.1. User Cancel

| ID | Scenario | Expected |
|---|---|---|
| CAN-01 | User hủy own PENDING | 200 |
| CAN-02 | User hủy own CONFIRMED | reject theo policy |
| CAN-03 | User hủy own SHIPPING | 409 |
| CAN-04 | User hủy own COMPLETED | 409 |
| CAN-05 | User hủy own CANCELLED | 409 |
| CAN-06 | UserA hủy order UserB | 403 hoặc 404 theo policy |

---

## 13.2. Stock Restore

Ví dụ:

```text
Initial stock = 10
Order qty = 3
After order = 7
Cancel = 10
```

Expected:

```text
restore đúng 3
```

---

## 13.3. Idempotency

### TC-CAN-IDEMP-01

```text
Initial stock = 10
Order qty = 2
After order = 8
Cancel #1 -> 10
Cancel #2 -> 409
Final stock -> 10
```

Không được:

```text
12
```

---

# 14. RBAC TEST MATRIX

| Endpoint | No Auth | User | Staff | Admin |
|---|---:|---:|---:|---:|
| Create Order | 401 | 201 | theo policy | theo policy |
| My Orders | 401 | 200 | 200 nếu policy cho phép | 200 nếu policy cho phép |
| Cancel Own Pending | 401 | 200 | N/A | N/A |
| Update Status | 401 | 403 | 200 | 200 |
| Admin Filter | 401 | 403 | 200 | 200 |
| Order History own | 401 | 200 | 200 | 200 |
| Order History other user | 401 | 403/404 | 200 | 200 |

Kết quả cuối phải bám đúng policy backend đã chốt.

---

# 15. OWNERSHIP TESTING

Mục tiêu:

```text
user chỉ truy cập order của chính mình
```

Test:

```text
UserA create OrderA
UserB create OrderB
UserA request OrderB history
UserA cancel OrderB
```

Expected:

```text
không được truy cập hoặc sửa OrderB
```

Không leak:

```text
recipient
phone
address
items
audit
```

---

# 16. AUDIT TRAIL TESTS

## 16.1. Create Audit

Sau create:

```text
oldStatus = null
newStatus = PENDING
actor = userId
```

---

## 16.2. State Change Audit

Chuỗi:

```text
PENDING -> CONFIRMED
CONFIRMED -> SHIPPING
SHIPPING -> COMPLETED
```

Expected:

```text
3 transition audit + 1 initial audit
```

---

## 16.3. Cancel Audit

Expected:

```text
oldState đúng
newState = CANCELLED
actor đúng
timestamp hợp lệ
```

---

## 16.4. No Duplicate Audit

Retry invalid transition:

```text
CANCELLED -> CANCELLED
```

Expected:

```text
không insert audit mới
```

---

# 17. ORDER HISTORY TESTS

| ID | Scenario | Expected |
|---|---|---|
| HIST-01 | Owner xem history | 200 |
| HIST-02 | Staff xem history | 200 |
| HIST-03 | Admin xem history | 200 |
| HIST-04 | User khác xem | 403/404 |
| HIST-05 | Order không tồn tại | 404 |
| HIST-06 | History sort | chronological |
| HIST-07 | Actor deleted nếu FK SET NULL | history vẫn tồn tại |

---

# 18. FILTER TEST PLAN

Endpoint:

```http
GET /api/orders/admin/filter
```

## 18.1. Status Filter

```text
?trangThai=Chờ xác nhận
```

Expected:

```text
100% items trả về đúng status
```

---

## 18.2. Date Filter

Test:

```text
fromDate only
toDate only
fromDate + toDate
fromDate > toDate
invalid date
```

Expected:

- valid range -> correct result;
- invalid range -> 400.

---

## 18.3. Total Filter

Boundary:

```text
minTotal = 0
minTotal = exact order total
maxTotal = exact order total
minTotal > maxTotal
negative
```

---

## 18.4. Keyword

Tìm:

```text
maDonHang
tenNguoiNhan
sdt
```

Kiểm tra partial match theo contract.

---

## 18.5. Pagination

Boundary:

```text
page = 0
page = 1
limit = 0
limit = 1
limit = 100
limit = 101
```

Expected:

```text
invalid boundaries -> 400
valid -> correct pagination metadata
```

---

# 19. CONCURRENCY TEST PLAN

Đây là Critical Gate.

## 19.1. Oversell Scenario

Precondition:

```text
P_ONE stock = 1
```

Chạy gần đồng thời:

```text
Request A: buy 1
Request B: buy 1
```

Expected:

```text
1 success
1 fail INSUFFICIENT_STOCK
final stock = 0
successful DonHang count = 1
```

---

## 19.2. Repeated Runs

Chạy scenario ít nhất:

```text
10 lần sau mỗi DB reset
```

Mục tiêu:

```text
0 oversell occurrence
```

---

## 19.3. Multi-item Lock Order

Request A:

```text
Product 1 + Product 2
```

Request B:

```text
Product 2 + Product 1
```

Expected:

```text
không deadlock kéo dài
nếu deadlock xảy ra -> rollback sạch
không partial commit
```

---

# 20. DATABASE ASSERTIONS

Tester không chỉ kiểm tra HTTP response.

Sau mỗi Critical test cần đối chiếu DB.

## Create Success

Kiểm tra:

```sql
SELECT * FROM DonHang WHERE maDonHang = ?;
SELECT * FROM ChiTietDonHang WHERE maDonHang = ?;
SELECT * FROM LichSuDonHang WHERE maDonHang = ?;
SELECT soLuongTon FROM ChiTietSanPham WHERE maSP = ? AND maSize = ?;
```

## Rollback

Expected:

```text
không có orphan DonHang
không có orphan ChiTietDonHang
stock không đổi
audit không tồn tại
```

---

# 21. API CONTRACT TESTING

Mỗi response phải có contract thống nhất.

Success:

```json
{
  "success": true,
  "code": "...",
  "message": "...",
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "code": "...",
  "message": "...",
  "errors": []
}
```

Test:

- HTTP status;
- `success`;
- `code`;
- `data/errors`;
- `Content-Type`;
- không raw SQL;
- không stack trace.

---

# 22. NEGATIVE TESTING

Bắt buộc test:

```text
invalid JSON
missing body
string thay number
negative quantity
float quantity
invalid ID
very large ID
unknown order
unknown product
unknown payment method
unknown status
duplicate item
wrong ownership
wrong role
```

---

# 23. E2E WORKFLOW

## E2E-ORD-01 – Successful lifecycle

```text
1. Reset DB
2. Login user
3. Get product stock
4. Create order
5. Verify stock decreased
6. Verify order created
7. Verify initial audit
8. Login staff
9. Confirm
10. Ship
11. Complete
12. Verify audit history
13. Verify final order state
```

---

## E2E-ORD-02 – Cancel lifecycle

```text
1. Reset DB
2. Login user
3. Get stock
4. Create order
5. Verify stock decreased
6. Cancel own pending order
7. Verify stock restored
8. Cancel again
9. Verify 409
10. Verify stock unchanged
11. Verify audit count
```

---

## E2E-ORD-03 – Transaction rollback

```text
1. Reset DB
2. Create request with one valid + one insufficient item
3. Send create order
4. Verify failure
5. Check no order
6. Check no details
7. Check all stock unchanged
8. Check cart unchanged
9. Check no audit
```

---

# 24. POSTMAN COLLECTION STRUCTURE

Đề xuất:

```text
Phase 2 - Order Integrity
│
├── 00 Setup
│   ├── Login User A
│   ├── Login User B
│   ├── Login Staff
│   └── Login Admin
│
├── 01 Create Order
│   ├── Happy Path
│   ├── Fake Price
│   ├── Fake Total
│   ├── Invalid Product
│   ├── Invalid Variant
│   ├── Stock 0
│   ├── Stock Boundary
│   └── Duplicate Item
│
├── 02 Transaction
│   ├── Multi-item Success
│   ├── Item 2 Insufficient
│   └── Invalid Payment
│
├── 03 Cancellation
│   ├── User Own Pending
│   ├── User Other Order
│   ├── Repeat Cancel
│   └── Cancel Invalid State
│
├── 04 State Machine
│   ├── Valid Transitions
│   └── Invalid Transitions
│
├── 05 Audit
│   ├── Create History
│   ├── Transition History
│   └── Ownership
│
├── 06 Filter
│   ├── Status
│   ├── Date
│   ├── Total
│   ├── Keyword
│   └── Pagination
│
└── 07 E2E
    ├── Lifecycle Complete
    ├── Lifecycle Cancel
    └── Rollback Flow
```

---

# 25. NEWMAN EXECUTION

## Standard Regression

```bash
npm run test:api
```

## HTML Report

```bash
npm run test:api:report
```

## Phase 2 riêng

Khuyến nghị thêm:

```json
{
  "scripts": {
    "test:api:phase2": "newman run tests/postman/ClothesShop.postman_collection.json -e tests/postman/local.postman_environment.json --folder \"Phase 2 - Order Integrity\" --reporters cli"
  }
}
```

---

# 26. CONCURRENCY SCRIPT

Tạo:

```text
tests/integration/order-concurrency.test.js
```

Script cần:

1. login;
2. xác định product stock=1;
3. gửi 2 request bằng `Promise.allSettled`;
4. assert 1 success + 1 fail;
5. query/check final stock;
6. in summary;
7. exit code `1` nếu oversell.

Script này nên chạy riêng:

```bash
npm run test:order-concurrency
```

---

# 27. REGRESSION SCOPE PHASE 1

Sau mỗi thay đổi transaction/db pool cần chạy lại:

```text
Auth
RBAC
Product read
Product CRUD
Cart
Inventory protected route
Health
DB reset
Postman smoke
```

Đặc biệt chú ý refactor `createConnection -> createPool` có thể gây regression toàn backend.

---

# 28. DEFECT SEVERITY

## S1 – Blocker

- server crash;
- DB transaction corrupt;
- credential leak;
- migration làm project không start.

## S2 – Critical

- oversell;
- stock âm;
- fake price được chấp nhận;
- partial commit;
- repeated cancel cộng kho nhiều lần;
- ownership bypass;
- user update status được;
- rollback không sạch.

## S3 – Major

- invalid transition được chấp nhận;
- audit thiếu;
- filter sai;
- pagination sai;
- response contract sai.

## S4 – Minor

- wording;
- message typo;
- optional metadata.

---

# 29. DEFECT REPORT TEMPLATE

```text
ID:
Title:
Module:
Severity:
Priority:
Environment:
Precondition:
Steps:
Actual:
Expected:
API:
Request:
Response:
DB Evidence:
Screenshot/Log:
Commit:
Assignee:
Status:
```

Với defect Data Integrity phải luôn kèm:

```text
Before DB state
After DB state
```

---

# 30. TRACEABILITY MATRIX

| Requirement Phase 2 | Test Group |
|---|---|
| Server-side price | PRICE |
| Server-side total | PRICE |
| Atomic create | TXN |
| Stock validation | BVA + TXN |
| Row locking | CONC |
| Order State Machine | ST |
| User cancel | CAN |
| Cancel idempotency | CAN |
| Audit Trail | AUD |
| Ownership | OWN |
| RBAC | RBAC |
| Admin filter | FILTER |
| Regression | REG |
| E2E | E2E |

---

# 31. EXECUTION ORDER

```text
1. Environment smoke
2. DB reset/seed verification
3. Auth/RBAC smoke
4. Create Order validation
5. Server-side pricing
6. Transaction rollback
7. Stock boundary
8. Cancellation
9. State Machine
10. Audit
11. Ownership
12. Filter
13. E2E
14. Concurrency
15. Full regression
16. Newman HTML report
```

Không chạy concurrency trước khi transaction tests cơ bản pass.

---

# 32. TEST DELIVERABLES

Phase 2 Test Team phải bàn giao:

```text
docs/PHASE_2_TEST_PLAN.md
tests/postman/ClothesShop.postman_collection.json
tests/postman/local.postman_environment.json
tests/integration/order-concurrency.test.js
reports/Phase2_API_Test_Report.html
reports/PHASE_2_TEST_REPORT.md
```

Nếu team quản lý bug riêng:

```text
reports/PHASE_2_DEFECT_LOG.md
```

---

# 33. EXIT CRITERIA

Phase 2 chỉ được sign-off khi:

## Functional

- [ ] 100% valid State Transition pass.
- [ ] 100% invalid State Transition bị chặn.
- [ ] server-side pricing pass.
- [ ] server-side total pass.
- [ ] cancel đúng business rule.

## Data Integrity

- [ ] 100% rollback scenarios pass.
- [ ] không partial order.
- [ ] không stock âm.
- [ ] không double restore stock.
- [ ] audit đúng dữ liệu.

## Security

- [ ] ownership pass.
- [ ] RBAC pass.
- [ ] no raw DB error.
- [ ] `.env` không tracked.

## Concurrency

- [ ] stock=1 scenario không oversell.
- [ ] chạy lặp ít nhất 10 lần không xuất hiện double-success.

## Automation

- [ ] Newman Phase 2 chạy độc lập.
- [ ] HTML report sinh thành công.
- [ ] Phase 1 regression pass.

## Defect Gate

```text
S1 = 0
S2 = 0
S3 = 0 hoặc có acceptance rõ ràng từ Tech Lead
```

Khuyến nghị:

```text
Phase 2 automated pass rate = 100%
```

cho toàn bộ P0 tests.

---

# 34. RELEASE DECISION

## GO

Cho phép merge khi:

```text
P0 tests 100% pass
No S1
No S2
Concurrency pass
Rollback pass
State Matrix pass
Regression pass
```

## NO-GO

Không merge nếu còn:

```text
oversell
partial commit
fake price
double stock restore
ownership bypass
invalid state transition accepted
database inconsistent
```

---

# 35. PHÂN CÔNG GỢI Ý

| Role | Trách nhiệm |
|---|---|
| Test Lead | test strategy, gate, defect triage, sign-off |
| Tester 1 | Postman Create Order + Validation + Pricing |
| Tester 2 | State Machine + Cancel + RBAC |
| Backend Dev | test fixture, transaction hooks, bug fix |
| Tech Lead | resolve business-rule ambiguity |
| Test/Backend phối hợp | concurrency + DB integrity |

Với team nhỏ, có thể chia theo workstream thay vì người.

---

# 36. CHECKLIST TRƯỚC MERGE

```text
[ ] DB reset clean
[ ] Seed deterministic
[ ] Phase 1 smoke pass
[ ] Phase 2 create order pass
[ ] Pricing tamper pass
[ ] Transaction rollback pass
[ ] Stock BVA pass
[ ] User cancellation pass
[ ] Cancel idempotency pass
[ ] State matrix pass
[ ] Ownership pass
[ ] RBAC pass
[ ] Audit pass
[ ] Filter pass
[ ] E2E complete flow pass
[ ] E2E cancel flow pass
[ ] Concurrency pass
[ ] Newman HTML report generated
[ ] S1 = 0
[ ] S2 = 0
```

---

# 37. KẾT LUẬN TEST LEAD

Phase 2 không nên được đánh giá chỉ bằng việc:

```text
"đặt hàng được"
```

Mà phải chứng minh được:

```text
đặt hàng đúng giá
+ không bán quá tồn
+ lỗi thì rollback
+ hủy không cộng kho hai lần
+ trạng thái không đi sai luồng
+ user không sửa dữ liệu người khác
+ mọi thay đổi đều trace được
```

Đây là phase quan trọng nhất về **Data Integrity** của toàn project.

Nếu bộ test Phase 2 đạt gate, team có thể chuyển sang Phase 3 – Inventory & Goods Receipt với nền tảng Order đủ tin cậy.
