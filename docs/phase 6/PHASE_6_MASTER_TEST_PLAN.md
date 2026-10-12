# Phase 6 execution strategy

[Master Test Plan](../MASTER_TEST_PLAN.md) is the canonical strategy; this document freezes execution order and gates.

Node 22 CI + MySQL 8; local runtime differences must be reported. Install root/backend with npm ci. Reset/fixtures only against an explicit *_test DB. No test sharing a DB runs in parallel with another layer.

1. Static syntax for backend/frontend/root CJS test runners; unit/domain/JWT contracts → unit.xml.
2. Migrations 001–006 on clean DB, legacy adoption/replay tests, then integrity/concurrency and signed HTTP journeys → integration.xml.
3. Seed baseline; managed ephemeral server runs manifest ClothesShop, Phase3, Phase4, Phase5, Phase6 in order → safe JSON/HTML per suite and combined api-summary.json. Missing suite/zero assertions/timeout/crash must fail; server and fixture cleanup happen in finally.
4. Playwright Chromium, one worker, no configured flaky retries → browser.xml, failure traces/screenshots, acceptance screenshots.
5. Verify all endpoints have cases, no skipped/failed critical evidence, migration registry/checksums and measured API timing → release-evidence.json and endpoint-coverage.json.
6. Dependency audit root/backend at high threshold. Manual accessibility/demo/external sandbox/peer review follow automated gates.

100% critical cases must pass; overall ≥95% does not waive an integrity/security failure. S1/S2 block release. S3/S4 need named human risk acceptance. Rerun only after identifying and fixing a cause. Any provider/public callback blocker is separately recorded.

CI workflow: .github/workflows/commerce-regression.yml, one regression job with isolated MySQL service, explicit job/step deadlines, always artifact upload and 14-day retention. Required check must be configured by release owner; this change does not change repository branch-protection settings.
