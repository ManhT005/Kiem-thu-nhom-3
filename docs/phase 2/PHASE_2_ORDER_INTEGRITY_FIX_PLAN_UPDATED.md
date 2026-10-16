# PHASE 2 FIX PLAN — ORDER INTEGRITY

**Project:** `ManhT005/Kiem-thu-nhom-3`  
**Branch:** `feature/phase-2-order-integrity`  
**Reviewed HEAD:** `aa2b5ab92110f4018702ca6c86f81fc947978084`  
**Compared with:** `main`  
**Current branch state:** `diverged`, ahead `10`, behind `2`  
**Review scope:** Order Integrity, Transaction, State Machine, RBAC, Test Automation, Frontend integration  
**Release status:** `BLOCKED`

---

# 1. KẾT LUẬN HIỆN TẠI

Core backend của Phase 2 đã đi đúng hướng:

```text
Controller
  ↓
Service
  ↓
Repository
  ↓
Transaction
  ↓
MySQL row locks
```

Các phần đã có và nhìn chung đúng kiến trúc:

- server-side pricing;
- bỏ tin `tongTien` từ client;
- lock variant bằng `SELECT ... FOR UPDATE`;
- sắp xếp `(maSP, maSize)` trước khi lock;
- kiểm tra tồn kho;
- transaction create order;
- State Machine;
- atomic cancellation;
- chống double stock restore;
- ownership;
- audit trail;
- order history;
- filter + pagination;
- transaction helper dùng connection riêng.

Tuy nhiên branch **chưa nên merge** vì các blocker về reproducibility, integration test và release evidence vẫn còn nguyên ở HEAD mới nhất.

Hai commit sau report cũ:

```text
3b4d4e1  refactor: refactor docs based on phase process
aa2b5ab  style: format phase 2 order implementation
```

không xử lý các defect chức năng bên dưới.

---

# 2. DEFECT / GAP SUMMARY

| ID | Priority | Area | Vấn đề | Merge blocker |
|---|---:|---|---|---|
| P2-FIX-01 | P0 | DB Tooling | `db:reset` / `db:seed` resolve sai đường dẫn | YES |
| P2-FIX-02 | P0 | API Test | Postman Phase 2 mới chủ yếu test `401` | YES |
| P2-FIX-03 | P0 | Concurrency | Có test row-lock nhưng chưa có evidence chạy MySQL thật | YES |
| P2-FIX-04 | P1 | Test Data | Thiếu deterministic fixture cho Phase 2 | YES trước CI/E2E |
| P2-FIX-05 | P1 | Frontend | Staff UI cho chọn transition backend cấm | NO, nhưng phải fix trước release |
| P2-FIX-06 | P1 | RBAC | Create/Cancel chỉ `verifyToken`, chưa khóa role `user` theo policy | YES nếu bám Phase 2 RBAC |
| P2-FIX-07 | P2 | Frontend | `profile.js` còn mapping status legacy | NO |
| P2-FIX-08 | P1 | Git | Branch diverged, chưa regression sau sync `main` | YES |
| P2-FIX-09 | P1 | CI | HEAD không có workflow run/check status | YES cho release gate |
| P2-FIX-10 | P1 | Evidence | Chưa có execution report thật | YES cho test/release report |
| P2-HARD-11 | P1 | Security | Stored XSS qua order data render bằng `innerHTML` | Nên fix trước demo/release |
| P2-DEBT-12 | P1 | Payment integration | MoMo vẫn trust `amount` frontend, chưa bind payment với server order | Không block Phase 2 nếu giữ đúng out-of-scope |

---

# 3. P2-FIX-01 — FIX `db:reset` / `db:seed` PATH

## Hiện trạng

Root script:

```json
"db:reset": "npm --prefix backend run db:reset",
"db:seed": "npm --prefix backend run db:seed"
```

Nhưng trong:

```text
backend/scripts/db-reset.js
backend/scripts/db-seed.js
```

đang dùng:

