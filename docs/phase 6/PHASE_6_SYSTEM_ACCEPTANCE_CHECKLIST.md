# System acceptance checklist

Automated evidence is recorded in the execution report/RTM. A human tester must fill tester, date, candidate SHA and artifact references; unchecked manual gates must not be represented as accepted.

- [ ] Tester / date / candidate SHA recorded.
- [ ] Independently reproduce install, migrations and full regression on clean Node 22/MySQL 8 environment.
- [ ] Review J1 COD/voucher completion/report; J2 cancellation; J3 receipt/sale/ledger; J4 voucher limits; J5 account lock/new login.
- [ ] Review J6 signed mock IPN/replay and J7 late payment/refund marker with explicit mock label.
- [ ] Review J8 dashboard independent oracle and staff denial; J9 deep links/private file denial.
- [ ] Keyboard/focus labels, 375px/reduced-motion, empty/loading/error states accepted manually.
- [ ] External MoMo acceptance PASS with redacted evidence, or demo-only BLOCKED_EXTERNAL exception signed by owner.
- [ ] No S1/S2; any S3/S4 disposition includes owner/signature.
- [ ] CI on candidate SHA green, all artifacts retrievable; reviewer approves.

Tester: PENDING. Release owner: PENDING. Decision: PENDING; NO-GO for verified external payment claims.
