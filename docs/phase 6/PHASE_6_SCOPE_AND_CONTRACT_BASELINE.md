# Phase 6 scope and contract baseline

Implementation starts from develop 8c824b448552cb3862768ec6acedd0b9a10a6dae. Canonical stack remains Express/MySQL/Vanilla JS. Phase 6 adds regression, evidence, CI and release documentation.

Authoritative contracts: [Master Test Plan](../MASTER_TEST_PLAN.md), [P4 RBAC](../phase%204/RBAC_MATRIX.md), [P5 reporting](../phase%205/PHASE_5_CONTRACT.md), route modules in backend/routes. Preview /api/vouchers/validate consumes no voucher usage; /api/orders/create applies atomically. MoMo endpoints are /api/payments/momo/create, /ipn, /orders/:orderId/status. Receipts use /api/inventory/receipts then /:id/post; direct /api/kho/:maSP mutations are rejected.

Product/category writes are admin-only; cart/own-order/payment creation are user-only. Inventory receipts/movements/low-stock are staff/admin; inventory reconciliation/adjustments are admin-only. Dashboard/payment reconciliation are admin-only. Account state and role are read from DB on every protected request; token version revokes old sessions. Legacy user DELETE locks rather than physically deletes.

Browser critical smoke is in scope; comprehensive visual design, large load testing, automated cash refund and real-money production payment are out of scope. External sandbox is a separate manual gate. Each API endpoint needs a recorded collection scenario; endpoint coverage measures route presence, not completeness of every business branch. Domain/integration/browser RTM supplies deeper behavioral evidence.

npm run test:evidence introspects mounted Express routes and fails on an endpoint with no collection case, missing suites, failed/skipped critical JUnit evidence or incomplete migration baseline. Artifacts tie results to runtime, DB, SHA and suite checksums. CI and human signoff on final release candidate remain pending until observed.
