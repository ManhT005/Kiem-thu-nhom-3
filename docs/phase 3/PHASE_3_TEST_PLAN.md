# Phase 3 test plan

Requirements: master plan P3-00–P3-06 and P3-REC/MOV/CNC/ADJ/SEC/QRY/MIG/REG. Baseline: merged Phase 2. Environment: Node 22, MySQL 8, dedicated *_test database, Chromium.

| Technique / cases | Inputs / steps | Expected / implemented evidence |
|---|---|---|
| EP/BVA P3-REC-05/06 | Quantities 0, -1, 1, INT_MAX, INT_MAX+1; costs -1, 0, 0.01, >2 decimal places, oversized aggregate; duplicate/empty/unknown items | Validation before writes; inventory-domain unit tests and transaction integration |
| State P3-REC-01/02/03 | Create two-line draft, post, post concurrently ten times | Draft leaves stock untouched; one POST transition, two receipt movements; inventory-integrity integration |
| Rollback P3-REC-04 | First item valid; second stock exceeds INT_MAX | Entire receipt/header/stock/ledger rolls back |
| Ledger P3-MOV-01–04 | Create order; fail second line; ten cancellations | One sale/restore per variant, no orphan movement, repeated cancellation cannot restore |
| Concurrency P3-CNC-01/02 | Receipt vs Order; two buyers stock 1; ten buyers stock 5; reversed multi-item inputs | Correct final sum, no oversell/lost update; existing Phase 2 and new inventory tests |
| EP/Replay P3-ADJ-01 | Admin positive/negative delta, blank reason, repeated key, different payload, underflow | One auditable document; duplicate no write; conflict/invalid rejected |
| RBAC P3-SEC-01/02 | Guest, user, staff, admin against receipt/adjustment/reconcile; legacy setter | 401/403; admin legacy absolute setter 409; Phase3 Newman |
| Invariant P3-REC-07 | opening + all business deltas vs current snapshot | Difference 0 for affected variants; reconciliation read-only |
| Query P3-QRY-01 | threshold=stock-1/stock; variant/event/page/date filters; invalid/injection strings | Validated/bound filters and correct page/boundary |
| Migration P3-MIG-01 | Legacy 001–004 adoption, stock 7, apply 005 twice, test-only down/up | Stock remains 7; one opening; isolated inventory-migration test |
| Bypass hardening | Product stock payload 999, removing nonzero variant, disabling zero-stock variant | Reject stock write; conflict on positive stock; keep disabled variant/ledger |
| Browser | Staff multi-row form, draft stock check, POST, duplicate API retry, admin-only controls | Real Express/MySQL receipt flow and screenshot |
| Regression P3-REG-01 | All Phase 1/2 unit/API/browser/lifecycle/payment races | Existing price/auth/cart/order/payment behavior retained |

Run `npm run test:all` after dedicated fixture setup. Integration suites run serially to isolate global worker fixtures; individual concurrency cases still issue real parallel database transactions. Require zero failing/skipped critical cases, no stock invariant failure and fresh artifacts. Remote CI must pass on the final pushed head before GO.
