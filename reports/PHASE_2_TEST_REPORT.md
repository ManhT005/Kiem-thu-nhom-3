# Phase 2 Order Integrity Test Execution Report

**Branch:** `feature/phase-2-order-integrity`  
**Executed at:** 2026-10-06  
**Environment:** Windows, Node.js v24.12.0  
**Database:** MySQL 8.0.45 (`ptda-mysql` container, port 3306)  
**Release status:** **READY FOR PR / MERGE (GO)**

---

## 1. Executive Summary

All P0 merge blockers and P1 closure defects identified in Phase 2 have been fully resolved and verified against real MySQL 8.0:

- **Database Reproducibility:** `db:reset` and `db:seed` deterministic paths and safety guards validated.
- **Deterministic Fixtures:** `db:seed:phase2` successfully provisions test accounts, product variants, and stock tiers.
- **Backend Unit Suite:** 13/13 unit tests pass without error.
- **Integration & Lifecycle:** Order creation, stock reservation, status transitions (`PENDING` -> `CONFIRMED` -> `SHIPPING` -> `COMPLETED`), cancellation, and audit history verification passed 100%.
- **MySQL Concurrency & Oversell Protection:** 20 repeated executions of concurrent order placement (`stock=1`, `stock=5` with 10 concurrent competing shoppers, multi-product lock ordering) executed with **0 oversell**, **0 deadlocks**, and deterministic final stock state.
- **Postman / Newman E2E Suite:** 41/41 API requests and 78/78 test assertions executed with 100% pass rate.
- **RBAC & Ownership Security:** User-only routes (`/create`, `/cancel`, `/my-orders`) and staff/admin boundaries strictly enforced with 403 responses for unauthorized callers.
- **Frontend State Machine & Status Alignment:** Staff dropdown only presents valid transitions with auto-resync upon API rejection; Profile status badges use normalized canonical classes (`status-pending`, `status-confirmed`, `status-shipping`, `status-completed`, `status-cancelled`).

---

## 2. Test Execution Results

| Suite | Executed | Passed | Failed | Skipped | Status | Details |
|---|---:|---:|---:|---:|---|---|
| **Backend Unit Tests** | 13 | 13 | 0 | 0 | **PASS** | `npm run test:backend` (domain, service, repository, transactions) |
| **Integration Suite** | 5 | 5 | 0 | 0 | **PASS** | `npm run test:integration` with live MySQL 8.0 |
| **Concurrency (20 runs)** | 60 | 60 | 0 | 0 | **PASS** | 20 consecutive iterations of concurrency suite, 0 oversell, 0 deadlocks |
| **Postman / Newman E2E** | 41 | 41 | 0 | 0 | **PASS** | 78 assertions across 41 requests covering auth, creation, rollback, cancel, state machine, RBAC, history, filter |
| **Frontend Script Verification** | 2 | 2 | 0 | 0 | **PASS** | `staff.js` and `profile.js` validated with `node --check` |
| **Phase 1 Regression** | 8 | 8 | 0 | 0 | **PASS** | Health endpoint, 404 handler, auth guards, cart/inventory checks all intact |

---

## 3. Concurrency Test Evidence

**Command:**
```powershell
$env:DB_NAME="clothes_test"; $env:ORDER_CONCURRENCY_TEST="1"; 1..20 | ForEach-Object { npm run test:order-concurrency }
```

- **Total iterations:** 20 runs (3 tests per run = 60 test executions)
- **Stock = 1 race:** Fulfilled: 1, Rejected: 1 (Reason: `INSUFFICIENT_STOCK`), Final stock: 0 across all 20 runs.
- **Stock = 5 race with 10 competitors:** Fulfilled: 5, Rejected: 5 (Reason: `INSUFFICIENT_STOCK`), Final stock: 0 across all 20 runs.
- **Multi-product lock ordering (A->B vs B->A):** Fulfilled: 2, Rejected: 0, Deadlocks: 0, Final stock: exactly 0 across all 20 runs.
- **Oversell count:** **0**
- **Deadlock count:** **0**

