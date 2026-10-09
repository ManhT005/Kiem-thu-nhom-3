# PHASE 2 REVIEW & DEFECT REPORT
## Order Integrity, State Machine & Transaction

**Project:** `ManhT005/Kiem-thu-nhom-3`  
**Branch reviewed:** `feature/phase-2-order-integrity`  
**Reviewed head:** `7d44c54f8a658c036485c5868fe98d321e3f80bc`  
**Compared with:** `main @ 76ae4ce23fc987ea04b423da7230e6988bfd0d9d`  
**Review roles:** Tech Lead, Test Lead, Backend/System Review  
**Release status:** `BLOCKED`

---

# 1. EXECUTIVE SUMMARY

Phase 2 đã triển khai đúng phần lớn kiến trúc trọng tâm:

```text
Order Service
+ Repository
+ Transaction
+ Row Lock
+ Server-side Pricing
+ State Machine
+ Atomic Cancellation
+ Audit Trail
+ Ownership
```

Các điểm core backend nhìn chung đạt yêu cầu thiết kế.

Tuy nhiên, branch hiện chưa nên merge vào `main` vì vẫn còn các gate quan trọng liên quan đến:

- DB reset/reproducibility;
- deterministic test fixtures;
- Postman Phase 2 coverage;
- concurrency verification trên MySQL thật;
- regression sau khi đồng bộ với `main`;
- một số mismatch RBAC/UI.

Trạng thái tổng thể:

```text
IMPLEMENTATION CORE: GOOD
UNIT TEST FOUNDATION: GOOD
REAL INTEGRATION VERIFICATION: INCOMPLETE
RELEASE GATE: BLOCKED
```

---

# 2. BRANCH STATUS

So với `main`:

```text
ahead_by: 8
behind_by: 2
status: diverged
```

Branch chưa có GitHub Actions workflow/check status.

Do đó chưa có CI evidence để xác nhận:

```text
build
unit test
database reset
Postman regression
concurrency
```

đều pass trên môi trường sạch.

---

# 3. DEFECT / GAP SUMMARY

| ID | Severity | Area | Vấn đề | Trạng thái |
|---|---|---|---|---|
| P2-DEF-01 | S2 / P0 | DB Tooling | `db:reset` / `db:seed` resolve sai path khi chạy qua `npm --prefix backend` | OPEN |
| P2-DEF-02 | S2 / P0 | Test Automation | Postman Phase 2 mới chủ yếu test 401, thiếu business/E2E coverage | OPEN |
| P2-DEF-03 | S2 / P0 | Concurrency | Có concurrency test nhưng chưa có bằng chứng chạy PASS với MySQL thật | OPEN |
| P2-DEF-04 | S3 / P1 | Test Data | Chưa có deterministic seed/fixture cho Phase 2 | OPEN |
| P2-DEF-05 | S3 / P1 | Frontend | Staff UI cho chọn transition backend không cho phép | OPEN |
| P2-DEF-06 | S3 / P1 | RBAC | Create/Cancel Order chỉ yêu cầu token, chưa khóa role `user` theo policy | OPEN |
| P2-DEF-07 | S3 / P1 | Git/Release | Branch đang diverged và chưa regression sau rebase | OPEN |
| P2-DEF-08 | S4 / P2 | Frontend | `getStatusClass()` còn mapping status legacy | OPEN |
| P2-GAP-09 | P1 | CI | Chưa có automated CI gate | OPEN |
| P2-GAP-10 | P1 | Evidence | Chưa có Phase 2 test report/result artifact thực tế | OPEN |

---

# 4. P2-DEF-01 — DB RESET / SEED PATH KHÔNG ỔN ĐỊNH

**Severity:** S2  
**Priority:** P0  
**Files:**

```text
backend/scripts/db-reset.js
backend/scripts/db-seed.js
package.json
```

## Hiện trạng

Root `package.json` gọi:

```json
"db:reset": "npm --prefix backend run db:reset"
```

Backend:

```json
"db:reset": "node scripts/db-reset.js"
```

Trong `db-reset.js` lại dùng:

```js
path.resolve("database/migrations/001_initial_schema.sql")
path.resolve("database/migrations/002_order_integrity.sql")
path.resolve("database/seeds/001_reference_data.sql")
```

Khi script chạy từ:

```text
<repo>/backend
```

`path.resolve()` sẽ resolve thành:

```text
<repo>/backend/database/...
```

trong khi database thật nằm:

```text
<repo>/database/...
```

`db-seed.js` gặp cùng vấn đề.

## Ảnh hưởng

Có thể gây:

```text
ENOENT
file not found
```

và làm mất khả năng:

