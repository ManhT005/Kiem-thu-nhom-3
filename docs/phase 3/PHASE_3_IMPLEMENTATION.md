# Phase 3 — Inventory integrity and goods receipts

Date: 2026-10-12. Branch: `feature/p3-inventory-integrity`. Base: `7f4d8aa`, the merged Phase 2 implementation. At kickoff, GitHub's `develop` still pointed at `2a59445`; the owner approved continuing from the merged Phase 2 branch. Merge Phase 2 into develop before integrating this PR. Phase 4 is a separate dependent branch.

## Frozen contracts

Stock remains in `ChiTietSanPham.soLuongTon`. Every business write updates its snapshot and appends an `InventoryMovement` on the caller's connection/transaction. Row locks follow ascending product/size. Stock is integer 0–2147483647. Every source/event/variant combination is unique. Opening balances may have delta 0; all other events require nonzero deltas. No HTTP mutation route edits/deletes ledger rows.

Business connections use UTC and READ COMMITTED. Explicit stock row locks provide serialization; fresh reads after obtaining the stock lock avoid the stale snapshot that caused duplicate opening rows under REPEATABLE READ. Lazy opening is a compatibility safeguard for variants introduced by test fixtures/legacy import; normal product creation starts with zero stock and records an opening. Historical ledger/order variants are never hard-deleted.

Receipt draft/edit validation accepts 1–100 unique existing active variants. Quantity is integer 1–2147483647. Unit cost and line/header totals use DECIMAL(14,2), computed as integer cents/BigInt before writes; negative money, precision beyond 2 places and overflow are rejected. Draft creation/edit changes no stock or movements. POST locks the header, applies all rows, and sets POSTED in one transaction. Repeated/concurrent POST returns 200 with `duplicate: true`. POSTED content is immutable. Physical delete/void is not provided.

Receipt creation accepts an optional user-scoped `idempotencyKey`; adjustment requires it. Reusing a key with a different normalized payload returns 409. Adjustment is admin-only, uses signed deltas and a required reason, and creates its document and all movements atomically. Receipt + Order, Order + CANCEL and MoMo expiration use the same movement port. Existing Order price/history behavior is retained.

## API and RBAC

All responses follow `{ success, code, message, data }`. Guest receives 401; authenticated disallowed roles receive 403.

| Endpoint | Roles | Contract |
|---|---|---|
| POST /api/inventory/receipts | staff/admin | 201 DRAFT; note/items/optional idempotencyKey |
| GET /api/inventory/receipts | staff/admin | status/fromDate/toDate/page/limit |
| GET /api/inventory/receipts/:id | staff/admin | Header and sorted items |
| PUT /api/inventory/receipts/:id | staff/admin | DRAFT only; atomically replace items |
| POST /api/inventory/receipts/:id/post | staff/admin | POST once; idempotent retry |
| GET /api/inventory/movements | staff/admin | maSP/maSize/eventType/date/page/limit |
| GET /api/inventory/low-stock | staff/admin | Active variants with stock <= threshold; threshold defaults to 5 |
| POST /api/inventory/adjustments | admin | reason/idempotencyKey/items with signed delta |
| GET /api/inventory/reconciliation | admin | Read-only snapshot minus sum(delta), page/limit/variant |
| PUT /api/kho/:maSP | admin | 409 INVENTORY_ADJUSTMENT_REQUIRED; old setter cannot write stock |

Lists cap page size at 100; integer/date/event filters are validated and values bound. Monetary, stock, payload/transition and ownership conflicts use 400/404/409/422 consistently. Reconciliation includes a page's variants and reports discrepancies without modifying inventory.

## Product/inventory UI

`/inventory` is linked from staff/admin headers. It provides labelled multi-row draft creation, draft editing, posting confirmation, receipt/history pagination, filters, low-stock threshold, and admin adjustment/reconciliation. Busy controls prevent repeated UI submits; request keys survive a network retry in session storage. Untrusted names/reasons are rendered as text.

The old staff “Sửa kho” action opens the inventory page. Product editing manages metadata and active sizes, with stock read-only. New variants start at zero and are filled through receipts. Raw product payloads attempting to change stock are rejected. Removing a size with positive stock conflicts; a zero-stock size is disabled, preserving history. CANCEL may restore a disabled historical variant. Deleting a product referenced by inventory history is rejected by FK; no ledger is removed.

## Non-destructive migrations and deployment

Migration `005_inventory_goods_receipt.sql` adds receipt/adjustment/ledger tables and variant activity/checks, then backfills exactly one opening per existing variant without changing stock. Reconcile negative/NULL legacy stock first. Existing migrations 001–004 remain unchanged.

Run `npm run db:migrate:status` then `npm run db:migrate` with explicit DB_NAME. The runner uses a per-database advisory lock, SHA-256 checksums, a schema registry, adoption of known legacy baseline markers and an APPLYING/APPLIED state. A previously interrupted MySQL DDL migration is rejected for manual inspection; DDL is not claimed transactional. Use a maintenance window for schema adoption/backfill, keeping legacy writes paused. Never reset a real database.

Fresh test setup uses `db:reset` only on *_test databases and applies the ordered registry. Test-only rollback refuses non-test databases, later migrations or business events. An isolated up/down/replay test proves legacy stock and one opening are preserved. Migration 006 is reserved for Phase 4.

## Verification/reproduction

Use Node 22 and the existing isolated MySQL compose service on port 13316; set DB_NAME=clothes_p34_test, ORDER_CONCURRENCY_TEST=1, and a test-only JWT_SECRET. Run db:reset, db:seed:phase2, and test:all. It includes the Phase 1/2 collection and Phase3 collection, and Chromium Phase 2/3 E2E. Fixture stock writes/ledger cleanup occur only in guarded disposable test scripts, never in application routes.

Evidence is in ignored test-results/ and GitHub's commerce-test-evidence artifact. See the Phase 3 test plan/report. No main/develop merge is performed locally.