```js
path.resolve("database/migrations/001_initial_schema.sql")
path.resolve("database/migrations/002_order_integrity.sql")
path.resolve("database/seeds/001_reference_data.sql")
```

Khi chạy script từ `backend`, đường dẫn có thể thành:

```text
<repo>/backend/database/...
```

trong khi file thực nằm tại:

```text
<repo>/database/...
```

## Fix khuyến nghị

### `backend/scripts/db-reset.js`

```js
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

const fileFromRepo = (...parts) => path.join(repoRoot, ...parts);
```

Đổi phần read file thành:

```js
const migration = await fs.readFile(
  fileFromRepo("database", "migrations", "001_initial_schema.sql"),
  "utf8",
);

const orderMigration = await fs.readFile(
  fileFromRepo("database", "migrations", "002_order_integrity.sql"),
  "utf8",
);

const seed = await fs.readFile(
  fileFromRepo("database", "seeds", "001_reference_data.sql"),
  "utf8",
);
```

### `backend/scripts/db-seed.js`

Áp dụng cùng helper:

```js
const seed = await fs.readFile(
  fileFromRepo("database", "seeds", "001_reference_data.sql"),
  "utf8",
);
```

## Acceptance

Phải PASS cả hai cách:

```bash
npm run db:reset
npm run db:seed
```

và:

```bash
cd backend
npm run db:reset
npm run db:seed
```

---

# 4. P2-FIX-02 — MỞ RỘNG POSTMAN PHASE 2

## Hiện trạng

Collection hiện có nhóm:

```text
Phase 2 Order Authentication Guards
```

chủ yếu cover:

```text
401 unauthenticated
```

Điều này chưa đủ để chứng minh Phase 2.

## Cấu trúc nên bổ sung

```text
Phase 2 - Order Integrity
├── Setup / Login
├── Create Order
├── Stock Integrity
├── Transaction Rollback
├── Cancellation
├── State Machine
├── Ownership / RBAC
├── Audit History
├── Admin Filter
└── Regression
```

## Case P0 bắt buộc

### Create Order

```text
happy path
client fake tongTien bị ignore
client fake gia bị ignore
invalid maSP
invalid maSize
invalid payment method
duplicate product+size
stock = 0
qty = current stock
qty > current stock
```

### Transaction

Scenario:

```text
item A hợp lệ
item B thiếu stock
```

Expected:

```text
không có DonHang mới
không có ChiTietDonHang partial
stock item A không bị trừ
cart không bị xóa
audit không được ghi
```

### Cancellation

```text
owner cancel PENDING -> 200
non-owner cancel -> 403
cancel CONFIRMED bằng user -> 409
cancel lần 2 -> 409
stock chỉ restore đúng 1 lần
```

### State Machine

Valid:

```text
PENDING -> CONFIRMED
PENDING -> CANCELLED
CONFIRMED -> SHIPPING
CONFIRMED -> CANCELLED
SHIPPING -> COMPLETED
```

Invalid:

```text
PENDING -> SHIPPING
PENDING -> COMPLETED
SHIPPING -> CANCELLED
COMPLETED -> CANCELLED
CANCELLED -> COMPLETED
same status -> same status
```

### Audit

Xác minh:

```text
ORDER_CREATED
old status
new status
actor
reason
chronological order
```

### Filter

```text
status
fromDate
toDate
minTotal
maxTotal
keyword
page
limit
combined filters
invalid ranges
```

## Acceptance

```bash
npm run test:api
npm run test:api:report
```

P0 Phase 2:

```text
100% PASS
```

---

# 5. P2-FIX-03 — VERIFY CONCURRENCY TRÊN MYSQL THẬT

File hiện có:

```text
backend/tests/integration/order-concurrency.test.js
```

Scenario hiện tại đúng:

```text
stock = 1
request A buy 1
request B buy 1
```

Expected:

```text
1 success
1 INSUFFICIENT_STOCK
final stock = 0
```

Nhưng test bị skip nếu thiếu:

```env
ORDER_CONCURRENCY_TEST=1
DB_NAME=*_test
```

## Cách chạy

