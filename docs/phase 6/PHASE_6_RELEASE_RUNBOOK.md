# Release / reproduction runbook

## Install and database

Use Node 22/MySQL 8. `npm ci` and `npm --prefix backend ci`. Copy backend/.env.example to backend/.env for backend commands, or supply environment variables consistently to root commands and Playwright. Dotenv loads relative to process working directory: root startup reads root .env, npm --prefix backend scripts read backend/.env. Keep actual credentials out of Git. JWT_SECRET must be an independent random deployment secret. Development uses a real non-test DB; all resets below are TEST ONLY.

Normal deployment: backup database, inspect npm run db:migrate:status, run npm run db:migrate, inspect registry/checksums, then npm run db:seed only for reference data. Never use db:reset or phase fixtures on user data. Migrations 001–006 remain unchanged; no 007 was added. DDL rollback in production is not automatic: stop writes, restore a verified backup/compatible application version and check integrity. Test rollback helpers require *_test.

PowerShell regression setup (fixture-only credentials):

```powershell
docker compose -f tests/docker-compose.phase2.yml -p ptda-p5-p6 up -d --wait
$env:DB_HOST='127.0.0.1'
$env:DB_PORT='13316'
$env:DB_USER='root'
$env:DB_PASSWORD='phase2-test-only'
$env:DB_NAME='clothes_closure_test'
$env:ORDER_CONCURRENCY_TEST='1'
$env:JWT_SECRET='local-regression-only-secret'
npm run db:reset
if ($LASTEXITCODE -ne 0) { throw 'Reset failed' }
npm run db:seed:phase2
if ($LASTEXITCODE -ne 0) { throw 'Seed failed' }
npx playwright install chromium
npm run test:all
if ($LASTEXITCODE -ne 0) { throw 'Regression failed' }
```

Compose credentials and phase2 accounts are fixture-only. Account emails/roles and the test-only password are defined in backend/scripts/db-seed-phase2-fixtures.js; never deploy these accounts/passwords to a public demo. Admin should create/reset demo identities privately. All synthetic P5 fixtures clean up after their layer. Stop the disposable service with `docker compose -f tests/docker-compose.phase2.yml -p ptda-p5-p6 stop`; no data deletion is required.

## Application and demo

npm start serves API, assets and canonical pages from one Express port. Set PORT/CORS_ORIGIN/APP_BASE_URL/PUBLIC_API_URL for hosting. Canonical /login, /cart, /checkout, /orders, /admin, /inventory, /vouchers should refresh directly. Re-login after user lifecycle migration/change invalidates old tokens.

5–10 minute demo: login user → cart/server-priced COD checkout with voucher → staff confirms/ships/completes → admin opens Thống kê with matching UTC period → show receipt POST/ledger and cancellation restoration → lock user/deny stale session → show MoMo local signed-IPN evidence and refund marker. Explain completed order value vs collected money and UTC exclusive end. When provider is unavailable, show redacted local artifacts and BLOCKED_EXTERNAL, never fake a provider success screen.

External sandbox: [acceptance runbook](../phase%205/PHASE_5_MOMO_SANDBOX_ACCEPTANCE.md). Use hosting secrets and reachable HTTPS callback; no public automatic external payment test in CI. Dependency audits run at high threshold. Evidence: test-results includes JUnit, safe Newman HTML/JSON, screenshots/traces and metadata. Review traces before public sharing because browser traffic may contain session data; CI artifacts are repository evidence with 14-day retention and repository access controls.

## Release control

Push candidate branch/PR to develop only when requested. Require Commerce Full Regression / commerce-regression on exact candidate SHA and peer review. Owner configures required checks/branch protection or records manual gate. Reuse develop→main PR only after review, final CI and human GO; no main merge/tag/deploy is performed by this implementation task.
