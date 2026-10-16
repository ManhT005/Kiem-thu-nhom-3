# Phase 5 execution report

Observed local execution on 2026-10-12 (Asia/Ho_Chi_Minh). Source implementation: `50da5371b692ba5bbe15b0fb48ba04b5d3e919ed`, after backend/UI/regression commits. Tests ran against matching implementation worktree before those commits; the evidence gate was rerun at this source SHA. This is not historical baseline CI evidence.

Delivered: three admin-only dashboard endpoints, read-only payment reconciliation list/summary, UTC filtering/zero buckets/exact integer amounts, admin Thống kê tab, deterministic DB oracle, signed HTTP MoMo journeys and Newman Phase5.

P5-specific new coverage: 5 reporting unit tests, 7 reporting MySQL tests, 4 cross-module HTTP/MySQL journeys, 36 Newman requests / 87 assertions, 2 browser tests. All pass in the final observed run. Full cross-phase regression and runtime details are canonical in [Phase 6 report](PHASE_6_TEST_EXECUTION_REPORT.md).

Oracle: completed count 2, net value 7000, gross 7500, discount 500; duplicate completion history and two sizes do not multiply totals. Creation outside period but completion inside is included. Completion at exclusive end and missing/normalization-only legacy event are excluded. Chart zeros/top ties, read-only repeatable-read snapshot and amounts beyond MAX_SAFE_INTEGER are verified. Reconciliation tests cover clean retries, refund, payment/amount mismatches, multiple PAID attempts and voucher lifecycle anomalies. No private payment/customer fields are returned.

UI acceptance screenshots: test-results/phase5-dashboard.png and phase5-mobile-empty-error.png. Browser confirms literal malicious product text, filter keyboard use, empty/error/loading/403 behavior and 375px layout. A CSS cascade defect found by the initial mobile test was fixed and retested; see [defect register](PHASE_6_DEFECT_REGISTER.md).

Migrations 001–006 unchanged; no new migration. Payment services were reused; no proven production payment defect required a rewrite. Injected gateway link plus actual signed HTTP IPN/replay/late callback is local test evidence only.

External MoMo: **BLOCKED_EXTERNAL**. Public HTTPS provider callback was not exercised. Contract peer review, final candidate GitHub CI and human acceptance remain PENDING. Do not claim external payment verification or production readiness.
