# KẾ HOẠCH UPDATE TỔNG QUÁT PROJECT

**Project:** `ManhT005/Kiem-thu-nhom-3`  
**Baseline:** `main/develop @ 5d169de8bab9c47d12d7e77f610905bb24a30591`  
**Định hướng:** Kế thừa project cũ, nâng cấp theo hướng testable, maintainable và đủ chiều sâu nghiệp vụ cho môn Kiểm thử phần mềm.

---

## 1. Mục tiêu tổng thể

Không rewrite project.

Mục tiêu là nâng project từ trạng thái:

```text
Legacy functional demo
```

thành:

```text
Testable REST API
+ Business rules rõ ràng
+ Data integrity
+ RBAC
+ Automated regression
+ Reproducible database
```

Các tiêu chí cuối:

- API contract nhất quán
- authentication/authorization đúng semantics
- database có migration + seed
- order/inventory dùng transaction
- state machine rõ ràng
- có voucher có nhiều điều kiện để test Decision Table/BVA
- có dashboard để test data correctness
- có Postman Collection + Newman report
- regression chạy được tự động
- không còn Critical/Blocker defect trước demo

---

## 2. Nguyên tắc triển khai

### 2.1. Incremental modernization

Không thay Express/MySQL/Vanilla JS nếu không cần.

Refactor theo từng vùng có business value.

### 2.2. Backend là source of truth

Không tin:

- role từ localStorage
- giá từ frontend
- tổng tiền từ frontend
- trạng thái do UI tự giới hạn
- tồn kho do frontend tính

### 2.3. Mọi feature mới phải testable

Mỗi endpoint mới cần:

- contract
- validation
- status code
- success/error code
- test case
- seed data cần thiết

### 2.4. Test automation phát triển cùng feature

Không đợi code xong toàn bộ mới viết Postman.

---

# 3. Roadmap đề xuất

## Phase 1 - Stabilization & API Contract Foundation

### Mục tiêu

Tạo baseline kỹ thuật ổn định để các phase sau có thể phát triển và kiểm thử.

### Scope

- repository hygiene
- environment/config
- strict authentication
- baseline RBAC
- standard response/error
- central validation
- DB migration/seed baseline
- API base URL cleanup
- smoke/regression Postman foundation

### Deliverables

```text
.env.example
database/migrations/
database/seeds/
middleware/auth
middleware/authorize
middleware/error-handler
validators/
utils/api-response
tests/postman/
Newman scripts
```

### Exit Criteria

- protected endpoint thiếu token -> 401
- token không đủ quyền -> 403
- không còn public stock mutation
- API core có response contract chung
- invalid payload có deterministic validation error
- DB có thể dựng mới bằng script
- Newman smoke suite chạy được

---

## Phase 2 - Order Integrity, State Machine & Transaction

### Mục tiêu

Biến Order thành module nghiệp vụ có rule rõ ràng và transaction-safe.

### Scope

- refactor `createOrder`
- server-side price calculation
- stock validation
- DB transaction
- order state machine
- cancel order
- inventory restore atomic
- audit trail
- admin/staff filter
- order ownership validation

### State Machine mục tiêu

```text
PENDING
  ├── CONFIRMED
  │      ├── SHIPPING
  │      │      └── COMPLETED
  │      └── CANCELLED
  └── CANCELLED
```

Không cho:

```text
COMPLETED -> *
CANCELLED -> *
SHIPPING -> CANCELLED
```

### Database

Thêm:

```text
LichSuDonHang
```

và nếu cần chuẩn hóa enum/status code.

### Testing Focus

- State Transition Testing
- transaction rollback
- concurrent/edge stock test
- RBAC
- ownership
- data integrity

### Exit Criteria

- không thể oversell bằng request thông thường
- order fail -> rollback toàn bộ
- cancel chỉ restore stock đúng một lần
- mọi state change có audit log
- test state matrix pass 100%

---

## Phase 3 - Inventory & Goods Receipt

### Mục tiêu