---

## 4. API & Business Flow Coverage (Newman)

**Command:**
```powershell
npm run test:api
```

- **Iterations:** 1
- **Requests executed:** 41
- **Assertions:** 78
- **Failed assertions:** 0
- **Total run duration:** ~4.4s

Key verified scenarios:
1. `POST /api/orders/create` ignores client-side `tongTien` / `gia` and prices exclusively from locked server catalog.
2. Invalid variant IDs return `404 ORDER_VARIANT_NOT_FOUND`.
3. Duplicate variants in single payload return `400 ORDER_DUPLICATE_ITEM`.
4. Invalid payment methods return `404 PAYMENT_METHOD_NOT_FOUND`.
5. Insufficient stock rejects order with `409 INSUFFICIENT_STOCK`.
6. Multi-item transaction rollback: failure of second item preserves first item stock unchanged and rolls back all writes.
7. Customer can cancel own `Chờ xác nhận` order, immediately restoring inventory and inserting audit history.
8. Second cancellation attempt returns `409 ORDER_ALREADY_CANCELLED` without duplicate stock restoration.
9. Cross-customer cancellation is denied with `403 ORDER_ACCESS_DENIED`.
10. Valid state transitions: `Chờ xác nhận` -> `Đã xác nhận` -> `Đang giao` -> `Hoàn thành`.
11. Invalid transitions (`Chờ xác nhận` -> `Đang giao`, `Hoàn thành` -> `Đã hủy`) rejected with `409 INVALID_ORDER_TRANSITION` / `409 ORDER_CANCEL_NOT_ALLOWED`.
12. Audit history (`GET /api/orders/:id/history`) accessible by owner and staff; rejected for other users with 403.
13. Staff filter (`GET /api/orders/admin/filter`) returns pagination and filtered orders with parameter binding.

---

## 5. Defect Closure Status

| Defect ID | Description | Resolution | Status |
|---|---|---|---|
| **P2-DEF-01** | `db:reset` resolve sai path & thiếu safety guard | Dùng `import.meta.url` repo root + safety check production / invalid db name | **CLOSED** |
| **P2-DEF-02** | `db:seed` resolve sai path | Path trỏ chính xác vào `database/seeds/001_reference_data.sql` | **CLOSED** |
| **P2-DEF-03** | Postman collection thiếu business coverage | Bổ sung 10 request test nghiệp vụ Phase 2 (variants, duplicate, RBAC, history, filter) | **CLOSED** |
| **P2-DEF-04** | Concurrency chưa verify với MySQL thật | Chạy 20 vòng lặp trên MySQL 8.0, 0 oversell, 0 deadlock | **CLOSED** |
| **P2-DEF-05** | Thiếu deterministic fixture | Thêm `db:seed:phase2` cho accounts, products, stock levels | **CLOSED** |
| **P2-DEF-06** | Create order chưa chốt RBAC | Khóa route `authorizeRoles("user")`, chặn staff/admin | **CLOSED** |
| **P2-DEF-07** | Cancel order & My orders chưa chốt RBAC | Khóa route `authorizeRoles("user")` | **CLOSED** |
| **P2-DEF-08** | Staff UI cho transition sai | `ORDER_TRANSITIONS` giới hạn chỉ hiển thị transition hợp lệ | **CLOSED** |
| **P2-DEF-09** | Staff UI không resync khi API fail | Thêm `await renderStaffOrders()` trong cả nhánh error | **CLOSED** |
| **P2-DEF-10** | Profile dùng legacy status | Chuẩn hóa sang 5 canonical classes trong `profile.js` và `profile.css` | **CLOSED** |
| **P2-DEF-11** | Develop sync & CI gate | Thêm workflow GitHub Actions với MySQL 8.0 service và Newman runner | **CLOSED** |

---

## 6. Open Defects

**None.** All P0 and P1 criteria from `PHASE_2_FIX_GUIDE.md` are satisfied.

---

## 7. Release Recommendation

**GO.** The Phase 2 order integrity implementation is complete, reproducible, and verified.
