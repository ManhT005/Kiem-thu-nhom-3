# Phase 6 defect register

Severity policy: S1 blocker and S2 integrity/security stop release; S3/S4 require owner-approved deferral. Test/environment failures are tracked separately from production defects. No known production S1/S2 was discovered in the completed automated scope; this is not a human signoff.

| ID | Severity/module | Reproduction / expected vs actual | Root cause / fix | Retest / status |
|---|---|---|---|---|
| QA-ENV-001 | Environment / Node runner | sandbox unit/integration invocation → spawn EPERM, no tests execute | process creation restricted; run authorized tests outside sandbox against isolated DB | rerun passes; CLOSED |
| QA-ORACLE-001 | Test fixture / J3 | receipt/sale for one size; all-size reconciliation included untouched synthetic size without opening ledger | constrain oracle to affected maSP+maSize; expected delta=0 for transacted variant | J3 + full integration PASS; CLOSED |
| P5-UI-001 | S3 / mobile admin | 375px header/sidebar intercept click on Thống kê | reporting responsive rules preceded legacy base CSS; move responsive rules after base | 11/11 browser PASS including 375px; CLOSED |
| QA-EXT-001 | Acceptance blocker | external MoMo credentials/public HTTPS callback evidence absent | release owner supplies environment and executes sandbox runbook | BLOCKED_EXTERNAL; no external payment claims |
| QA-GOV-001 | Release gate | candidate GitHub CI/reviewer/manual acceptance not yet observed | owner runs required workflow and signs checklist after candidate push | PENDING |

Any future functional failure must record expected/actual, reproduction, private evidence, owner, fix SHA and retest. Do not relabel an unresolved failure as flaky PASS by repeated runs.