Thay việc chỉnh `soLuongTon` trực tiếp bằng nghiệp vụ kho có chứng từ.

### Scope

- Phiếu nhập kho
- Chi tiết phiếu nhập
- nhập kho transaction
- low stock API
- inventory movement history
- liên kết order sale/cancel với movement log

### Database

```text
PhieuNhap
ChiTietPhieuNhap
LichSuKho / InventoryMovement
```

Khuyến nghị dùng movement model:

```text
RECEIPT      +N
ORDER        -N
CANCEL       +N
ADJUSTMENT   +/-N
```

### Testing Focus

- BVA `soLuongNhap`
- BVA `giaNhap`
- transaction
- aggregate stock
- inventory history consistency

---

## Phase 4 - User Lifecycle, RBAC & Voucher

### Mục tiêu

Tạo nhiều điều kiện nghiệp vụ phù hợp cho Security Testing và Decision Table Testing.

### Scope A - User lifecycle

- ACTIVE / LOCKED
- lock/unlock user
- login block khi LOCKED
- active JWT vẫn phải bị chặn nếu account đã LOCKED

### Scope B - RBAC

Roles:

```text
user
staff
admin
```

Ma trận quyền phải định nghĩa ở backend.

### Scope C - Voucher

- CRUD Voucher
- PERCENT / FIXED
- min order
- start/end time
- usage limit
- enabled/disabled
- max discount
- apply voucher

### Testing Focus

- RBAC Matrix
- Decision Table
- BVA
- duplicate usage
- expired/not-started/disabled
- percentage max cap

---

## Phase 5 - Dashboard, Reporting & Payment Integrity

### Mục tiêu

Hoàn thiện khả năng thống kê và củng cố payment flow.

### Dashboard APIs

```text
GET /api/admin/dashboard/summary
GET /api/admin/dashboard/top-products
GET /api/admin/dashboard/revenue-chart
```

Revenue chỉ tính:

```text
COMPLETED
```

### Payment

MoMo Sandbox hiện chỉ là demo.

Nâng cấp:

- tạo payment transaction record
- order/payment correlation
- redirect != payment confirmation
- IPN endpoint backend
- verify signature
- idempotent payment update
- amount lấy từ server-side order total

### Testing Focus

- aggregate correctness
- date boundaries
- payment signature
- replay/idempotency
- failure callbacks

---

## Phase 6 - Final QA, Regression, CI & Release Hardening

### Mục tiêu

Đóng project ở trạng thái có thể demo, chấm điểm và tái chạy toàn bộ test.

### Scope

- complete Postman suite
- Newman CLI
- HTML report
- data-driven tests
- regression pack
- GitHub Actions
- lint/basic static check
- final seed
- documentation
- deployment/runbook

### Optional

- basic performance smoke with Newman/k6
- API response time baseline
- dependency audit

### Exit Criteria

Theo Master Test Plan:

- 100% in-scope API có test
- >= 95% pass rate
- 0 S1
- 0 S2
- Newman chạy độc lập
- HTML report xuất thành công

---

# 4. Mapping roadmap với tài liệu hiện tại

| Existing Scaling Plan | Roadmap mới | Lý do |
|---|---|---|
| GĐ1 Response + Validation | Phase 1 | Giữ nguyên nhưng bổ sung Security/DB/Test foundation |
| GĐ2 Order State Machine | Phase 2 | Giữ nguyên, tăng transaction/data integrity |
| GĐ3 Inventory | Phase 3 | Giữ nguyên |
| GĐ4 Voucher + RBAC | Phase 4 | Giữ nguyên, bổ sung account lifecycle |
| GĐ5 Dashboard | Phase 5 | Giữ, bổ sung payment hardening |
| Chưa tách riêng | Phase 6 | Final regression/CI/release |

Điểm thay đổi quan trọng:

> Security baseline, DB reproducibility và test automation foundation được kéo lên Phase 1, vì nếu không làm sớm thì các phase sau sẽ khó kiểm thử và dễ tạo thêm debt.

