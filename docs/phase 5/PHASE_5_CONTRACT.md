# Phase 5 — Reporting contract

Frozen implementation policy, 2026-10-12. Review/signoff remains pending.

All endpoints inherit persisted JWT validation, ACTIVE status, token_version and admin role from `/api/admin`. Guest 401, user/staff 403. Locked user 403; revoked token 401. Reporting GET has no write side effects.

| GET endpoint | Success code | Extra filters |
|---|---|---|
| /api/admin/dashboard/summary | DASHBOARD_SUMMARY_FETCHED | none |
| /api/admin/dashboard/top-products | DASHBOARD_TOP_PRODUCTS_FETCHED | limit 1–20 (default 5), sort quantity/grossSales |
| /api/admin/dashboard/revenue-chart | DASHBOARD_REVENUE_CHART_FETCHED | groupBy day/week/month (default day) |
| /api/admin/payments/reconciliation | PAYMENT_RECONCILIATION_FETCHED | status, page 1–10000, limit 1–100 (default 20) |
| /api/admin/payments/reconciliation/summary | PAYMENT_RECONCILIATION_SUMMARY_FETCHED | none |

## Period and amounts

Supply both `from` and `to`, or neither. Accept valid `YYYY-MM-DD` as UTC midnight, or ISO timestamp including seconds and timezone. Default: 14 UTC days ending at next UTC midnight. Every range is `[from,to)`, positive, at most 732 days. Unknown/repeated/array filters are rejected. Charts allow at most 24 intersecting buckets; use week/month for longer periods. Weeks begin Monday UTC; months begin on day 1. First/last buckets contain only the selected portion of the period. Zero buckets are returned.

DB session UTC. Each endpoint uses a read-only REPEATABLE READ consistent snapshot, with transaction-local isolation; write services retain READ COMMITTED. Separate HTTP endpoints are independent snapshots and may differ during concurrent changes; generatedAt is per response. No caching or streaming.

VND is whole integer. SQL SUM uses DECIMAL/BIGINT; exact results within ±Number.MAX_SAFE_INTEGER return JSON numbers, larger integers return decimal strings. Clients must handle both and never convert large strings through Number.

## SQL oracle and semantics

Completion subquery: `SELECT maDonHang, MIN(thoiGian) completedAt FROM LichSuDonHang WHERE trangThaiMoi='Hoàn thành' AND (lyDo IS NULL OR lyDo <> 'LEGACY_STATUS_NORMALIZED') GROUP BY maDonHang`.

Only current `DonHang.trangThai='Hoàn thành'` with that event in the period contributes:

- completedOrderCount = COUNT of eligible orders.
- completedOrderValue = SUM(tongTien), after voucher.
- grossCompletedValue = SUM(subtotal_before_discount).
- completedDiscountAmount = SUM(discount_amount).
- Gross minus discount equals completed value on valid snapshots. No claim of collected cash, settled provider funds, margin or profit.
- Top: group eligible ChiTietDonHang by product across sizes; quantity = SUM(soLuongMua), grossSales = SUM(giaMua × soLuongMua), before voucher allocation. Sort descending selected metric, productId ascending for ties. Product label is current catalog name; transaction price is historical giaMua.

History is aggregated before joining orders/items. No revenue join to VoucherRedemption. Legacy completion absent or only migration normalization is excluded, never substituted with ngayDat. Summary legacyExcluded counts such current completed orders across all time, with warning LEGACY_COMPLETION_HISTORY_MISSING; placement of these orders in a completion period is unknowable.

ordersByStatus and totalOrders use creation date ngayDat in the selected period and current state. ordersByStatusBasis=createdAt. activeCustomerCount counts ACTIVE role=user across all time; refundRequiredCount counts all current refund markers; currentCountsBasis=allTimeSnapshot. These counts deliberately differ from completion-period metrics.

## Reconciliation

Period uses order creation date. Attempts are aggregated before joining. ALL lists orders with any reason; filters: REFUND_REQUIRED, PAYMENT_MISMATCH, AMOUNT_MISMATCH, MULTIPLE_PAID, VOUCHER_MISMATCH. Reasons can overlap; summary total counts distinct exception orders and groupsOverlap=true means group counts cannot be added.

Refund marker means manual liability, not a completed refund. Payment mismatch covers provider PAID but order not PAID/REFUND_REQUIRED, MoMo order PAID without PAID attempt, and PAID cancelled order. Amount mismatch compares attempts to persisted order total. More than one PAID attempt is flagged. Failed historical attempts alongside one valid PAID attempt are clean. Released voucher on active order, reserved voucher on completed/paid order, missing redemption for a discounted order, or nonreleased voucher on unpaid cancelled order is flagged. REFUND_REQUIRED may legitimately retain COMMITTED usage after paid cancellation or RELEASED usage after expiry.

List returns orderId, orderStatus, paymentStatus, exact orderValue, createdAt, attemptCount, reasons, page/limit/total. No customer identity, pay URL, credentials, signature or tokens. No resolve/refund mutation.

## Envelope example (synthetic fixture)

```json
{"success":true,"code":"DASHBOARD_SUMMARY_FETCHED","message":"dashboard summary fetched","data":{"period":{"from":"2091-01-01T00:00:00.000Z","to":"2091-01-05T00:00:00.000Z","timezone":"UTC"},"currency":"VND","completedOrderCount":2,"completedOrderValue":7000,"grossCompletedValue":7500,"completedDiscountAmount":500,"totalOrders":10,"ordersByStatusBasis":"createdAt","currentCountsBasis":"allTimeSnapshot","legacyExcluded":2,"warnings":["LEGACY_COMPLETION_HISTORY_MISSING"]}}
```

Other current counts and generatedAt depend on the database snapshot; the example is illustrative. Invalid filters: HTTP 400 `{success:false,code:"INVALID_REPORT_FILTER",message:"..."}`. Corrupt fractional money fails with INVALID_REPORT_DATA; unexpected DB failures use existing INTERNAL_ERROR handling.
