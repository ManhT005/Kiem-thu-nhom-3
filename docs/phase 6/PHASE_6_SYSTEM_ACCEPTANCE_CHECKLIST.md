# System Acceptance Checklist

Automated regression is already green on `develop@4d42fd767ac949543edc26eb6fd3ac8efd798215`. This checklist is for **human acceptance**, not a duplicate automated test run.

## Candidate record

- [ ] Tester name
- [ ] Review date
- [ ] Candidate SHA
- [ ] CI run URL
- [ ] Artifact/evidence reference

## Functional journey review

- [ ] J1 COD/voucher completion -> reporting result reviewed.
- [ ] J2 cancellation -> stock and voucher restoration reviewed.
- [ ] J3 receipt -> sale -> inventory ledger/reconciliation reviewed.
- [ ] J4 voucher global/per-user limits reviewed.
- [ ] J5 account lock/token revocation/new login reviewed.
- [ ] J6 signed mock MoMo IPN/replay reviewed and clearly labeled mock/local.
- [ ] J7 expiry/late payment/refund marker reviewed.
- [ ] J8 dashboard oracle + staff denial reviewed.
- [ ] J9 deep-link/static/private-file denial reviewed.

## UX/manual checks

- [ ] Keyboard navigation and visible focus accepted.
- [ ] Accessible labels/text alternatives accepted.
- [ ] 375px layout accepted.
- [ ] Reduced-motion behavior accepted.
- [ ] Loading/empty/error/forbidden states accepted.

## Evidence and defect review

- [ ] CI run green on candidate SHA.
- [ ] Unit/integration/API/browser evidence is retrievable.
- [ ] RTM and endpoint mapping reviewed.
- [ ] No unresolved S1/S2.
- [ ] S3/S4 disposition, if any, has owner approval.

## External payment

- [ ] Real sandbox/public callback acceptance PASS, **or**
- [ ] Demo-only exception signed with MoMo marked **BLOCKED_EXTERNAL**.

Tester: PENDING  
Reviewer: PENDING  
Release owner: PENDING  
Decision: PENDING

Until the external payment item is resolved, the project must not claim verified production MoMo readiness.