```env
DB_NAME=clothes_test
ORDER_CONCURRENCY_TEST=1
```

```bash
npm run db:reset
npm run test:order-concurrency
```

Khuyến nghị chạy nhiều lần:

```powershell
1..10 | ForEach-Object {
  npm run test:order-concurrency
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
```

## Acceptance

Mỗi run:

```text
fulfilled = 1
rejected = 1
final stock = 0
stock never < 0
```

Không được merge chỉ dựa vào unit mock cho race condition.

---

# 6. P2-FIX-04 — DETERMINISTIC TEST FIXTURE

Hiện seed reference chỉ phù hợp cho:

```text
Size
Payment Method
```

Cần fixture cố định cho E2E.

## Đề xuất

Tạo:

```text
database/seeds/002_phase2_test_data.sql
```

hoặc script:

```text
backend/scripts/seed-phase2-test.js
```

## Data tối thiểu

Users:

```text
userA
userB
staff
admin
```

Products:

```text
product_stock_0
product_stock_1
product_stock_5
product_stock_10
```

Orders:

```text
PENDING owned by userA
PENDING owned by userB
CONFIRMED
SHIPPING
COMPLETED
CANCELLED
```

## Quy tắc

Fixture phải:

- chạy lại được;
- không phụ thuộc ID phát sinh ngẫu nhiên nếu Postman cần tham chiếu;
- không dùng password production;
- chỉ chạy trên DB test/dev;
- dễ cleanup/reset.

Có thể thêm env guard:

```js
if (!/_test$/i.test(process.env.DB_NAME || "")) {
  throw new Error("Phase 2 test seed may only run on *_test database");
}
```

---

# 7. P2-FIX-05 — STAFF UI PHẢI BÁM STATE MACHINE

## Hiện trạng

`frontend/js/staff.js` render toàn bộ:

```text
Chờ xác nhận
Đã xác nhận
Đang giao
Hoàn thành
Đã hủy
```

cho order chưa terminal.

Ví dụ:

```text
PENDING -> COMPLETED
```

UI cho chọn, nhưng backend trả:

```text
409 INVALID_ORDER_TRANSITION
```

Data backend vẫn an toàn nhưng UX sai.

## Fix

```js
const allowedTransitions = {
  "Chờ xác nhận": ["Đã xác nhận", "Đã hủy"],
  "Đã xác nhận": ["Đang giao", "Đã hủy"],
  "Đang giao": ["Hoàn thành"],
  "Hoàn thành": [],
  "Đã hủy": [],
};

function buildStatusSelect(order) {
  const allowed = allowedTransitions[order.trangThai] || [];

  if (allowed.length === 0) {
    return `<span>${order.trangThai}</span>`;
  }

  const options = [
    `<option value="${order.trangThai}" selected>${order.trangThai}</option>`,
    ...allowed.map(
      (status) => `<option value="${status}">${status}</option>`,
    ),
  ].join("");

  return `
    <select
      onchange="updateStatus(${order.maDonHang}, this.value)"
      class="status-select status-${getStatusClass(order.trangThai)}"
    >
      ${options}
    </select>
  `;
}
```

## Khi API lỗi

Hiện tại khi update fail, dropdown có thể giữ giá trị sai trên UI.

Sửa:

```js
if (res.ok) {
  alert(data.message);
} else {
  alert("Lỗi: " + data.message);
}

await renderStaffOrders();
```

---

# 8. P2-FIX-06 — CHỐT RBAC CHO CREATE / CANCEL

Phase 2 mô tả user cancellation:

```text
own order
AND PENDING
```

Route hiện tại:

```js
POST /api/orders/create
  verifyToken

PUT /api/orders/:id/cancel
  verifyToken
```

Điều này cho phép token role:

```text
user
staff
admin
```

đều đi qua middleware route.

Service cancel vẫn có ownership nên chưa tạo bypass dữ liệu, nhưng policy route chưa rõ.

## Nếu policy Phase 2 là user-only

Sửa:

