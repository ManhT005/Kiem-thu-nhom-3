# Phase 5 implementation

Read-only dashboard repository/service/controller/router mounted once behind admin authorization. Three dashboard views plus payment reconciliation list/summary. No migration 007 was necessary; migrations 001–006 are unchanged. Query indexes were retained without an unsupported performance claim.

Vanilla JS /admin adds Thống kê, UTC dates, granularity/sort filters, exact VND KPIs, SVG chart with a parallel accessible table, top products and paginated reconciliation. Backend labels use textContent; async loads hide stale results and expose loading/error/empty states. Native controls, keyboard navigation, reduced motion and 375px layout are covered by browser smoke. Each endpoint is its own snapshot; the UI does not promise a common atomic snapshot across requests.

Payment audit reuses existing order totals, ownership, signatures, correlation checks, row locks, expiration and refund marker. No verified payment-service defect required a production rewrite. New signed HTTP callback journeys use test-only credentials and an injected gateway link in integration code; no stub endpoint was added to the application.

Deterministic reporting fixture backend/tests/integration/reporting-fixture.js uses a separate 2091 UTC period, independent products/users and cleanup; the P2–P4 seed oracle is unchanged. Synthetic report fixtures intentionally do not represent inventory sales. Actual cross-module journeys exercise real checkout, ledger, voucher and signed callback services separately.

See [contract](PHASE_5_CONTRACT.md), [test plan](PHASE_5_TEST_PLAN.md), [execution report](../../reports/PHASE_5_TEST_REPORT.md) and [external acceptance](PHASE_5_MOMO_SANDBOX_ACCEPTANCE.md).
