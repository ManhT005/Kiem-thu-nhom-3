# WHITE-BOX TEST EXECUTION & AUDIT REPORT

Date: 2026-10-30 | Repository: ManhT005/Kiem-thu-nhom-3
Baseline: main @ 59cc5c89c6ddbaaa131f640b3008f4bc2ef2a0df
Test branch: test/whitebox-coverage-20261030
Status: FOCUSED WHITE-BOX CI PASS (13/13), FULL REGRESSION / RELEASE PENDING. Do not equate existing historical reports with this run.

## Actual CI evidence — 2026-10-30

**Latest verified White-box CI: PASS.** Run `41022023605` succeeded on 2026-10-30.

- Workflow: https://github.com/ManhT005/Kiem-thu-nhom-3/actions/runs/41022023605
- Branch head: `8c233d4be360c5c0195cab220452f39d7323ea29`; GitHub Actions executed the PR merge ref `58f7ba4b01805fbee3d49cc7525e489f34d64791`.
- Runner: Ubuntu 24.04, Node.js `22.23.4`, npm `10.9.9`.
- Job: `123951298845` — completed successfully; JUnit artifact `whitebox-evidence.zip` uploaded (artifact ID `12961668769`).
- Tests: 13 total, 13 pass, 0 fail, 0 skipped.
- Coverage for **9 explicitly included files only**: lines 95.49%, branches 88.25%, functions 91.49%.
- Coverage by file (lines / branches / functions):
  - domain/order-status.js: 100 / 100 / 100
  - domain/voucher.js: 100 / 91.55 / 100
  - domain/inventory.js: 94.03 / 89.09 / 91.67
  - domain/reporting.js: 100 / 84.93 / 88.89
  - services/inventory.service.js: 100 / 100 / 100
  - services/momo.service.js: 90.18 / 67.50 / 100
  - middleware/authenticate.middleware.js: 100 / 95.65 / 66.67
  - middleware/authorize.middleware.js: 100 / 100 / 100
  - jobs/payment-expiration.js: 92.11 / 100 / 83.33

These are not whole-backend coverage numbers. MoMo service branch coverage (67.50%) is the largest relative gap. The separate full Commerce Regression workflow must still complete successfully to certify DB, browser, security and evidence gates.

## Repository integration status

As verified on 2026-10-30, PR [#17](https://github.com/ManhT005/Kiem-thu-nhom-3/pull/17) is **closed and not merged**. The test source, runner, workflow and this report remain on `test/whitebox-coverage-20261030`; they are not part of `main`. Reopen the pull request or create a reviewed replacement PR before treating these changes as integrated.

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
- WB acceptance gate: latest test process EXIT 0; 13 named subtests pass, 0 fail/skip; JUnit artifact uploaded and coverage output recorded in run `41022023605`.
- Branch coverage should be interpreted per file; a combined coverage percentage must not be described as MC/DC. At least one MC/DC pair for each independent voucher eligibility predicate is demonstrated conceptually; formal MC/DC requires a full condition/pair matrix and structural verification, beyond what is claimed here.
- Integration gate: run against MySQL 8.0 disposable DB; verify concurrent transaction outcomes and inventory consistency.
- Security gate: spoofed JWT and invalid MoMo signatures rejected; external MoMo sandbox IPN still requires HTTPS/public callback proof.
- Browser gate: unblock Chromium installation and run Playwright tests; browser execution not inferred from unit tests.
- Focused white-box CI is green, but integration/release status remains HOLD until DB integration, browser/evidence gates and human acceptance complete. PR #17 is closed/unmerged, so code review and integration are still required.

## 6. Known gaps / proposed follow-up
1. Add explicit LCov or V8 JSON output and set coverage thresholds only after observed baseline; `--experimental-test-coverage` reports line/branch/function summaries but does not imply MC/DC.
2. Add exhaustive integration-level cross-user RBAC and invalid request-body precedence checks.
3. Add payment expiration vs late IPN race and repeat callback cases under MySQL transaction isolation.
4. Add voucher redemption contention and rollback verification under concurrent checkout.
5. Fix the main Playwright dependency-install timeout independently (cache/pre-installed browser or pinned image; avoid dropping browser gate).
6. Gather external sandbox/public IPN evidence, manual UI acceptance, and release-owner sign-off.