```js
router.post(
  "/create",
  verifyToken,
  authorizeRoles("user"),
  createOrderValidation,
  validate,
  createOrder,
);
```

```js
router.put(
  "/:id/cancel",
  verifyToken,
  authorizeRoles("user"),
  orderIdValidation,
  validate,
  cancelOrder,
);
```

Admin/staff cancellation tiếp tục đi qua:

```text
PUT /api/orders/:id/status
```

với transition:

```text
PENDING -> CANCELLED
CONFIRMED -> CANCELLED
```

## Test bắt buộc

```text
user create -> allowed
staff create -> 403
admin create -> 403

user cancel own PENDING -> allowed
user cancel other order -> 403
staff call /cancel -> 403
admin call /cancel -> 403

staff/admin use /status -> allowed
```

Nếu team thực sự muốn staff/admin cũng có thể mua hàng, không thêm guard này nhưng phải cập nhật RBAC matrix và test rõ policy.

---

# 9. P2-FIX-07 — FIX STATUS CLASS Ở PROFILE

Hiện tại:

```js
if (status === "Đã giao" || status === "completed")
  return "status-completed";
```

Canonical Phase 2 là:

```text
Hoàn thành
```

Fix:

```js
function getStatusClass(status) {
  switch (status) {
    case "Chờ xác nhận":
      return "status-pending";
    case "Đã xác nhận":
      return "status-confirmed";
    case "Đang giao":
      return "status-shipping";
    case "Hoàn thành":
      return "status-completed";
    case "Đã hủy":
      return "status-cancelled";
    default:
      return "status-unknown";
  }
}
```

Không nên tiếp tục dùng legacy:

```text
Đã giao
completed
cancelled
```

sau khi migration đã normalize dữ liệu.

---

# 10. P2-FIX-08 — SYNC LATEST `main`

Hiện branch:

```text
ahead_by: 10
behind_by: 2
status: diverged
```

Trước khi mở PR:

```bash
git fetch origin
git checkout feature/phase-2-order-integrity
git rebase origin/main
```

Nếu team ưu tiên merge commit:

```bash
git merge origin/main
```

Sau sync phải chạy lại toàn bộ gate, không dùng kết quả test trước sync.

```bash
npm run db:reset
npm run test:backend
npm run test:api
npm run test:order-concurrency
```

---

# 11. P2-FIX-09 — THÊM CI GATE

HEAD hiện không có workflow run / check status.

CI tối thiểu nên có:

```text
Install root dependencies
Install backend dependencies
Start MySQL service
Reset test DB
Run backend unit tests
Run concurrency test
Start API
Run Newman
Upload API report
```

## Gate tối thiểu nếu chưa kịp setup full MySQL CI

```yaml
- run: npm ci
- run: npm --prefix backend ci
- run: npm run test:backend
```

Sau đó mở rộng MySQL + Newman.

## Merge rule

Không merge nếu:

```text
unit test FAIL
db reset FAIL
concurrency FAIL
Postman P0 FAIL
```

---

# 12. P2-FIX-10 — TẠO TEST EXECUTION REPORT

Test Plan không thay thế execution evidence.

Cần tạo:

```text
reports/PHASE_2_TEST_REPORT.md
```

Nội dung:

```text
Tested commit
Date
Node version
MySQL version
DB name
Environment
Unit passed/failed/skipped
Postman passed/failed
Concurrency result
Regression result
Open defects
Release gate
```

Ví dụ:

```text
Commit: aa2b5ab...
Environment: local clean DB
Backend unit: 42/42 PASS
Postman: 35/35 PASS
Concurrency: 10/10 PASS
S1 open: 0
S2 open: 0
Release: READY FOR MERGE REVIEW
```

Không ghi `PASS` nếu test bị `skip`.

---

# 13. P2-HARD-11 — STORED XSS QUA ORDER DATA

## Quan sát

Order cho user nhập:

```text
tenNguoiNhan
diaChiGiaoHang
ghiChu
```

Validator chủ yếu kiểm tra length/format.

Trong `staff.js` và `profile.js`, dữ liệu order được ghép trực tiếp vào:

