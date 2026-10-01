# Phase 2 Implementation Notes

## Order integrity

- Database access uses a callback-compatible MySQL pool; Order writes use one promise connection and one transaction.
- Order creation reads price from `SanPham`, locks variants in sorted order, validates stock, writes the order/details/audit, reserves stock, and clears purchased cart lines atomically.
- User cancellation is available at `PUT /api/orders/:id/cancel` and is restricted to the owner's pending orders.
- Staff/admin status changes follow the state catalog in `backend/domain/order-status.js`; cancellation restores stock and writes audit in the same transaction.
- Order history is available at `GET /api/orders/:id/history`. Owners and staff/admin may read it.
- Staff/admin filtering is available at `GET /api/orders/admin/filter` with `trangThai`, `fromDate`, `toDate`, `minTotal`, `maxTotal`, `keyword`, `page`, and `limit`.
- Order endpoints use the shared `{ success, code, message, data }` response contract.

## Database and tests

`npm run db:reset` applies migrations `001` and `002` before reference seeds. The reset command drops and recreates the configured database.

Run `npm run test:backend` for isolated unit coverage. Run `npm run test:order-concurrency` only against a dedicated MySQL database whose name ends in `_test`; the test creates and removes its own user, product, order, and audit fixtures.

The concurrency scenario requires MySQL and was not executed in environments where port 3306 is unavailable.