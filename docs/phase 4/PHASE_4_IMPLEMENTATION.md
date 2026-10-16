# Phase 4 — User lifecycle, RBAC and vouchers

Date: 2026-10-12. Branch: feature/p4-user-voucher. Dependency/base: Phase 3 head 6b0550f; Phase 3 CI passed at https://github.com/ManhT005/Kiem-thu-nhom-3/actions/runs/38227680884. Merge Phase 2 and Phase 3 into develop before the Phase 4 PR, or review this as a stacked PR against feature/p3-inventory-integrity. The owner creates PRs and merges; no main/develop merge is performed locally.

## Frozen identity and permission policy

Migration 006 adds users.status ACTIVE/LOCKED, token_version and lifecycle audit. Login checks LOCKED after validating credentials. Tokens include id/token_version and an advisory role. Every protected request loads the current user from DB, checks ACTIVE and token_version and authorizes the stored role. No stale auth cache exists. JWT algorithms are restricted to HS256.

LOCKED login/protected request returns 403 ACCOUNT_LOCKED. Missing/deleted/revoked/unversioned JWT identity returns 401 TOKEN_REVOKED; invalid/expired signature returns 401 UNAUTHENTICATED. Unlock does not revive old tokens. Changing status/role increments the version exactly once per actual change; duplicate unchanged operations are idempotent. Deploying 006 requires re-login for previous unversioned tokens. Requests already in flight are not retroactively cancelled; Order creation additionally rechecks user state/version under its transaction lock.

Lifecycle writes lock active admin rows in ID order, then the actor/target, verify the current actor/version, prohibit self-management, preserve at least one active admin, increment token_version and audit reason/actor/before/after in one transaction. Admin role/status changes cannot bypass this through legacy user routes. Legacy DELETE disables an account; no physical account deletion endpoint remains.

| Protected business action | user | staff | admin |
|---|---|---|---|
| Own cart / create or cancel own order / apply voucher / own payment | Yes | No | No |
| Order operations/history for permitted staff workflow | Own history only | Yes | Yes |
| Goods receipt and movement/low-stock read | No | Yes | Yes |
| Stock adjustment and reconciliation | No | No | Yes |
| User lifecycle and voucher administration | No | No | Yes |
| Product/category administration | No | No | Yes |
| Own profile/address | Yes | Yes | Yes |

Guests can browse products/search/page shells. Backend APIs enforce all permissions; page HTML and localStorage role display confer no authorization. IPN remains a public signature-verified provider endpoint.

## Voucher domain and accounting

Extend GiamGia and the existing DonHang.maGiamGia FK; do not create a competing voucher system. Codes normalize uppercase ASCII 3–64 letters/digits/underscore/hyphen. Admin request fields are camelCase: code, discountType, discountValue, minimumOrderAmount, maximumDiscountAmount, startAt, endAt, usageLimit, perUserLimit, enabled, description. PUT is a full validated replacement. Physical delete is not provided; disable instead.

Discount values are positive DECIMAL(14,2); PERCENT <=100. Money is validated in integer cents, calculations use BigInt and floor final discounts to whole VND. Percent is subtotal * percentage /100, bounded by optional cap; FIXED is bounded by subtotal; total cannot be negative. Dates require explicit ISO timezone and a valid [startAt,endAt) window with millisecond precision. usageLimit=null is unlimited; 0 allows no orders; perUserLimit=0 also allows no orders. Preview uses locked server prices and eligibility but creates no redemption or consumption.

Create Order locks the customer, canonical stock rows, then voucher row. Validation and global/per-user counts are checked after server pricing. The transaction saves voucher FK/code/subtotal/discount snapshots, creates one RESERVED redemption and increments used_count along with stock/ledger/cart/history/order writes. Checkout idempotency replay occurs before consuming again; no-voucher request hashes remain compatible with Phase 2 keys. Client totals/prices/discounts/user IDs are ignored as authoritative data.

RESERVED counts as consumed usage. Unpaid cancellation, MoMo FAILED or EXPIRED changes redemption to RELEASED and decrements exactly once. COD completion and on-time MoMo PAID change RESERVED to COMMITTED. Paid order cancellation keeps committed usage and marks payment REFUND_REQUIRED; automatic cash refund is out of scope. Late success for an expired/cancelled payment remains REFUND_REQUIRED and does not reopen the order, restore twice or reacquire released usage. Snapshot amounts do not change when the admin edits/disables a voucher.

Voucher/admin lifecycle writes record audits. A usageLimit below current active usage conflicts; updated metadata affects future applications only. Lock order remains stock-before-voucher across sale/cancel/payment paths. Pure server total checks reject overflow; order totals use BIGINT within JavaScript's safe integer range.

## API

| Endpoint | Access | Result |
|---|---|---|
| GET /api/admin/users | admin | Filter search/status/role/page/limit |
| PUT /api/admin/users/:id/lock or unlock | admin | Required reason; revoke tokens and audit |
| PUT /api/admin/users/:id/role | admin | Required reason/role; safe transition and audit |
| GET /api/admin/vouchers | admin | Filter exact code/enabled/page/limit |
| POST /api/admin/vouchers | admin | 201 valid voucher |
| PUT /api/admin/vouchers/:id | admin | Validated full edit, immutable issued snapshots |
| PATCH /api/admin/vouchers/:id/status | admin | Boolean enabled |
| POST /api/vouchers/validate | user | voucherCode/items; server-price preview, no consumption |
| POST /api/orders/create | user | Optional voucherCode; atomic application and retry key |

Responses retain success/code/message/data. Guard statuses are 401/403; validation 400; missing voucher/user 404; eligibility/state/limit conflicts 409; invariant failures 422. Error codes include VOUCHER_DISABLED, VOUCHER_NOT_STARTED, VOUCHER_EXPIRED, MIN_ORDER_NOT_MET, VOUCHER_USAGE_LIMIT, VOUCHER_USER_LIMIT and IDEMPOTENCY_CONFLICT.

## UI and deployment

Admin account table has status/role/search filters, pagination, reason input, lock/unlock and role controls. It uses text nodes and busy states and disables self-management. /vouchers provides create/edit/enable/disable and filtering/pagination; checkout previews a code and sends only the code with product/size/quantity. The final Order response supplies final amounts; preview never guarantees a reserved usage.

Apply 006 through db:migrate after 005 in a maintenance window, with legacy totals/stock reconciled. Existing GiamGia rows become disabled LEGACY codes; old inclusive end dates convert to exclusive next-day timestamps. Legacy order totals/FKs remain and subtotal snapshots backfill from the old total; no historical discount is inferred. The test-only rollback refuses non-test databases, changed user security, voucher accounting/audit/business data or unsafe narrowed totals. Never roll back deployed security/accounting by dropping columns.

Use Node 22, MySQL 8 and a dedicated *_test database; db:reset, db:seed:phase2, test:all. The guarded seed resets disposable fixture state/version only for QA; application code never resets versions. See PHASE_4_TEST_PLAN.md, RBAC_MATRIX.md and the report. Provider sandbox integration and human release review remain external gates.
