# Clothes Shop — commerce integrity and reporting

Express + MySQL + Vanilla JS. Phase 5 adds admin reporting/payment reconciliation; Phase 6 adds full regression/evidence/CI. Installation, environment, safe migrations and demo instructions are in the [release runbook](docs/phase%206/PHASE_6_RELEASE_RUNBOOK.md).

Use Node 22/MySQL 8. Install root/backend with npm ci. Normal deployment uses db:migrate, never db:reset. Full regression needs an explicit isolated *_test database, ORDER_CONCURRENCY_TEST=1 and phase2 fixtures; run npm run test:all after the runbook setup.

- [Reporting contract](docs/phase%205/PHASE_5_CONTRACT.md)
- [Master test plan](docs/MASTER_TEST_PLAN.md) and [traceability](docs/phase%206/PHASE_6_REQUIREMENT_TRACEABILITY_MATRIX.md)
- [Observed local execution](reports/PHASE_6_TEST_EXECUTION_REPORT.md)
- [CI evidence index](reports/PHASE_6_CI_EVIDENCE_INDEX.md) and [release gates](docs/phase%206/PHASE_6_RELEASE_CHECKLIST.md)
- [External MoMo acceptance](docs/phase%205/PHASE_5_MOMO_SANDBOX_ACCEPTANCE.md): BLOCKED_EXTERNAL until real public signed callback evidence and human signoff.

CI: .github/workflows/commerce-regression.yml (Commerce Full Regression). Canonical UI: /login, /cart, /checkout, /orders, /admin, /inventory, /vouchers. Dashboard completed order value represents completed order totals after voucher; it does not assert collected/settled funds.