```text
clone
→ npm install
→ db:reset
→ start
```

Đây là regression trực tiếp đối với mục tiêu reproducible DB từ Phase 1.

## Hướng sửa

Không phụ thuộc `process.cwd()`.

Dùng vị trí file:

```js
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
```

Sau đó:

```js
const migration001 = path.join(
  repoRoot,
  "database/migrations/001_initial_schema.sql"
);

const migration002 = path.join(
  repoRoot,
  "database/migrations/002_order_integrity.sql"
);
```

## Acceptance Criteria

Chạy từ root:

```bash
npm run db:reset
```

PASS.

Chạy từ backend:

```bash
cd backend
npm run db:reset
```

PASS.

---

# 5. P2-DEF-02 — POSTMAN PHASE 2 COVERAGE CHƯA ĐẠT

**Severity:** S2  
**Priority:** P0  
**File:**

```text
tests/postman/ClothesShop.postman_collection.json
```

## Hiện trạng

Collection mới thêm:

```text
Phase 2 Order Authentication Guards
```

với các trường hợp:

```text
Create order without token
My orders without token
Cancel without token
Status update without token
History without token
Filter without token
```

Nhóm này mới xác nhận `401`.

## Thiếu các test quan trọng

### Create Order

```text
happy path
fake price
fake tongTien
invalid product
invalid variant
stock = 0
qty = N
qty = N + 1
duplicate item
invalid payment method
```

### Transaction

```text
multi-item success
item thứ 2 insufficient stock
rollback toàn bộ
cart rollback
audit rollback
```

### Cancellation

```text
user cancel own PENDING
user cancel user khác
cancel lần 2
cancel SHIPPING
cancel COMPLETED
stock restore
```

### State Machine

```text
PENDING -> CONFIRMED
PENDING -> CANCELLED
CONFIRMED -> SHIPPING
CONFIRMED -> CANCELLED
SHIPPING -> COMPLETED

PENDING -> SHIPPING
PENDING -> COMPLETED
SHIPPING -> CANCELLED
COMPLETED -> CANCELLED
CANCELLED -> COMPLETED
```

### Audit

```text
initial audit
transition audit
actor
old/new status
history order
```

### Filter

```text
status
date
total
keyword
page
limit
combined filter
```

## Hướng sửa

Mở rộng collection:

```text
Phase 2 - Order Integrity
├── Setup
├── Create Order
├── Transaction
├── Cancellation
├── State Machine
├── Ownership/RBAC
├── Audit
├── Filter
└── E2E
```

## Acceptance Criteria

```text
P0 Phase 2 Postman tests = 100% PASS
```

Newman chạy được độc lập:

```bash
npm run test:api
npm run test:api:report
```

---

# 6. P2-DEF-03 — CONCURRENCY TEST CHƯA ĐƯỢC VERIFY THỰC TẾ

**Severity:** S2  
**Priority:** P0  
**File:**

```text
backend/tests/integration/order-concurrency.test.js
```

## Điểm tốt

Test đã cover đúng scenario:

```text
stock = 1

Request A buy 1
Request B buy 1
```

Expected:

```text
1 fulfilled
1 rejected
final stock = 0
error = INSUFFICIENT_STOCK
```

## Vấn đề

Test chỉ chạy khi:

```env
ORDER_CONCURRENCY_TEST=1
DB_NAME=..._test
```

Implementation note cũng xác nhận test có thể bị skip nếu môi trường không có MySQL.

Do đó hiện chưa có evidence:

```text
REAL DB CONCURRENCY = PASS
```

## Hướng xử lý

Tạo DB test:

```env
DB_NAME=clothes_test
ORDER_CONCURRENCY_TEST=1
```

Chạy:

```bash
npm run test:order-concurrency
```

Khuyến nghị:

```text
run 10 lần
0 oversell
0 stock âm
```

## Acceptance Criteria

Mỗi run:

```text
success order count = 1
failed order count = 1
final stock = 0
```

---

# 7. P2-DEF-04 — THIẾU DETERMINISTIC TEST DATA

**Severity:** S3  
**Priority:** P1  
**Current seed:**

```text
database/seeds/001_reference_data.sql
```

Hiện chỉ seed:

```text
Size
Payment Method
```

## Thiếu fixture

```text
userA
userB
staff
admin
```

Products:

```text
stock = 0
stock = 1
stock = 5
stock = 10
```

Orders:

```text
PENDING
CONFIRMED
SHIPPING
COMPLETED
CANCELLED
```

## Ảnh hưởng

Test E2E/Postman phụ thuộc manual data.

Kết quả:

```text
khó reproduce
khó chạy Newman clean
khó chạy CI
```