```js
element.innerHTML = `... ${order.tenNguoiNhan} ...`
```

Nếu một field chứa HTML độc hại, khi staff mở danh sách order có nguy cơ thực thi script/event-handler trong browser.

## Ví dụ input nguy hiểm

```html
<img src=x onerror=alert(1)>
```

## Fix tốt nhất

Không render user-controlled text bằng `innerHTML`.

Ưu tiên:

```js
const td = document.createElement("td");
const name = document.createElement("b");
name.textContent = order.tenNguoiNhan;
td.appendChild(name);
```

Nếu chưa refactor được DOM ngay, tạo escape helper:

```js
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
```

Sau đó dùng cho mọi data không tin cậy:

```js
escapeHtml(order.tenNguoiNhan)
escapeHtml(order.sdt)
escapeHtml(order.diaChiGiaoHang)
escapeHtml(item.tenSP)
escapeHtml(item.tenSize)
```

## Test

Tạo order có:

```text
tenNguoiNhan = <img src=x onerror=alert(1)>
```

Expected:

```text
UI hiển thị text literal
không execute JS
```

---

# 14. P2-DEBT-12 — MOMO CHƯA SERVER-AUTHORITATIVE

## Hiện trạng

`frontend/js/checkout.js` tự tính:

```js
totalAmount += item.gia * item.soLuongMua;
```

Sau đó MoMo:

```js
fetch("/api/create-payment-momo", {
  body: JSON.stringify({ amount: totalAmount })
})
```

Backend `server.js` lại dùng trực tiếp:

```js
const { amount } = req.body;
```

Trong khi Phase 2 order API đã cố tình không tin:

```text
client price
client tongTien
```

Ngoài ra luồng MoMo hiện redirect trước khi tạo Order thực.

## Rủi ro

Có thể xuất hiện:

```text
payment amount != server-calculated order total
payment thành công nhưng chưa có DonHang
order không có payment reference
```

## Vì Phase 2 plan ghi MoMo lifecycle là out-of-scope

Không cần kéo toàn bộ payment lifecycle vào Phase 2.

Hai lựa chọn an toàn:

### Option A — Khuyến nghị cho Phase 2

Tạm disable/hide MoMo trong acceptance Phase 2.

```text
COD / bank transfer -> test Phase 2
MoMo -> Phase payment riêng
```

### Option B — Nếu bắt buộc demo MoMo

Backend phải nhận:

```text
orderId
```

không nhận `amount` authoritative từ frontend.

Pseudo flow:

```text
Create order server-side
  ↓
server calculates total
  ↓
persist order
  ↓
create MoMo request from persisted tongTien
  ↓
return payUrl
```

Payment callback/IPN lifecycle xử lý ở phase riêng.

---

# 15. OPTIONAL HARDENING — MIGRATION OPERABILITY

`002_order_integrity.sql` có:

```sql
CREATE INDEX idx_donhang_user_date ...
CREATE INDEX idx_donhang_status_date ...
```

Nếu migration bị chạy lại trên DB không reset, index đã tồn tại có thể làm migration fail.

Nếu team có migration runner/version table thì giữ như hiện tại được.

Nếu migration đang chạy manual/re-runnable, nên:

- quản lý bảng migration version;
- hoặc kiểm tra index tồn tại trước khi create.

Không coi đây là P0 nếu workflow luôn:

```text
clean DB -> 001 -> 002
```

---

# 16. THỨ TỰ FIX KHUYẾN NGHỊ

```text
1. Fix db-reset/db-seed path
2. Add deterministic Phase 2 fixture
3. Chốt RBAC create/cancel
4. Fix Staff State Machine UI
5. Fix profile status mapping
6. Add Postman business/E2E coverage
7. Run backend unit
8. Run real MySQL concurrency 10x
9. Sync latest main
10. Run full regression lại từ clean DB
11. Add CI gate
12. Generate PHASE_2_TEST_REPORT.md
13. Fix XSS hardening trước demo/release
14. Tách MoMo integration debt sang payment phase
```

---

