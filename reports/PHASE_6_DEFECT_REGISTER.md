# Phase 6 Defect Register

Severity policy:

- **S1** — release blocker
- **S2** — security/data-integrity blocker
- **S3/S4** — may be deferred only with owner-approved disposition
- Environment/test-harness issues are tracked separately from production defects.

Current automated baseline has **no known open S1/S2**.

| ID | Severity/module | Issue | Resolution | Status |
|---|---|---|---|---|
| QA-ENV-001 | Environment | Sandbox process spawn restriction prevented test execution | Re-ran in authorized isolated environment | CLOSED |
| QA-ORACLE-001 | Test oracle / J3 | Reconciliation oracle included an untouched synthetic size | Constrained oracle to affected product+size | CLOSED |
| P5-UI-001 | S3 / mobile admin | Mobile header/sidebar intercepted Reporting tab | Corrected CSS cascade/order and regression tested | CLOSED |
| QA-CI-001 | CI / dependency gate | Runtime dependency audit initially failed on stale Express/MySQL2/Multer/Axios dependency graph | Removed Axios runtime use, upgraded Multer/Express/MySQL2, synchronized npm lockfile and retained fail-closed runtime audit | CLOSED |
| QA-EXT-001 | External acceptance | Real MoMo credentials/public HTTPS callback evidence unavailable | Execute external sandbox runbook or approve transparent demo-only exception | BLOCKED_EXTERNAL |
| QA-GOV-001 | Release governance | Manual tester/reviewer/release-owner sign-off not recorded | Complete system/release acceptance checklist | PENDING |

## CI closure

After dependency remediation and lockfile correction, the current `develop` merge commit passed:

- 57 unit tests;
- 43 integration tests;
- 11 browser tests;
- 163 Newman requests / 316 assertions;
- 62/62 endpoint mapping;
- runtime dependency security baseline.

Any new defect must include reproduction, expected/actual result, severity, affected SHA, owner, fix SHA and retest result. An unresolved failure must not be reclassified as flaky solely because a rerun passes.
