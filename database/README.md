# Database setup

The baseline schema is in `migrations/001_initial_schema.sql`, Phase 2 order integrity is in `migrations/002_order_integrity.sql`, MoMo persistence is in `003_momo_payment_transactions.sql`, and checkout retry keys are in `004_checkout_idempotency.sql`. Deterministic reference data is in `seeds/001_reference_data.sql`. The next schema migration starts at `005`.

From the repository root:

```powershell
copy backend\.env.example backend\.env
npm install
$env:DB_NAME = "clothes_shop_test"
npm run db:reset
npm run dev
```

`db:reset` requires an explicit `DB_NAME` ending in `_test`, recreates that dedicated database, applies migrations 001–004 and reference seeds. Production is rejected. Existing databases must apply new migrations in order; never reset a database containing data you need.

`npm run test:backend` runs unit/route/lifecycle tests without querying MySQL. `npm run test:integration` requires `ORDER_CONCURRENCY_TEST=1` and an explicit `DB_NAME` ending in `_test`; it runs disposable Order and Payment fixtures. The runner fails if the integration environment is missing, instead of silently skipping the gate. Runtime MySQL sessions and DATETIME decoding use UTC for payment deadlines.

On PowerShell, point the app at a dedicated test database before running the race test:

```powershell
$env:DB_NAME = "clothes_shop_test"
$env:ORDER_CONCURRENCY_TEST = "1"
npm run test:order-concurrency
```

For isolated MySQL 8 and the full regression workflow, see `docs/phase 2/PHASE_2_CLOSURE_FIX_PLAN.md`. Evidence is written to the ignored `test-results/` directory and uploaded by CI.

Do not run `db:reset` against a database containing data you need; it drops and recreates the configured database.

Test users are intentionally not stored with plaintext passwords. Create local test users through `/api/auth/register` or add a dedicated hashed-password seed for a local test environment.