## Hướng sửa

Thêm:

```text
database/seeds/002_phase2_test_data.sql
```

hoặc fixture script riêng:

```text
backend/scripts/seed-phase2-test.js
```

Không dùng test data production.

---

# 8. P2-DEF-05 — STAFF UI KHÔNG BÁM STATE MACHINE

**Severity:** S3  
**Priority:** P1  
**File:**

```text
frontend/js/staff.js
```

## Hiện trạng

UI render gần như toàn bộ status:

```text
Chờ xác nhận
Đã xác nhận
Đang giao
Hoàn thành
Đã hủy
```

cho mọi order chưa terminal.

Ví dụ:

```text
PENDING
```

vẫn có thể chọn trực tiếp:

```text
COMPLETED
```

Backend sẽ trả:

```text
409 INVALID_ORDER_TRANSITION
```

nên data vẫn an toàn, nhưng UX không đúng business rule.

Ngoài ra khi request fail, UI không luôn refresh lại giá trị dropdown.

## Hướng sửa

Map allowed actions theo current status.

Ví dụ:

```js
const allowedTransitions = {
  "Chờ xác nhận": ["Đã xác nhận", "Đã hủy"],
  "Đã xác nhận": ["Đang giao", "Đã hủy"],
  "Đang giao": ["Hoàn thành"],
  "Hoàn thành": [],
  "Đã hủy": [],
};
```

Chỉ render transition hợp lệ.

Nếu API trả lỗi:

```js
await renderStaffOrders();
```

để đồng bộ UI lại với server.

---

# 9. P2-DEF-06 — CREATE/CANCEL ORDER CHƯA KHÓA ROLE USER

**Severity:** S3  
**Priority:** P1  
**File:**

```text
backend/routes/order.routes.js
```

## Hiện trạng

Create:

```js
router.post(
  "/create",
  verifyToken,
  ...
);
```

Cancel:

```js
router.put(
  "/:id/cancel",
  verifyToken,
  ...
);
```

Tức là:

```text
user
staff
admin
```

đều có thể gọi nếu có token.

Cancel có ownership nên staff/admin sẽ chỉ hủy được order do chính account đó sở hữu, nhưng policy vẫn chưa rõ ràng.

## Target policy đề xuất

```text
user:
  create own order
  cancel own pending order

staff/admin:
  use management/status APIs
```

## Hướng sửa

Nếu business policy xác nhận:

```js
authorizeRoles("user")
```

cho:

```text
POST /orders/create
PUT /orders/:id/cancel
```

Nếu team muốn cho admin/staff mua hàng như user thì phải ghi rõ trong RBAC Matrix.

---

# 10. P2-DEF-07 — BRANCH DIVERGED VỚI MAIN

**Severity:** S3  
**Priority:** P1

Hiện:

```text
feature branch ahead: 8
feature branch behind: 2
```

## Rủi ro

Merge trực tiếp có thể:

```text
bỏ sót thay đổi mới
conflict
regression
```

## Hướng xử lý

Trước PR:

```bash
git fetch origin
git checkout feature/phase-2-order-integrity
git rebase origin/main
```

hoặc merge:

```bash
git merge origin/main
```

Sau đó chạy lại:

```text
unit test
db reset
Postman
concurrency
regression
```

---

# 11. P2-DEF-08 — STATUS CSS MAPPING CÒN LEGACY

**Severity:** S4  
**Priority:** P2  
**File:**

```text
frontend/js/profile.js
```

Current:

```js
if (status === "Đã giao" || status === "completed")
  return "status-completed";
```

Canonical Phase 2:

```text
Hoàn thành
```

Do đó `Hoàn thành` có thể rơi về default:

```text
status-pending
```

## Fix

```js
function getStatusClass(status) {
  if (status === "Hoàn thành") return "status-completed";
  if (status === "Đang giao") return "status-shipping";
  if (status === "Đã hủy") return "status-cancelled";
  if (status === "Đã xác nhận") return "status-confirmed";
  return "status-pending";
}
```

---

# 12. P2-GAP-09 — CHƯA CÓ CI GATE

**Priority:** P1

Branch không có:

```text
.github/workflows/
```

và không có commit status/check run.

## Khuyến nghị

Thêm CI tối thiểu:

```text
npm ci
backend npm ci
npm run test:backend
```

Nếu runner có MySQL service:

```text
db:reset
concurrency test
Newman
```

Nếu chưa setup MySQL CI thì ít nhất unit test phải là required gate.

---

# 13. P2-GAP-10 — CHƯA CÓ TEST EXECUTION REPORT THỰC TẾ

Test Plan đã đầy đủ nhưng hiện chưa có output chứng minh:

```text
PASS / FAIL
executed date
environment
commit tested
defect list
```

## Cần tạo

```text
reports/PHASE_2_TEST_REPORT.md
reports/Phase2_API_Test_Report.html
```

Test report phải ghi:

```text
commit SHA
DB version
Node version
total tests
passed
failed
skipped
open defects
release recommendation
```

---

# 14. CÁC HẠNG MỤC ĐÃ PASS QUA CODE REVIEW

Các phần sau hiện triển khai đúng hướng và chưa thấy blocker kiến trúc:

| Area | Result |
|---|---|
| `mysql2.createPool()` | PASS |
| transaction helper | PASS |
| rollback/release pattern | PASS |
| server-side price | PASS |
| client total ignored | PASS |
| product variant lock | PASS |
| sorted lock order | PASS |
| stock validation | PASS |
| `affectedRows` stock check | PASS |
| State Machine constants | PASS |
| transition map | PASS |
| atomic cancellation | PASS |
| repeated cancel guard | PASS |
| ownership check | PASS |
| audit insert | PASS |
| order history authorization | PASS |
| filter parameterization | PASS |
| pagination validation | PASS |
| `.env` removed from tracked branch | PASS |

---

# 15. TEST COVERAGE HIỆN TẠI

Unit tests đang có:

```text
order-service.test.js
order-status.test.js
transaction.test.js
```

Các test đáng chú ý:

```text
server-side price
ignore client total
duplicate variant
insufficient stock
transaction rollback
cancel idempotency
ownership
invalid transition
filter bound parameter
history permission
transaction commit/rollback
```

Đây là foundation tốt.

Tuy nhiên unit mock không thay thế cho:

```text
real MySQL transaction
real row locking
HTTP middleware
real auth
real Postman workflow
```

---

# 16. MERGE BLOCKERS

Branch chưa được merge nếu còn các mục sau:

```text
[ ] P2-DEF-01 db:reset/db:seed path chưa fix
[ ] P2-DEF-02 Postman business coverage chưa đủ
[ ] P2-DEF-03 concurrency chưa chạy PASS thực tế
[ ] chưa rebase/merge latest main
[ ] chưa full regression
```

---

# 17. FIX ORDER ĐỀ XUẤT

Thực hiện theo thứ tự:

```text
Step 1
Fix db:reset + db:seed path

Step 2
Add deterministic Phase 2 test fixtures

Step 3
Expand Postman Phase 2 business tests

Step 4
Run unit tests

Step 5
Run real MySQL concurrency test

Step 6
Fix Staff UI transitions

Step 7
Chốt RBAC create/cancel policy

Step 8
Fix profile status class

Step 9
Rebase latest main

Step 10
Run full regression

Step 11
Generate test report

Step 12
Open PR
```

---

# 18. REQUIRED COMMANDS BEFORE PR

```bash
npm run db:reset
npm run test:backend
npm run test:api
npm run test:api:report
```

Concurrency environment:

```text
ORDER_CONCURRENCY_TEST=1
DB_NAME=clothes_test
```

Sau đó:

```bash
npm run test:order-concurrency
```

---

# 19. RELEASE GATE

## GO

Chỉ GO khi:

```text
db reset PASS
unit tests PASS
Postman Phase 2 P0 PASS
State Transition PASS
rollback PASS
ownership PASS
RBAC PASS
cancel idempotency PASS
concurrency PASS
Phase 1 regression PASS
S1 = 0
S2 = 0
```

## NO-GO

NO-GO nếu còn:

```text
db reset không reproducible
oversell chưa được verify
partial rollback
fake price accepted
double stock restore
ownership bypass
invalid transition accepted
```

---

# 20. TECH LEAD / TEST LEAD CONCLUSION

Branch `feature/phase-2-order-integrity` đã giải quyết tốt phần khó nhất của Phase 2 ở tầng backend.

Kiến trúc hiện tại:

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

là hướng phù hợp.

Điểm còn thiếu hiện tại chủ yếu nằm ở:

```text
reproducibility
integration verification
test automation
release evidence
```

Do đó đánh giá cuối cùng:

```text
CORE BACKEND        : PASS WITH MINOR FOLLOW-UP
UNIT TEST FOUNDATION: PASS
INTEGRATION TEST    : INCOMPLETE
CONCURRENCY GATE    : NOT VERIFIED
POSTMAN E2E         : INCOMPLETE
RELEASE STATUS      : BLOCKED
```

Sau khi xử lý P0 và chạy đầy đủ gate, branch có thể chuyển sang trạng thái:

```text
READY FOR PR / MERGE REVIEW
```