# 17. TEST MATRIX SAU FIX

| Test ID | Scenario | Expected |
|---|---|---|
| P2-T01 | Fake client price | Server DB price được dùng |
| P2-T02 | Fake `tongTien` | Bị ignore |
| P2-T03 | Duplicate variant | 400 |
| P2-T04 | Invalid payment | 404 |
| P2-T05 | Stock 0 | 409 |
| P2-T06 | Qty > stock | 409 |
| P2-T07 | Multi-item second item fail | Full rollback |
| P2-T08 | Concurrent stock=1 | 1 success / 1 fail |
| P2-T09 | Owner cancel pending | 200 + stock restore |
| P2-T10 | Cancel twice | second = 409, no double restore |
| P2-T11 | Non-owner cancel | 403 |
| P2-T12 | PENDING -> SHIPPING | 409 |
| P2-T13 | CONFIRMED -> SHIPPING | 200 |
| P2-T14 | SHIPPING -> COMPLETED | 200 |
| P2-T15 | COMPLETED -> CANCELLED | 409 |
| P2-T16 | User read own history | 200 |
| P2-T17 | User read other history | 403 |
| P2-T18 | Staff/admin history | 200 |
| P2-T19 | Filter combined | correct total/page |
| P2-T20 | Malicious recipient HTML | rendered as text, no JS execution |

---

# 18. REQUIRED COMMANDS BEFORE PR

Clean DB:

```bash
npm run db:reset
```

Backend test:

```bash
npm run test:backend
```

Concurrency:

```env
ORDER_CONCURRENCY_TEST=1
DB_NAME=clothes_test
```

```bash
npm run test:order-concurrency
```

Postman:

```bash
npm run test:api
npm run test:api:report
```

Git sync:

```bash
git fetch origin
git rebase origin/main
```

Sau rebase:

```bash
npm run db:reset
npm run test:backend
npm run test:order-concurrency
npm run test:api
```

---

# 19. MERGE CHECKLIST

## Code

```text
[ ] db-reset path fixed
[ ] db-seed path fixed
[ ] create/cancel RBAC policy finalized
[ ] staff state transitions match backend
[ ] profile status mapping canonical
[ ] user-controlled order text escaped/safe DOM
```

## Tests

```text
[ ] unit test PASS
[ ] rollback test PASS
[ ] state-machine test PASS
[ ] ownership test PASS
[ ] real MySQL concurrency PASS
[ ] Postman P0 PASS
[ ] Phase 1 regression PASS
```

## Git / CI

```text
[ ] branch synced with main
[ ] no unresolved conflicts
[ ] CI exists
[ ] latest CI green
```

## Evidence

```text
[ ] test report contains tested commit
[ ] no skipped concurrency marked as PASS
[ ] API report saved
[ ] S1 = 0
[ ] S2 = 0
```

---

# 20. RELEASE DECISION

Hiện tại:

```text
CORE IMPLEMENTATION       = GOOD
SERVER-SIDE PRICING       = PASS BY CODE REVIEW
TRANSACTION DESIGN        = PASS BY CODE REVIEW
STATE MACHINE             = PASS BY CODE REVIEW
CANCELLATION ATOMICITY    = PASS BY CODE REVIEW
REAL CONCURRENCY EVIDENCE = MISSING
POSTMAN BUSINESS E2E      = INCOMPLETE
DB REPRODUCIBILITY        = FAIL / OPEN
CI GATE                   = MISSING
BRANCH SYNC               = REQUIRED
RELEASE STATUS            = BLOCKED
```

Điều kiện chuyển sang:

```text
READY FOR PR / MERGE REVIEW
```

là:

```text
P2-FIX-01 PASS
P2-FIX-02 PASS
P2-FIX-03 PASS
P2-FIX-04 available
latest main synced
full regression PASS
S1 = 0
S2 = 0
```

Các hạng mục UI/RBAC/security còn lại nên hoàn thành trước demo/release để Phase 2 không chỉ đúng ở service layer mà còn nhất quán từ HTTP API đến frontend.
