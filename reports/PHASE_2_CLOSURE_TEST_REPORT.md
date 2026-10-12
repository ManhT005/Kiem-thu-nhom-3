# Phase 2 Closure — fresh test report

Date: 2026-10-12. Tester: Codex automated runner.

Branch: `fix/phase-2-route-cleanup`. Tested implementation commit: `e0b672d9123276c5b88b611c02bbed38080b69e1` (`fix(p2): harden app lifecycle and checkout payment integrity`). This report is added in a documentation-only follow-up commit. PR creation/base selection and merge remain with the repository owner.

## Environment and execution

Windows / Asia-Saigon; Node **22.23.3** for the final regression; MySQL **8.0.46** in an isolated `mysql:8.0` container; Chromium **156.0.8078.4** via Playwright. Database: `clothes_closure_test`, host `127.0.0.1:13316`. Runtime sessions decode/write payment deadlines in UTC. No real database was reset.

Installed dependencies using root `npm install --save-dev @playwright/test` and `npm --prefix backend ci`; browser installed with `npx playwright install chromium`. Seed/reset commands were restricted to the dedicated `_test` database. `.nvmrc` and GitHub Actions pin Node 22; the machine's default Node 24 was also used for preliminary runs, but is not the final acceptance environment.

Final command on the implementation commit, with the test database environment described in the closure plan:

```powershell
npm exec --yes --package=node@22 --call 'npm run test:all'
```

This executes syntax → unit/routes/lifecycle → integration/concurrency → deterministic fixture reseed → managed Newman/API → browser. Separate fresh runs also exercised these suites while resolving defects. Final results:

| Suite | Executed | Passed | Failed | Skipped | Evidence |
|---|---:|---:|---:|---:|---|
| Static JavaScript syntax | Backend + frontend JS | All | 0 | 0 | `test-results/closure-final.log` |
| Unit / routes / lifecycle | 40 | 40 | 0 | 0 | `test-results/unit.xml` |
| MySQL integration / concurrency | 12 | 12 | 0 | 0 | `test-results/integration.xml` |
| Newman requests | 41 | 41 | 0 | 0 | `test-results/newman.json`, `newman.html` |
| Newman assertions | 78 | 78 | 0 | 0 | Same Newman artifacts |
| Chromium browser | 6 | 6 | 0 | 0 | `test-results/browser.xml`, `checkout-e2e.png` |

## Traceability and observations

| Master-plan cases | Scenario / assertion | Result |
|---|---|---|
| P2-REG-01 / P2-C02, C03 | Unit runner exits normally; subprocess imports app/bootstrap with `NODE_ENV=development`, invalid DB port and no listener/worker activity; route tests close their own listener | PASS |
| P2-REG-02 / P2-C01 | Empty queue, default 100 and batches 1/100/500; stable order IDs; latest pending transaction and null transaction; invalid limits rejected before SQL | PASS on MySQL 8, no errno 1210 |
| P2-REG-03, 04, 14 / P2-C08 | Legacy product/search/return redirects preserve relevant query; Unicode search; canonical deep-link/reload; CSS/JS/image responses; private/traversal paths 404; unknown API JSON 404 | PASS in HTTP tests and Chromium |
| P2-REG-05, 08 | Actual browser registers/logs in a disposable user, adds cart item/address, submits COD with displayed client price 1; server records total 3000, stock decreases once, cart empties and one `ORDER_CREATED` history is recorded | PASS through real Express/MySQL |
| P2-REG-06, 07 | Repeated cancellation cannot restore again; stock 1/two buyers and stock 5/ten buyers; multi-item canonical locks | PASS |
| P2-REG-09, 15 | Phase 1 auth/cart smoke, user/staff/admin Order permissions and cross-user history/cancel guards; foreign payment-status access rejected | PASS |
| P2-REG-10, 11 | Altered/invalid IPN signature rejected; mismatched amounts rejected; ten matching concurrent IPNs produce one confirmation/history without restoring reserved stock | PASS; signature verification unit/HTTP guard and transactional service integration |
| P2-REG-12 | Spoofed return `resultCode=0` stays pending; only authenticated API `PAID` reveals success | PASS in Chromium with controlled API status |
| P2-REG-13 / P2-C09 | Failed link creation retains one provider attempt and can expire; two workers restore once with/without transaction; IPN vs expiration ends PAID or REFUND_REQUIRED consistently; no overlapping scans | PASS |
| P2-C06 / checkout compatibility | Non-3 MoMo method ID; double click sends one request; lost response retries same key; ten same-user retries produce one order; changed payload conflicts; rollback leaves no key; cross-user keys scoped independently; stale foreign state discarded | PASS |
| Additional deadline regression | Newly created MySQL MoMo order remains payable on Windows/Asia-Saigon; UTC decode matches server deadline | PASS after timezone fix |
| Additional provider race | Order expires while provider responds: returned URL is not persisted/returned; arbitrary provider hosts/protocols rejected | PASS |

## Defects fixed and retested

| Defect | Root cause | Retest |
|---|---|---|
| P2-C01 | mysql2 prepared `LIMIT ?` argument handling | Validated integer LIMIT + real batch tests PASS |
| P2-C02/C03 | Server/worker startup during import; implicit recursive test discovery | Separate app/bootstrap/worker and explicit suite runners PASS |
| P2-C06 | Hardcoded method ID, unscoped pending order and no create retry identity | Payment codes, scoped session and atomic idempotency PASS |
| P2-C08 | Legacy return/login/product redirects discarded query parameters | Query-preserving redirects PASS |
| Closure UTC defect | MySQL UTC DATETIME parsed as Windows local time, making fresh 15-minute deadlines appear expired | UTC session + driver configuration; real MoMo creation/concurrency PASS |
| Provider-response race | Order could expire while gateway request was in flight, then receive a stale pay URL | Lock/recheck before URL persistence; regression PASS |

Preliminary failures included missing dependencies, sandbox process spawning restrictions, missing local test secret, and browser test assertions using the wrong legacy response nesting (`data.product` / `data.cart`). These were corrected before the final fresh run. No preliminary PASS counts were reused as evidence for the final implementation.

## Release decision and remaining gates

**Local regression: PASS. Release to `main`: NO-GO until the external gates below are satisfied.**

- Remote GitHub Actions has not been claimed green by this report. Check the workflow triggered by the final pushed SHA and download its uploaded `phase2-test-evidence` artifact.
- Real MoMo sandbox/provider connectivity and signed external IPN/return E2E were not executed: no real credentials/public callback endpoints were supplied. Gateway link responses are injected in local tests; the return-status UI tests control API responses. This is a payment readiness evidence gap, not a claimed provider PASS.
- The repository owner must create/retarget the PR to `develop`, review the retained MoMo scope and merge on GitHub. The release PR to `main` remains held until fresh CI and payment readiness acceptance.
- Apply migration 004 once on an existing demo database. Phase 3 migration numbering now starts at 005. Review old payment deadlines if the previous DB session used a non-UTC convention; this patch does not rewrite historical timestamps.

Evidence files are intentionally ignored in Git because Newman artifacts contain disposable authentication tokens. CI uploads fresh evidence; committed artifacts are this report and the implementation/reproduction plan.
