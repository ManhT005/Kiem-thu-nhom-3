# Database setup

The baseline schema is in `migrations/001_initial_schema.sql`, Phase 2 order integrity is in `migrations/002_order_integrity.sql`, and deterministic reference data is in `seeds/001_reference_data.sql`.

From the repository root:

```bash
copy backend\.env.example backend\.env
npm install
npm run db:reset
npm run dev
```

`db:reset` creates the configured database, recreates the baseline schema, and applies reference seeds. It requires a running MySQL server and a database user with permission to create databases.

`npm run test:backend` runs the Order domain, transaction, pricing, lifecycle, history, and filter unit tests. The concurrency integration test only runs when `ORDER_CONCURRENCY_TEST=1` and `DB_NAME` ends in `_test`; it creates and deletes disposable user/product fixtures in that database.

On PowerShell, point the app at a dedicated test database before running the race test:

```powershell
$env:DB_NAME = "clothes_shop_test"
$env:ORDER_CONCURRENCY_TEST = "1"
npm run test:order-concurrency
```

Do not run `db:reset` against a database containing data you need; it drops and recreates the configured database.

Test users are intentionally not stored with plaintext passwords. Create local test users through `/api/auth/register` or add a dedicated hashed-password seed for a local test environment.
