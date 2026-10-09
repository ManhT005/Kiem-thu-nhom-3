# PHASE 2 FIX GUIDE
## Order Integrity, Transaction, Concurrency, RBAC & Test Closure

**Repository:** `ManhT005/Kiem-thu-nhom-3`  
**Target branch:** `feature/phase-2-order-integrity`  
**Target integration branch:** `develop`  
**Scope:** Phase 2 – Order Integrity / State Machine / Transaction / Verification  
**Roles:** Tech Lead, Test Lead, Backend Dev, System Dev  
**Current recommendation:** `NO-GO` until all P0 items are closed

---

# 1. Mục tiêu

Tài liệu này hướng dẫn team đóng toàn bộ bug/gap còn lại của Phase 2 để đưa branch `feature/phase-2-order-integrity` từ trạng thái:

```text
CORE IMPLEMENTATION NEAR COMPLETE
VERIFICATION INCOMPLETE
NOT READY TO CLOSE
```

sang:

```text
PHASE 2 COMPLETE
FULL REGRESSION PASS
READY FOR PR / MERGE
```

Phần kiến trúc Order hiện tại giữ nguyên:

```text
Controller
   ↓
Order Service
   ↓
Order Repository
   ↓
Transaction
   ↓
MySQL Row Lock
```

Việc còn lại tập trung vào reproducible database, deterministic test data, API/E2E test, real MySQL concurrency verification, RBAC policy, frontend state machine, CI, regression và test evidence.

---

# 2. Bug priority

## P0 – Block merge

| ID | Vấn đề | Mục tiêu |
|---|---|---|
| P2-DEF-01 | `db:reset` resolve sai path | Clean DB reset chạy ổn định |
| P2-DEF-02 | `db:seed` resolve sai path | Seed reproducible |
| P2-DEF-03 | Postman Phase 2 thiếu business coverage | API/E2E verification thật |
| P2-DEF-04 | Concurrency chưa verify với MySQL thật | Chứng minh không oversell |

## P1 – Bắt buộc trước khi đóng Phase 2

| ID | Vấn đề |
|---|---|
| P2-DEF-05 | Thiếu deterministic test fixture |
| P2-DEF-06 | Create Order chưa chốt RBAC |
| P2-DEF-07 | Cancel Order chưa chốt RBAC |
| P2-DEF-08 | Staff UI cho transition sai |
| P2-DEF-09 | Staff UI không resync state khi API fail |
| P2-DEF-11 | Branch diverged với `develop` |
| P2-GAP-12 | Chưa có CI gate |
| P2-GAP-13 | Chưa có test execution report |
| P2-GAP-14 | Chưa có Phase 1 regression evidence |
| P2-GAP-15 | Integration verification chưa đầy đủ |

## P2 – Cleanup

| ID | Vấn đề |
|---|---|
| P2-DEF-10 | Profile dùng legacy order status |
| P2-GAP-16 | Chưa có PR/release gate chính thức |

---

# 3. Thứ tự triển khai

```text
01. Sync local branch
02. Fix db path
03. Add deterministic fixture
04. Expand Postman Phase 2
05. Run unit tests
06. Run real MySQL concurrency tests
07. Fix RBAC policy
08. Fix Staff UI state machine
09. Fix Profile status mapping
10. Add CI
11. Sync latest develop
12. Run full regression
13. Generate Phase 2 Test Report
14. Open PR
```

Không fix ngẫu nhiên vì fixture và DB reproducibility là nền tảng cho các test phía sau.

---

# 4. Step 0 – Chuẩn bị branch

Không sửa trực tiếp trên `develop`.

```bash
git fetch origin

git checkout feature/phase-2-order-integrity
git pull origin feature/phase-2-order-integrity

git checkout -b fix/phase-2-order-integrity-closure
```

Kiểm tra:

```bash
git status
git branch --show-current
```

Expected:

```text
fix/phase-2-order-integrity-closure
working tree clean
```

---

# 5. P2-DEF-01 / P2-DEF-02 – Fix `db:reset` và `db:seed` path

## 5.1 Root cause

Các file:

```text
backend/scripts/db-reset.js
backend/scripts/db-seed.js
```

đang dùng:

```js
path.resolve("database/...")
```

Trong khi root script gọi:

```json
"db:reset": "npm --prefix backend run db:reset"
```

Khi working directory là `<repo>/backend`, path có thể thành:

```text
<repo>/backend/database/...
```

trong khi path thật là:

```text
<repo>/database/...
```

## 5.2 Fix chuẩn

### File `backend/scripts/db-reset.js`

Thêm:

```js
import { fileURLToPath } from "node:url";
```

Tạo repo root không phụ thuộc `process.cwd()`:

```js
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
```

Tạo path:

```js
const migration001Path = path.join(
  repoRoot,
  "database",
  "migrations",
  "001_initial_schema.sql",
);

const migration002Path = path.join(
  repoRoot,
  "database",
  "migrations",
  "002_order_integrity.sql",
);

const seedPath = path.join(
  repoRoot,
  "database",
  "seeds",
  "001_reference_data.sql",
);
```

Sau đó:

```js
const migration001 = await fs.readFile(migration001Path, "utf8");
const migration002 = await fs.readFile(migration002Path, "utf8");
const seed = await fs.readFile(seedPath, "utf8");
```

### File `backend/scripts/db-seed.js`

Áp dụng cùng pattern:

```js
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

const seedPath = path.join(
  repoRoot,
  "database",
  "seeds",
  "001_reference_data.sql",
);
```

Không tiếp tục dùng `path.resolve("database/...")`.

## 5.3 Safety guard

Trước `DROP DATABASE`, thêm guard:

```js
if (!databaseName || databaseName === "mysql") {
  throw new Error("Unsafe DB_NAME for db:reset");
}

if (
  process.env.NODE_ENV === "production" ||
  process.env.APP_ENV === "production"
) {
  throw new Error("db:reset is disabled in production");
}
```

## 5.4 Test

Từ root:

```bash
npm run db:reset
npm run db:seed
```

Từ backend:

```bash
cd backend
npm run db:reset
npm run db:seed
```

### Acceptance Criteria

```text
[ ] Không ENOENT
[ ] Migration 001 chạy
[ ] Migration 002 chạy
[ ] Seed chạy
[ ] DB tạo thành công
[ ] Có LichSuDonHang
[ ] Có reference payment method
[ ] Có Size reference
```

---

# 6. P2-DEF-05 – Deterministic Phase 2 Test Fixture

Không dùng data thủ công cho automation.

Tạo một trong hai:

```text
database/seeds/002_phase2_test_data.sql
```

hoặc ưu tiên:

```text
backend/scripts/seed-phase2-test.js
```

## 6.1 Data tối thiểu

### Accounts

```text
phase2_user_a  → user
phase2_user_b  → user
phase2_staff   → staff
phase2_admin   → admin
```

### Product variants

```text
P2_STOCK_0  → stock 0
P2_STOCK_1  → stock 1
P2_STOCK_5  → stock 5
P2_STOCK_10 → stock 10
```

### Order statuses

Fixture phải có hoặc tạo được order ở:

```text
Chờ xác nhận
Đã xác nhận
Đang giao
Hoàn thành
Đã hủy
```

## 6.2 Yêu cầu fixture

```text
deterministic
repeatable
không phụ thuộc dev data cũ
không dùng production account
không cần thao tác manual
```

## 6.3 Script

Root `package.json`:

```json
"db:seed:phase2": "npm --prefix backend run db:seed:phase2"
```

Backend:

```json
"db:seed:phase2": "node scripts/seed-phase2-test.js"
```

### Acceptance Criteria

```bash
npm run db:reset
npm run db:seed:phase2
```

Sau đó luôn có đủ accounts, products và stock fixtures phục vụ Postman/integration.

---

# 7. P2-DEF-03 – Mở rộng Postman Phase 2

File:

```text
tests/postman/ClothesShop.postman_collection.json
```

Structure đề xuất:

```text
Phase 2 - Order Integrity
├── 00 Setup
├── 01 Authentication
├── 02 Create Order
├── 03 Stock Integrity
├── 04 Transaction Rollback
├── 05 Cancellation
├── 06 State Machine
├── 07 RBAC / Ownership
├── 08 Audit Trail
├── 09 Filter / Pagination
└── 10 E2E Lifecycle
```

---

# 8. Postman Setup

Login 4 account:

```text
userA
userB
staff
admin
```

Store:

