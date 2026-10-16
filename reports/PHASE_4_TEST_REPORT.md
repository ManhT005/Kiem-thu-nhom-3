# Phase 4 test report

Date: 2026-10-12. Tester: Codex automated suites.
Branch: **feature/p4-user-voucher**, based on Phase 3 head **6b0550f063d8be7fb24746bc7ff3f3b2a158754a**.
Tested implementation: **9e5a566762cc8bb9e1b2af5a26de120141380fc6** (includes 78f8ed4 and the UI/test synchronization fix).
The report was added as a documentation-only follow-up; display-only verification is recorded below.

Environment: Windows/Asia-Saigon; Node **22.23.3**, MySQL **8.0.46**, Chromium **156.0.8078.4**. Dedicated clothes_p34_test database on 127.0.0.1:13316, business sessions UTC/READ COMMITTED with canonical stock locks. Schema 001–006 was rebuilt only in this disposable database.

Final command: `npm exec --yes --package=node@22 --call 'npm run test:all'` with DB settings, ORDER_CONCURRENCY_TEST=1 and a test-only JWT secret. Final exit **0**.

| Suite | Executed/pass | Failed | Skipped |
|---|---:|---:|---:|
| Static JS syntax | All backend/frontend JS | 0 | 0 |
| Unit/routes/lifecycle/domain | 49/49 | 0 | 0 |
| MySQL integration/concurrency/migration | 32/32 | 0 | 0 |
| Phase 1/2 Newman | 41 requests / 78 assertions | 0 | 0 |
| Phase 3 Newman | 18 requests / 27 assertions | 0 | 0 |
| Phase 4 Newman | 30 requests / 43 assertions | 0 | 0 |
| Chromium | 9/9 (5 controlled UI cases + 4 real Express/MySQL E2E) | 0 | 0 |

Totals across Newman: **89 requests / 148 assertions**, all passing. The RBAC integration case also executes **48 real HTTP role/operation combinations**.

## Requirement traceability

| Cases | Actual evidence / observation |
|---|---|
| P4-U-01/02 | ACTIVE login issues versioned JWT; LOCKED valid-password login is 403 ACCOUNT_LOCKED |
| P4-U-03/04 | JWT issued before lock is rejected; unlock advances version again, so old JWT remains 401 TOKEN_REVOKED; new login works |
| P4-U-05 | Legacy and canonical role changes audit/revoke; old staff token is 401, fresh demoted identity cannot receive goods; JWT advisory role never overrides DB |
| P4-U-06 | Self-management/last-admin/version overflow guards; reciprocal simultaneous admin demotions serialize with one surviving active admin |
| P4-R-01 | Guest/user/staff/admin × 12 protected operations: 401/403 precede mutation, permitted invalid payloads reach 400 validation |
| P4-R-02 | Retained Order/payment owner guards and server-overridden actor/user IDs pass; no frontend role used as authorization |
| P4-V-01–08 | Disabled/not-started/expired/min/global/per-user eligibility, normalized code and retry semantics pass pure decision table and MySQL application tests |
| BVA | Percent 0/1/100/101, fixed >subtotal, floor/cap zero, minimum-1/min, start-1ms/start, end-1ms/end, zero/unlimited limits and malformed dates/money pass |
| P4-V-09 | Ten buyers compete for usage_limit=1: one order/redemption, nine eligibility failures, used_count=1 and stock decreases once |
| P4-V-10 | Unknown/disabled/per-user exhausted vouchers keep existing cart, stock, ledger and order counts unchanged |
| P4-V-11 | Real trigger failure on the second ORDER ledger insert after reservation rolls back voucher count/redemption, order and both stock rows |
| P4-V-12 | Ten cancellations release usage once; MoMo FAILED/EXPIRED release once; PAID commits; paid cancellation retains usage and records REFUND_REQUIRED; late expired success does not consume again |
| P4-V-13/14 | Fake subtotal/price/discount ignored; preview uses DB price without consuming; ten same-key retries return one order; voucher edits preserve stored subtotal/discount/code/final total |
| Migration | Legacy GiamGia and DonHang FK/price preserved; legacy codes disabled; inclusive dates become exclusive end; user defaults set; replay and guarded test-only down/up pass; locked-user rollback rejected |
| P4-REG-01 | All Phase 1–3 unit, Order/payment/inventory races, opening/migration, Newman and Chromium tests pass |

## Actual UI/API/MySQL E2E

- Admin account UI filters a disposable user, locks/unlocks and changes role with a reason. API checks prove old sessions fail at each transition and a new staff login can access inventory. Screenshot: phase4-users.png.
- Admin voucher UI creates a FIXED 500 VND voucher. Real checkout displays a fake client price of 1, but preview computes subtotal 3000 and discount 500; preview count is zero, order final total is 2500 and used_count becomes one. Cancellation releases once. Screenshot: phase4-checkout.png.
- Retained real COD and staff receipt flows, plus five controlled browser navigation/retry/return-state tests, also pass.

## Defect correction and evidence

The first full run reached 49 unit, 32 MySQL and all Newman PASS, but one browser role-revocation assertion ran before its asynchronous role update committed: it observed the old user role's correct 403 rather than the post-change token revocation 401. The test now waits for the actual PUT response and the UI shows an explicit updating state. The entire final test:all run was repeated on 9e5a566 and passed; preliminary failed counts are not treated as evidence.

Final artifacts are archived in ignored test-results/phase4-evidence/: final log, unit/integration/browser JUnit, all three Newman JSON/HTML reports, and Phase 3/4 screenshots. Files remain uncommitted because API reports include disposable tokens. CI uploads fresh commerce-test-evidence.

Visual review then aligned the account filters/actions and checkout coupon controls with the existing UI, with 44px targets, wrapping controls and visible keyboard focus. The two affected real browser flows were rerun on display revision 4e952bf54692af0002a72832fb59f6298b9e5ea4: **2/2 PASS**. Business JavaScript/services did not change. Supplemental browser XML, log and refreshed screenshots are archived as browser-ui.xml, phase4-ui-final.log and Phase 4 screenshots. The final pushed head runs the complete CI suite again.

## Acceptance / handover

**Local acceptance: PASS.** Phase 3 pushed head 6b0550f has successful remote CI: https://github.com/ManhT005/Kiem-thu-nhom-3/actions/runs/38227680884. Phase 4 head 1383d3b also passed CI: https://github.com/ManhT005/Kiem-thu-nhom-3/actions/runs/38232472913. Check the final pushed head after the display-only follow-up as well; success is not inferred before its run completes. Human review/merge and release approval remain with the owner.

Merge the Phase 2 baseline into develop first if not already present, then Phase 3 and Phase 4 in that order. Phase 4 can be reviewed as a stacked PR against feature/p3-inventory-integrity until that branch is integrated.

Apply 005/006 non-destructively with db:migrate in a maintenance window, after inspecting legacy invalid stock/totals. Deployment of 006 invalidates old unversioned JWTs and requires re-login. Existing vouchers are retained disabled for review; historical Order prices are not recalculated. Next migration number: 007.

Real external MoMo sandbox/IPN connectivity and actual refund execution are not claimed: gateway responses are injected and REFUND_REQUIRED is an audited state, not an automatic cash refund. The Phase 2 external payment-readiness gate remains required before release to main.
