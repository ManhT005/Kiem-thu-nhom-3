# WHITE-BOX TEST EXECUTION & AUDIT REPORT

Date: 2026-10-30 | Repository: ManhT005/Kiem-thu-nhom-3
Baseline: main @ 59cc5c89c6ddbaaa131f640b3008f4bc2ef2a0df
Test branch: test/whitebox-coverage-20261030
Status: TESTS SUBMITTED TO CI; final pass/coverage requires workflow evidence. Do not equate existing historical reports with this run.

## 1. Scope clarification
The application implements ORDER_STATUS.PENDING/CONFIRMED/SHIPPING/COMPLETED/CANCELLED (Vietnamese string values), not PAID/DELIVERED as order-status enum cases. MoMo payment has a separate payment state. Roles are lower-case `admin`, `user`, `staff` (not `ADMIN`/`STAFF_KHO`). Voucher persistence uses `enabled`, `start_at`, `end_at`, `minimum_order_amount`, `maximum_discount_amount`; descriptions in the user-provided scope must be mapped to actual fields.

Unit tests alone cannot prove concurrency, MySQL transactional isolation, provider-side MoMo IPN delivery or whole-system production readiness. Every statement below distinguishes code coverage from observed behavior.

## 2. Traceability matrix

| ID | Module / target | White-box technique | Test file | Verification |
|---|---|---|---|---|
| WB-ORD-01 | domain/order-status.js | exhaustive 5x5 transition decision matrix, invalid states | tests/whitebox/core-whitebox.test.js | 5 legal transitions among 25 pairs, non-enum values rejected |
| WB-VOU-01 | domain/voucher.js calculateVoucher | decision table; each guard independently falsified, boundary dates | same | disabled, not started, expired, subtotal, usage, per-user limits; start/end boundaries |
| WB-VOU-02 | domain/voucher.js discount | branches for fixed vs percent, cap vs no cap, subtotal clamp, integer rounding | same | numerical discount asserts |
| WB-VOU-03 | domain/voucher.js input | invalid partitions / normalization | same | bad code/type/value/date/status/limits rejected |
| WB-INV-01 | domain/inventory.js | boundary values, duplicate decision, overflow | same | receipt and pagination validation |
| WB-INV-02 | services/inventory.service.js | mutation guard branches | same | invalid event, missing/inactive variant, insufficiency and overflow avoid writes |
| WB-INV-03 | services/inventory.service.js | idempotence and conditional-path test | same | duplicate/conflict/update failure/success |
| WB-AUTH-01 | middleware/authenticate.middleware.js | invalid/missing/expired/tampered JWT, optional path | same | 401 and conditional next |
| WB-AUTH-02 | middleware/authenticate & authorize | branch/condition | same | persisted role beats JWT advisory, lock/revoke/deleted, 403 |
| WB-MOMO-01 | services/momo.service.js | security and HMAC path | same | signed/altered IPN, bad signature, URL allowlist |
| WB-MOMO-02 | services/momo.service.js | gateway request happy/invalid paths with injected fetch | same | pre-network rejection and HMAC of outbound request |
| WB-JOB-01 | jobs/payment-expiration.js | concurrency and timer guards | same | invalid interval, disabled, in-flight duplicate, stopped |
| WB-REP-01 | domain/reporting.js | condition and boundary testing | same | calendar, UTC, 24-bucket bound, filters, SQL whitelist, BigInt |
| INT-ORD-01 | services/order.service.js and SQL | MySQL transactional integration | existing tests/integration/order-concurrency.test.js | parallel checkout / no oversell (run with test DB) |
| INT-PAY-01 | payment.service.js and reconciler | SQL integration & mock callbacks | existing tests/integration/payment-integrity.test.js | transactions/IPN/rollback (run with test DB) |
| INT-INV-01 | inventory + SQL | integration / migration | existing inventory-integrity and inventory-migration tests | SQL consistency & migration |
| INT-REP-01 | dashboard + SQL | SQL aggregation cross-check | existing dashboard-reporting tests | reconciliation and report integrity |
| INT-RBAC-01 | RBAC matrix | integration roles vs endpoints | existing user-voucher-integrity tests + API suite | role/method consistency |

The suite is representative white-box coverage, **not** a claim of exhaustive path/MC/DC coverage across the repository. Measure statement/function/branch coverage with actual CI output before assigning numeric percentages.

## 3. Commands

From repository root:

```bash
npm --prefix backend ci
node backend/scripts/run-whitebox.js
```

This targeted run does not require MySQL or external MoMo credentials. Its outputs include `test-results/whitebox/junit.xml`; Node prints coverage totals for the instrumented modules in CI logs.

To run the broader DB-backed suite, first provision a disposable MySQL 8.0 database named `clothes_test` and set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET` and `ORDER_CONCURRENCY_TEST=1`; then run `npm run db:reset`, `npm run db:seed:phase2`, `npm run test:integration`. **Never run db:reset on a production database**.

## 4. Existing CI verification
Main CI run on 2026-10-27: https://github.com/ManhT005/Kiem-thu-nhom-3/actions/runs/40531727292
- PASS steps: install, syntax, unit, DB reset/seed, integration, API regression.
- FAIL infrastructure step: `npx playwright install --with-deps chromium` timed out after 8 minutes (apt-mirror access); remaining browser/evidence/security steps skipped.
- The final Phase 6 acceptance report describes previous baseline success (57 unit, 43 integration, 11 browser, 316 API assertions) but does not certify this new white-box branch or the failing main run.

## 5. Coverage and release decisions
- WB acceptance gate: test process EXIT 0, all 13 named subtests pass, JUnit artifact present, coverage output reviewed and snapshot saved.
- Branch coverage should be interpreted per file; a combined coverage percentage must not be described as MC/DC. At least one MC/DC pair for each independent voucher eligibility predicate is demonstrated conceptually; formal MC/DC requires a full condition/pair matrix and structural verification, beyond what is claimed here.
- Integration gate: run against MySQL 8.0 disposable DB; verify concurrent transaction outcomes and inventory consistency.
- Security gate: spoofed JWT and invalid MoMo signatures rejected; external MoMo sandbox IPN still requires HTTPS/public callback proof.
- Browser gate: unblock Chromium installation and run Playwright tests; browser execution not inferred from unit tests.
- Release status is HOLD until new branch CI is confirmed green, browser/evidence gates complete, and human acceptance is signed.

## 6. Known gaps / proposed follow-up
1. Add explicit LCov or V8 JSON output and set coverage thresholds only after observed baseline; `--experimental-test-coverage` reports line/branch/function summaries but does not imply MC/DC.
2. Add exhaustive integration-level cross-user RBAC and invalid request-body precedence checks.
3. Add payment expiration vs late IPN race and repeat callback cases under MySQL transaction isolation.
4. Add voucher redemption contention and rollback verification under concurrent checkout.
5. Fix the main Playwright dependency-install timeout independently (cache/pre-installed browser or pinned image; avoid dropping browser gate).
6. Gather external sandbox/public IPN evidence, manual UI acceptance, and release-owner sign-off.