---

# 5. Kiến trúc mục tiêu sau Phase 2

```text
Request
   │
   ▼
Route
   │
   ├── Validation
   ├── Authentication
   └── Authorization
   │
   ▼
Controller
   │
   ▼
Service
   │
   ├── Business Rules
   ├── Transaction
   └── State Machine
   │
   ▼
Repository / Model
   │
   ▼
MySQL
```

Response đi qua contract chung:

```text
Success/Error Response
        │
        ▼
Central Error Middleware
```

---

# 6. Branch Strategy đề xuất

Baseline:

```text
main
develop
```

Hiện `main` và `develop` đang cùng commit.

Luồng:

```text
main
 └── develop
      ├── feat/phase-1-api-foundation
      ├── feat/phase-2-order-state-machine
      ├── feat/phase-3-inventory
      ├── feat/phase-4-voucher-rbac
      └── feat/phase-5-dashboard-payment
```

Bugfix:

```text
fix/<module>-<short-description>
```

Test:

```text
test/postman-<module>
```

Không làm trực tiếp trên `main`.

---

# 7. Commit convention

Khuyến nghị:

```text
feat:
fix:
refactor:
test:
docs:
chore:
```

Ví dụ Phase 1:

```text
chore: clean tracked dependencies and env files
refactor: centralize API response and error handling
fix: enforce authentication on protected routes
feat: add role authorization middleware
feat: add request validation layer
chore: add database baseline migrations and seeds
test: add Postman smoke collection and Newman runner
```

---

# 8. Test Strategy xuyên suốt roadmap

| Phase | Technique chính |
|---|---|
| Phase 1 | EP, BVA, Negative API, Auth/RBAC smoke |
| Phase 2 | State Transition, E2E, Transaction |
| Phase 3 | BVA, Data Integrity |
| Phase 4 | Decision Table, RBAC |
| Phase 5 | Aggregate validation, Integration |
| Phase 6 | Regression, Data-driven, Performance smoke |

---

# 9. Definition of Done cho mọi feature

Một feature chỉ Done khi:

- code hoàn thành
- validation đầy đủ
- auth/RBAC đúng
- status code đúng
- API response đúng contract
- không expose raw DB error
- migration có nếu đổi schema
- seed/test fixture có nếu cần
- Postman test có
- positive case pass
- negative case pass
- edge case pass
- documentation cập nhật

---

# 10. Ưu tiên thực thi

## P0 - Làm ngay

1. auth middleware strict
2. secure Order admin APIs
3. secure Inventory mutation
4. remove hard-coded secrets
5. database baseline
6. response/error/validation foundation

## P1 - Sau Phase 1

1. Order transaction
2. State Machine
3. server-side price
4. audit trail
5. goods receipt

## P2 - Sau khi data integrity ổn

1. voucher
2. account lock
3. dashboard
4. MoMo lifecycle

---

# 11. Mốc chất lượng đề xuất

### Milestone A - Foundation Ready

Sau Phase 1:

```text
Project chạy ổn định
+ test được
+ quyền truy cập đúng
+ DB dựng lại được
```

### Milestone B - Business Integrity Ready

Sau Phase 3:

```text
Order + Inventory transaction-safe
```

### Milestone C - Testing Feature Complete

Sau Phase 5:

```text
Đủ module cho EP/BVA/DT/ST/RBAC/E2E
```

### Milestone D - Release Candidate

Sau Phase 6:

```text
Automated regression
+ report
+ no critical defect
```

---

# 12. Kết luận

Roadmap mới không thay đổi mục tiêu của `PROJECT_SCALING_PLAN.md`, mà sắp xếp lại theo dependency kỹ thuật.

Trọng tâm:

```text
Testability trước
Data Integrity tiếp theo
Business Complexity sau
Automation xuyên suốt
```

Đây là hướng phù hợp nhất với một project được kế thừa từ code cũ nhưng cần nâng lên thành project kiểm thử phần mềm có chiều sâu.