```text
userAToken
userBToken
staffToken
adminToken
```

Ví dụ:

```js
const body = pm.response.json();
pm.environment.set("userAToken", body.data.token);
```

Điều chỉnh field theo response login thật.

---

# 9. Postman – Create Order

## P2-API-001 Happy path

```json
{
  "tenNguoiNhan": "Phase2 User",
  "sdt": "0912345678",
  "diaChiGiaoHang": "Ha Noi",
  "maPTTT": 1,
  "items": [
    {
      "maSP": "{{stock5ProductId}}",
      "maSize": "{{sizeId}}",
      "soLuongMua": 1
    }
  ]
}
```

Expected:

```text
201
ORDER_CREATED
Chờ xác nhận
```

## P2-API-002 Fake client price

Client gửi thêm giá giả:

```json
{
  "gia": 1,
  "giaMua": 1,
  "tongTien": 1
}
```

Expected:

```text
server ignores client price
DB total = server-side product price × quantity
```

## P2-API-003 Invalid variant

```text
404 ORDER_VARIANT_NOT_FOUND
```

## P2-API-004 stock = 0

```text
409 INSUFFICIENT_STOCK
```

## P2-API-005 exact stock

```text
stock = 5
buy = 5
→ success
→ stock = 0
```

## P2-API-006 stock + 1

```text
stock = 5
buy = 6
→ 409
→ stock remains 5
```

## P2-API-007 duplicate variant

Cùng `maSP + maSize` hai lần:

```text
400 ORDER_DUPLICATE_ITEM
```

## P2-API-008 invalid payment

```text
404 PAYMENT_METHOD_NOT_FOUND
```

---

# 10. Transaction rollback test

Scenario:

```text
item A: stock OK
item B: insufficient stock
```

Expected:

```text
request fails
no DonHang persisted
no ChiTietDonHang persisted
stock A unchanged
stock B unchanged
cart unchanged
no audit created
```

Nếu kiểm toàn bộ DB state khó qua Postman, đưa phần DB assertions vào integration test.

---

# 11. Cancellation tests

## P2-API-020 – owner cancel PENDING

```text
Chờ xác nhận → Đã hủy
200
stock restored once
audit inserted
```

## P2-API-021 – other user cancel

```text
User B cancel User A order
→ 403 ORDER_ACCESS_DENIED
```

## P2-API-022 – cancel twice

Second request:

```text
409 ORDER_ALREADY_CANCELLED
```

Stock không được restore lần 2.

## P2-API-023 – cancel SHIPPING

```text
409
```

---

# 12. State Machine tests

Allowed:

```text
PENDING   → CONFIRMED
PENDING   → CANCELLED
CONFIRMED → SHIPPING
CONFIRMED → CANCELLED
SHIPPING  → COMPLETED
```

Denied:

```text
PENDING   → SHIPPING
PENDING   → COMPLETED
SHIPPING  → CANCELLED
COMPLETED → CANCELLED
CANCELLED → COMPLETED
```

Expected denied:

```text
409 INVALID_ORDER_TRANSITION
```

---

# 13. Audit Trail tests

Create order phải sinh:

```text
previousStatus = NULL
newStatus      = Chờ xác nhận
reason         = ORDER_CREATED
```

Transition phải ghi:

```text
old status
new status
actor id
reason
timestamp
```

History endpoint:

```text
GET /api/orders/:id/history
```

Expected:

```text
owner → own history allowed
staff/admin → allowed
other normal user → 403
```

---

# 14. Filter / Pagination tests

Cover:

```text
trangThai
fromDate
toDate
minTotal
maxTotal
keyword
page
limit
combined filters
```

Negative:

```text
toDate < fromDate
minTotal > maxTotal
page = 0
limit = 0
limit > 100
unknown status
```

---

# 15. P2-DEF-04 – Real MySQL concurrency verification

File hiện tại:

```text
backend/tests/integration/order-concurrency.test.js
```

đã có scenario stock=1 cơ bản nhưng phải chạy trên MySQL thật.

## 15.1 Environment

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=clothes_phase2_test
ORDER_CONCURRENCY_TEST=1
NODE_ENV=test
```

Không chạy vào dev/prod DB.

## 15.2 PowerShell

```powershell
$env:DB_NAME="clothes_phase2_test"
$env:ORDER_CONCURRENCY_TEST="1"

