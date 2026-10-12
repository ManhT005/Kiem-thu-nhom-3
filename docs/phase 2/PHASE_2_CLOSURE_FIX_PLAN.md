# Phase 2 Closure — implementation and handover

Date: 2026-10-12. Branch: `fix/phase-2-route-cleanup`.

Scope confirmed for this branch: Phase 2 Closure, keeping existing MoMo code. Phase 3/4 implementation stays in separate PRs. This follows the master plan's Option B for code scope. The user will create the PR and merge on GitHub; no PR retarget, release merge or force push is performed by this change.

| Task | Implementation | Verification |
|---|---|---|
| P2-FIX-01 | Validate expiration batch as integer 1–500; interpolate only that validated integer; group/order deterministically | MySQL 8 empty queue, default/1/100/500, null/latest transaction and invalid limits |
| P2-FIX-02 | Side-effect-free `app.js`; guarded bootstrap; owned worker with start/stop, no overlap and deduplicated error codes; listener/worker/pool shutdown with 10-second deadline | Import subprocess in development with unavailable DB, worker lifecycle tests, route listener teardown |
| P2-FIX-03 | Explicit unit/routes/integration runners, Node 22, per-file/process/job/step timeouts, JUnit/Newman artifacts; API runner owns a random-port listener and checks readiness/health before Newman | Fresh unit, integration, Newman and browser runs |
| P2-FIX-04 | Preserve legacy query strings, canonical product IDs and absolute static assets; keep private files inaccessible and API 404 JSON | HTTP route tests and Chromium deep-link/reload tests |
| P2-FIX-05 | Payment catalog exposes method codes; checkout uses server pricing, loading lock and user-scoped retry session; transaction-backed idempotency; backend status/ownership checks; restrict HTTPS provider URLs; recheck payment after provider response | Concurrent retries, payload conflict/rollback, browser lost-response/double-click/foreign-order/return spoofing; real COD E2E |
| P2-FIX-06 | Preserve branch and existing commits, push fixes for a PR targeting `develop` | Review GitHub comparison before merge; current baseline divergence is an existing merge commit with no missing feature diff |
| P2-FIX-07 | Fresh test report and evidence | `reports/PHASE_2_CLOSURE_TEST_REPORT.md`, `test-results/`, CI artifacts |

## Database/API contracts

- Apply migration `004_checkout_idempotency.sql` once to an existing database after 003. Never edit/reapply existing migrations or run reset on real data. Phase 3 must start at 005.
- `GET /api/orders/payment-methods` returns `data: [{ maPTTT, tenPTTT, code }]`. MoMo recognition uses `code === 'MOMO'`, with no dependency on ID 3.
- `POST /api/orders/create` accepts optional `idempotencyKey` (8–64 ASCII letters/digits/underscore/hyphen). Existing clients without a key preserve their contract. The key is scoped to the authenticated user, whose row is locked before stock/cart writes. Identical retries return the same order; different payloads return 409 `IDEMPOTENCY_CONFLICT`. Key/order/history/stock/cart writes share one transaction. Retain keys for the lifetime of the order, including cancellation, so stale retries cannot create a second order.
- Price fields supplied by clients are ignored; checkout submits only product/size/quantity and recipient details. The order response contains the server total and current state on replay.
- Deadline writes (`NOW()`), driver decoding and runtime connections use UTC. This fixes Windows/Asia-Saigon vs MySQL UTC comparison errors for newly created MoMo orders. Review existing deadlines created under a different database session timezone before deployment; historical timestamps are not rewritten automatically.
- Checkout retry state is scoped to user and recipient/cart/method fingerprint, cleared on method/cart change, terminal state or logout. MoMo status is authenticated before reuse. A paid return clears checkout items only when its order matches the saved session, preserving a newer checkout.
- Gateway calls have a 15-second timeout. Returned/cached URLs must use HTTPS and `test-payment.momo.vn` or `payment.momo.vn` without credentials/custom port. After gateway response, lock and recheck order/payment before persisting the URL.
- IPN and expiration lock order before payment; successful late callbacks mark `REFUND_REQUIRED`, never reopen a cancelled order or reserve stock again. The existing order-create policy consumes cart rows; checkout selections remain available locally for a failed payment retry.

## Reproduce on a dedicated test database

Use Node 22 (`.nvmrc`). From the repository root in PowerShell:

```powershell
npm ci
npm --prefix backend ci
npx playwright install chromium
docker compose -p p2-closure -f tests/docker-compose.phase2.yml up -d --wait
$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = '13316'
$env:DB_USER = 'root'
$env:DB_PASSWORD = 'phase2-test-only'
$env:DB_NAME = 'clothes_closure_test'
$env:ORDER_CONCURRENCY_TEST = '1'
$env:JWT_SECRET = 'phase-2-local-test-only'
npm run db:reset
npm run db:seed:phase2
npm run test:all
docker compose -p p2-closure -f tests/docker-compose.phase2.yml stop
```

Unit tests run before database setup in CI. Integration cannot silently pass with missing environment configuration. Newman reseeds deterministic Phase 2 fixtures, starts its own API process and stops it in `finally`; browser tests own a separate listener and close it through Playwright. The real browser checkout runs only against `_test` databases; standalone browser runs without a test DB exercise mocked UI cases and explicitly skip the real DB case.

## PR/release checklist

- [ ] Create/retarget PR from this branch to `develop` and review the full route + retained MoMo diff.
- [ ] CI on the pushed head passes syntax, unit, MySQL integration, Newman and Chromium; inspect uploaded evidence.
- [ ] Apply 004 to any existing demo DB and check timestamp convention for pre-existing payment deadlines.
- [ ] Run real MoMo sandbox create → provider payment → signed IPN → return status with configured callback URLs/credentials. Local gateway responses are injected; they do not prove provider connectivity.
- [ ] Only after these gates, refresh the release PR to `main`. Release remains NO-GO while remote CI/provider evidence is absent.
