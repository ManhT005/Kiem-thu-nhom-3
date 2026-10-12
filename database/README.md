# Database setup

Migrations 001–004 contain the baseline, Order/MoMo integrity and checkout retry keys. `005_inventory_goods_receipt.sql` adds the stock ledger/receipts; `006_user_lifecycle_voucher.sql` adds user state, JWT revocation and vouchers. Existing migrations stay immutable. The next migration starts at 007.

From the repository root:

```powershell
copy backend\.env.example backend\.env
npm install
$env:DB_NAME = "clothes_shop_test"
npm run db:reset
npm run dev
```

`db:reset` requires an explicit `DB_NAME` ending in `_test`, recreates that dedicated database, applies the ordered migration registry and reference seeds. Production is rejected. For an existing database, use `npm run db:migrate:status` then `npm run db:migrate` with explicit DB_NAME during a maintenance window; never reset real data. Pause legacy stock writers before opening backfill and correct negative/NULL legacy stock or order totals first. Interrupted DDL is recorded as APPLYING and requires inspection; MySQL DDL is not transactional.

`npm run test:backend` runs unit/route/lifecycle tests without querying MySQL. `npm run test:integration` requires `ORDER_CONCURRENCY_TEST=1` and an explicit `DB_NAME` ending in `_test`; it runs Order, Payment, Inventory, User/Voucher, concurrency and isolated migration fixtures. The runner fails if the integration environment is missing. Business connections use UTC and READ COMMITTED with explicit stock row locks.

On PowerShell, point the app at a dedicated test database before running the race test:

```powershell
$env:DB_NAME = "clothes_shop_test"
$env:ORDER_CONCURRENCY_TEST = "1"
npm run test:order-concurrency
```

For isolated MySQL 8 and the full regression workflow, see `docs/phase 2/PHASE_2_CLOSURE_FIX_PLAN.md`. Evidence is written to the ignored `test-results/` directory and uploaded by CI.

Phase 3/4 contracts and tests are in `docs/phase 3/`, `docs/phase 4/` and their reports. Run `npm run test:all` after dedicated fixture setup. Deploying 006 requires users to log in again: old unversioned JWTs are rejected. Legacy vouchers are retained with disabled LEGACY codes until an administrator reviews them; historical order totals are not recalculated.

Do not run `db:reset` against a database containing data you need; it drops and recreates the configured database.

Test users are intentionally not stored with plaintext passwords. Create local test users through `/api/auth/register` or add a dedicated hashed-password seed for a local test environment.