npm run db:reset
npm run test:order-concurrency
```

## 15.3 Chạy lặp

```powershell
1..20 | ForEach-Object {
  Write-Host "Concurrency run $_"
  npm run test:order-concurrency

  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}
```

### Acceptance Criteria

Mọi run:

```text
fulfilled = 1
rejected = 1
rejected.code = INSUFFICIENT_STOCK
final stock = 0
```

Không được có:

```text
2 success
stock < 0
partial order
dirty stock state
```

---

# 16. Nâng concurrency coverage

Thêm scenario:

```text
stock = 5
10 requests đồng thời
mỗi request buy 1
```

Expected:

```text
success = 5
fail = 5
stock = 0
```

Thêm multi-product lock ordering:

```text
Order A: product 1 → product 2
Order B: product 2 → product 1
```

Do service đã sort `maSP`, `maSize` trước lock nên test phải xác nhận không tạo deadlock không kiểm soát.

---

# 17. P2-DEF-06 / P2-DEF-07 – Chốt RBAC

Current:

```text
POST /api/orders/create
PUT /api/orders/:id/cancel
```

mới có `verifyToken`.

## Policy khuyến nghị

```text
user:
  create own order
  view own orders
  cancel own pending order

staff:
  view all
  filter
  update status
  read history

admin:
  same management permissions as staff
```

Nếu chốt policy này:

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

Cancel:

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

My Orders có thể thêm:

```js
authorizeRoles("user")
```

Nếu business muốn staff/admin vẫn có quyền mua hàng, giữ route nhưng phải cập nhật RBAC Matrix và test plan. Không để policy mơ hồ.

---

# 18. RBAC matrix test

| Role | Create | My Orders | Cancel own | All Orders | Filter | Update Status |
|---|---:|---:|---:|---:|---:|---:|
| user | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| staff | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| admin | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |

Unauthorized role:

```text
403 FORBIDDEN
```

---

# 19. P2-DEF-08 – Fix Staff UI state transition

Current UI render gần như toàn bộ status cho order chưa terminal.

Tạo frontend transition map:

```js
const ORDER_TRANSITIONS = {
  "Chờ xác nhận": ["Đã xác nhận", "Đã hủy"],
  "Đã xác nhận": ["Đang giao", "Đã hủy"],
  "Đang giao": ["Hoàn thành"],
  "Hoàn thành": [],
  "Đã hủy": [],
};
```

Pseudo render:

```js
function buildStatusSelect(order) {
  const allowed = ORDER_TRANSITIONS[order.trangThai] || [];

  if (allowed.length === 0) {
    return `<span class="status-label">${order.trangThai}</span>`;
  }

  const options = [
    `<option value="${order.trangThai}" selected>${order.trangThai}</option>`,
    ...allowed.map(
      (status) => `<option value="${status}">${status}</option>`,
    ),
  ];

  return `
    <select onchange="updateStatus(${order.maDonHang}, this.value)">
      ${options.join("")}
    </select>
  `;
}
```

Backend state machine vẫn là source of truth. UI chỉ tránh thao tác sai trước khi request.

---

# 20. P2-DEF-09 – Resync UI khi API fail

Current flow:

```js
if (res.ok) {
  renderStaffOrders();
} else {
  alert(...);
}
```

Fix:

```js
if (res.ok) {
  alert(data.message);
} else {
  alert(data.message || "Cập nhật trạng thái thất bại");
}

await renderStaffOrders();
```

Mục tiêu: dropdown luôn trở về state thật của server nếu API reject transition.

---

# 21. P2-DEF-10 – Fix Profile legacy status

Current còn mapping:

```text
Đã giao
completed
cancelled
```

Canonical Phase 2:

```text
Chờ xác nhận
Đã xác nhận
Đang giao
Hoàn thành
Đã hủy
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

Migration 002 chịu trách nhiệm normalize legacy DB data. UI nên dùng canonical statuses.

---

# 22. Unit Test Gate

Chạy:

```bash
npm run test:backend
```

Expected:

```text
0 failed
```

Không được mất các scenario:

```text
server-side price
duplicate variant
insufficient stock
transaction rollback
cancel idempotency
ownership
invalid transition
filter parameter binding
history permission
transaction commit/rollback
```

