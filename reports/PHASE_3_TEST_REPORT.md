# Phase 3 test report

Date: 2026-10-12. Tester: Codex automated suites. Branch: feature/p3-inventory-integrity.
Tested implementation: **7dc37e1190ff1d91619cd3ec8535a670127bc006**. This report is a documentation-only follow-up.
Approved base: merged Phase 2 7f4d8aa; develop still lacked those commits at kickoff.

Environment: Windows/Asia-Saigon, Node 22.23.3, MySQL 8.0.46, Chromium 156.0.8078.4. Dedicated clothes_p34_test on 127.0.0.1:13316. UTC / READ COMMITTED business sessions with explicit canonical row locks.

Final command: `npm exec --yes --package=node@22 --call 'npm run test:all'`, with the dedicated DB, test JWT and ORDER_CONCURRENCY_TEST=1. Exit **0**.

| Suite | Executed/pass | Fail | Skip |
|---|---:|---:|---:|
| Backend/frontend syntax | All checked JS | 0 | 0 |
| Unit/routes/lifecycle | 43/43 | 0 | 0 |
| MySQL integration/concurrency/migration | 21/21 | 0 | 0 |
| Phase 1/2 Newman | 41 requests / 78 assertions | 0 | 0 |
| Phase 3 Newman | 18 requests / 27 assertions | 0 | 0 |
| Chromium Phase 2/3 | 7/7 | 0 | 0 |

## Traceability / observations

- P3-REC-01/02/03: two-line draft leaves stock unchanged; POST increments +10/+5 with two movements; ten concurrent posts write once and return idempotent replies; posted edit is rejected.
- P3-REC-04 / P3-MOV-02: later-item overflow and invalid multi-item orders leave no partial header, ledger, stock or order writes.
- P3-REC-05/06: quantity 0/-1/1/INT_MAX/INT_MAX+1, money -1/0/0.01/precision/aggregate overflow, duplicate/empty items and invalid date filters are covered.
- P3-MOV-01/03/04: sale and cancellation share the Order transaction; ten cancellations restore once and create one ORDER and one CANCEL movement per variant.
- P3-CNC-01/02: receipt vs Order, stock=1/two buyers, stock=5/ten buyers and reversed multi-item requests preserve stock without oversell or lost updates.
- P3-ADJ-01: required reason, repeated key, changed payload and underflow exercise atomic/idempotent adjustment behavior.
- P3-SEC-01/02: guest/user receipt requests and staff adjustment/reconciliation requests are rejected. Admin legacy absolute setter returns INVENTORY_ADJUSTMENT_REQUIRED.
- P3-REC-07 / P3-QRY-01: affected variant reconciliation is zero; low-stock equal/below boundary, movement event/variant pagination and injection-shaped filters are verified.
- P3-MIG-01: isolated legacy 001–004 database is adopted; stock=7 remains 7 through 005, replay and test-only down/up; one opening exists.
- Product bypass audit: the inventory repository is the only application snapshot writer; direct product stock tampering is rejected, nonzero removal conflicts, zero-stock disable keeps variants/ledger.
- P3-REG-01: all Phase 1/2 Order/Auth/Cart/payment unit, MySQL, Newman and browser suites pass.
- Real browser staff flow creates a draft and confirms unchanged stock; POST adds +3; repeated HTTP POST adds nothing further. Admin-only controls stay hidden from staff; a real admin adjustment restores the disposable test balance.

## Defects fixed and retested

Initial receipt/order and original concurrency tests exposed a stale opening lookup under REPEATABLE READ: after waiting for a stock row lock, a plain ledger query could still use an earlier snapshot and try a duplicate opening. Business sessions now use READ COMMITTED while retaining explicit stock locks. The final fresh concurrency run passes all affected cases.

The initial product tampering test omitted another positive-stock size and hit the legitimate disable guard first; it now retains both sizes to isolate stock tampering. Failed preliminary results are not counted as final evidence.

## Evidence / decision

Local artifacts are archived in ignored test-results/phase3-evidence/: final log, unit/integration/browser JUnit, baseline/Phase3 Newman JSON/HTML and receipt screenshot. CI uploads fresh commerce-test-evidence.

**Local acceptance: PASS. Merge/release requires remote CI on the final pushed head and human PR review.** Merge Phase 2 into develop before integrating Phase 3. No main/develop merge is performed locally.

Use non-destructive db:migrate in a maintenance window after fixing negative/NULL legacy stock; 001–004 remain immutable. Interrupted MySQL DDL requires inspection of APPLYING registry state. Real MoMo sandbox acceptance remains the Phase 2 external gate; local payment tests use injected gateway responses.
