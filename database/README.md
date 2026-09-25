# Database setup

The baseline schema is in `migrations/001_initial_schema.sql` and deterministic reference data is in `seeds/001_reference_data.sql`.

From the repository root:

```bash
copy backend\.env.example backend\.env
npm install
npm run db:reset
npm run dev
```

`db:reset` creates the configured database, recreates the baseline schema, and applies reference seeds. It requires a running MySQL server and a database user with permission to create databases.

Test users are intentionally not stored with plaintext passwords. Create local test users through `/api/auth/register` or add a dedicated hashed-password seed for a local test environment.