---

# 23. Integration lifecycle test

Nên thêm:

```text
backend/tests/integration/order-lifecycle.test.js
```

Flow 1:

```text
reset DB
seed Phase 2
create order
assert stock decreased
assert ORDER_CREATED history
staff CONFIRMED
staff SHIPPING
staff COMPLETED
assert ordered audit history
```

Flow 2:

```text
create order
cancel order
assert stock restored
cancel again
assert 409
assert stock unchanged
```

---

# 24. P2-GAP-12 – Add CI gate

Tạo:

```text
.github/workflows/phase2-ci.yml
```

Minimum:

```yaml
name: Phase 2 CI

on:
  pull_request:
  push:
    branches:
      - develop

jobs:
  backend-unit:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci
      - run: npm --prefix backend ci
      - run: npm run test:backend
```

---

# 25. CI với MySQL

Khuyến nghị service:

```yaml
services:
  mysql:
    image: mysql:8.4
    env:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: clothes_phase2_test
    ports:
      - 3306:3306
    options: >-
      --health-cmd="mysqladmin ping -h localhost -proot"
      --health-interval=10s
      --health-timeout=5s
      --health-retries=10
```

Env:

```yaml
env:
  DB_HOST: 127.0.0.1
  DB_PORT: 3306
  DB_USER: root
  DB_PASSWORD: root
  DB_NAME: clothes_phase2_test
  ORDER_CONCURRENCY_TEST: 1
  NODE_ENV: test
```

Steps:

```yaml
- run: npm run db:reset
- run: npm run test:backend
- run: npm run test:order-concurrency
```

---

# 26. API CI

Start API rồi chờ health endpoint, không dùng sleep cố định nếu tránh được:

```bash
npm start &

for i in {1..30}; do
  curl -fsS http://localhost:3000/api/health && break
  sleep 2
done
```

Sau đó:

```bash
npm run test:api
```

Nếu API không ready sau vòng chờ, CI phải fail.

---

# 27. P2-DEF-11 – Sync `develop`

Chỉ sync sau khi fix local đã xanh.

```bash
git fetch origin
git checkout fix/phase-2-order-integrity-closure
git merge origin/develop
```

Nếu team thống nhất rebase:

```bash
git rebase origin/develop
```

Không rebase branch đang được nhiều thành viên cùng dùng nếu chưa thống nhất.

---

# 28. Regression sau sync

Bắt buộc rerun:

```bash
npm run db:reset
npm run test:backend
npm run test:order-concurrency
npm run test:api
npm run test:api:report
```

---

# 29. Phase 1 regression

Phase 2 không được phá:

```text
auth
RBAC
cart
inventory
validation
health endpoint
API response contract
frontend same-origin API
```

Ít nhất chạy lại:

```text
Health is up
Unknown API returns 404
Cart requires authentication
Inventory requires authentication
Register validation
```

---

# 30. Manual E2E smoke

## Customer flow

```text
Login user
→ Add cart
→ Create order
→ Verify server price
→ Verify stock decrease
→ My Orders
→ Cancel pending
→ Verify stock restored
```

## Staff flow

```text
Login staff
→ All Orders
→ PENDING → CONFIRMED
→ CONFIRMED → SHIPPING
→ SHIPPING → COMPLETED
→ View audit
```

## Negative flow

```text
User B cancel User A order
→ denied

Staff tries PENDING → COMPLETED
→ UI không cho chọn

Direct API PENDING → COMPLETED
→ 409
```

---

# 31. P2-GAP-13 – Phase 2 Test Report

Tạo:

```text
reports/PHASE_2_TEST_REPORT.md
```

Template:

```md
# Phase 2 Test Execution Report

Commit:
Branch:
Executed at:
Tester:
Node:
MySQL:
OS:

## Results

| Suite | Total | Pass | Fail | Skip |
|---|---:|---:|---:|---:|
| Unit | | | | |
| Integration | | | | |
| Concurrency | | | | |
| Postman | | | | |
| Regression | | | | |

## Open Defects

...

## Release Recommendation

GO / NO-GO
```

---

# 32. Evidence bắt buộc

Report phải ghi:

```text
commit SHA được test
DB version
Node version
OS
test command
total
passed
failed
skipped
open defects
release recommendation
```

