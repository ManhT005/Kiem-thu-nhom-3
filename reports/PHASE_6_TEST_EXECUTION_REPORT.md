# Phase 6 local regression execution

Date: 2026-10-12, Asia/Ho_Chi_Minh. Branch: feature/p5-p6-reporting-release-hardening. Develop baseline: 8c824b448552cb3862768ec6acedd0b9a10a6dae. Verified source implementation: **50da5371b692ba5bbe15b0fb48ba04b5d3e919ed**; the following fourth commit contains documentation/evidence only.

Tests were executed against matching implementation worktree before code commits, then the evidence gate was assembled again at source SHA 50da537. The earlier api-summary Git SHA refers to the uncommitted-worktree baseline and is not a claim that develop already contained these features. Durable sanitized metadata: [PHASE_6_LOCAL_EVIDENCE.json](PHASE_6_LOCAL_EVIDENCE.json). Remote CI for the final branch SHA is PENDING.

Environment: Windows, Node **v24.12.0**, isolated Docker MySQL **8.0.46**, DB clothes_closure_test at 127.0.0.1:13316, ORDER_CONCURRENCY_TEST=1. Local runtime differs from the required Node 22 CI lane; independent clean Node 22 reproduction remains a release gate. No real user database was reset. Six migrations applied on clean test DB; legacy adoption/upgrade/replay/down-up smoke executed by the existing migration integration tests.

| Layer | Observed result | Evidence |
|---|---|---|
| Syntax checks | PASS | npm run check, backend/frontend/test CJS/config |
| Unit/domain/auth/runner | 57/57 PASS; 0 fail/skip | test-results/unit.xml |
| MySQL integration/concurrency/journeys | 43/43 PASS; 0 fail/skip | test-results/integration.xml |
| Newman combined | 163 requests / 316 assertions PASS; 0 failures | test-results/api-summary.json; safe per-suite HTML/JSON |
| Browser Chromium | 11/11 PASS; 0 fail/skip | test-results/browser.xml; screenshots |
| Evidence and endpoint mapping | PASS, 62/62 mounted method/path entries have collection cases | test-results/endpoint-coverage.json, release-evidence.json |
| Dependency audit | CI blocks high/critical findings in runtime dependencies; full dependency-tree audit JSON is retained separately for test-tooling advisory visibility | test-results/npm-audit-root.json; test-results/npm-audit-backend.json |

| API suite | Requests | Assertions | Failures |
|---|---:|---:|---:|
| ClothesShop (P1/P2) | 41 | 78 | 0 |
| Phase3 | 18 | 27 | 0 |
| Phase4 | 30 | 43 | 0 |
| Phase5 | 36 | 87 | 0 |
| Phase6 | 38 | 81 | 0 |

API timing smoke observed P95 **136 ms**, maximum **200 ms** in this run. These numbers describe this fixture/runtime only; they are not a production SLO or large-load claim. Concurrent checkout/IPN/expiry/receipt/voucher tests verify exactly-once business mutations under their defined races.

Critical scenarios: COD/voucher/idempotency→completion→dashboard; cancellation→stock/voucher restoration; receipt→sale→affected-variant ledger reconciliation; locked/revoked JWT; MoMo signed HTTP replay, tampering/correlation rejection, expiry/late refund marker; dashboard UTC/legacy/deduplication/precision/RBAC; canonical routes and private-file denial. [RTM](../docs/phase%206/PHASE_6_REQUIREMENT_TRACEABILITY_MATRIX.md) maps deeper behavior; 62/62 route presence does not imply exhaustive coverage of every branch.

Initial failures and fixes were retained in the defect register: sandbox spawn EPERM was an execution restriction; J3 oracle included an untouched synthetic size and was corrected; mobile header/sidebar CSS precedence was repaired. The evidence reader was adapted to Node's flat JUnit and Playwright's wrapped JUnit, with regression tests. No repeated-run-to-green flake policy was used.

No open known S1/S2 in the executed automated scope. External MoMo remains BLOCKED_EXTERNAL; mock tests do not demonstrate provider/public IPN connectivity. GitHub CI at final SHA, reviewer approval, manual accessibility/demo acceptance and release-owner GO remain PENDING. No main merge, release tag, push or production deployment was performed.