Concurrency evidence:

```text
run count
success count
failure count
oversell count = 0
```

---

# 33. Commit strategy

Khuyến nghị commit nhỏ:

```text
fix(db): make phase2 reset and seed paths deterministic

test(order): add deterministic phase2 fixtures

test(order): expand phase2 Postman business coverage

test(order): verify MySQL order concurrency

fix(order): enforce customer order RBAC policy

fix(ui): enforce order state transitions in staff view

fix(ui): normalize profile order status classes

ci: add phase2 backend and MySQL verification

docs(test): add phase2 execution report
```

---

# 34. Definition of Done

## DB reproducibility

```text
[ ] db:reset root PASS
[ ] db:reset backend PASS
[ ] db:seed root PASS
[ ] db:seed backend PASS
```

## API coverage

```text
[ ] Create Order
[ ] Stock integrity
[ ] Transaction rollback
[ ] Cancellation
[ ] State machine
[ ] RBAC
[ ] Ownership
[ ] Audit
[ ] Filter
[ ] E2E lifecycle
```

## Concurrency

```text
[ ] Real MySQL
[ ] >= 20 repeated runs
[ ] 0 oversell
[ ] final stock always valid
```

## Fixtures

```text
[ ] deterministic accounts
[ ] deterministic products
[ ] deterministic stock
[ ] repeatable reset
```

## UI

```text
[ ] only valid state transitions shown
[ ] API fail resyncs UI
[ ] canonical status mapping
```

## Release

```text
[ ] branch behind develop = 0
[ ] unit green
[ ] integration green
[ ] concurrency green
[ ] API/Postman green
[ ] Phase 1 regression green
[ ] test report generated
[ ] CI green
```

---

# 35. Final Release Gate

## GO

Chỉ GO khi:

```text
db reset PASS
db seed PASS

unit PASS
integration PASS
concurrency PASS

Postman P0 PASS
RBAC PASS
ownership PASS

server-side pricing PASS
rollback PASS
audit PASS
filter PASS

Phase 1 regression PASS
Phase 2 regression PASS

S1 = 0
S2 = 0
```

---

# 36. NO-GO conditions

Không merge nếu còn bất kỳ điều kiện nào:

```text
db reset không reproducible

2 concurrent buyers đều mua được stock = 1

stock âm

partial order persisted

failed transaction nhưng stock đã giảm

fake price được accept

double cancellation restore stock hai lần

user đọc/hủy order của user khác

invalid transition được accept

P0 Postman chưa chạy

concurrency test bị skip

develop chưa sync

CI đỏ
```

---

# 37. Merge checklist

```text
[ ] P0 defects closed
[ ] P1 defects closed hoặc có approved exception
[ ] branch behind develop = 0
[ ] unit test green
[ ] integration green
[ ] concurrency green
[ ] API/Postman green
[ ] Phase 1 regression green
[ ] no S1
[ ] no S2
[ ] test execution report committed
[ ] CI green
[ ] PR created
[ ] Tech Lead review
[ ] Test Lead GO
```

---

# 38. PR description template

```md
## Phase 2 Order Integrity Closure

### Scope
- DB reproducibility
- deterministic fixtures
- API/E2E coverage
- MySQL concurrency
- RBAC
- frontend state machine
- CI
- regression

### Validation

- [ ] npm run db:reset
- [ ] npm run test:backend
- [ ] npm run test:order-concurrency
- [ ] npm run test:api
- [ ] Phase 1 regression
- [ ] Phase 2 regression

### Concurrency

Runs:
Oversell:
Final stock failures:

### Open defects

None / list here.

### Release recommendation

READY FOR MERGE
```

---

# 39. Kết luận

Không cần refactor lại Order Core nếu không xuất hiện regression mới. Phần backend hiện đã có foundation đúng:

```text
server-side pricing
row locking
transaction
state machine
ownership
audit
stock restore
```

Công việc còn lại phải tập trung vào việc **chứng minh** implementation đúng trên môi trường thật:

```text
reproducible DB
deterministic data
HTTP test
real MySQL
concurrency
RBAC
regression
CI evidence
```

Sau khi toàn bộ P0 và P1 đạt gate:

```text
Phase 2 = COMPLETE
Order Integrity = VERIFIED
Release Gate = GO
```
