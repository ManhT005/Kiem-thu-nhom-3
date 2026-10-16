# Release Candidate Checklist

Current automated baseline: `develop@4d42fd767ac949543edc26eb6fd3ac8efd798215`.

## Automated gates

- [x] Commerce Full Regression green on current develop merge commit.
- [x] Unit regression PASS: 57/57.
- [x] MySQL integration/concurrency PASS: 43/43.
- [x] Browser critical smoke PASS: 11/11.
- [x] Newman API regression PASS: 163 requests / 316 assertions.
- [x] Endpoint inventory mapped: 62/62.
- [x] Runtime dependency high/critical audit PASS.
- [x] No known open S1/S2 in automated scope.
- [x] Migration baseline 001–006 verified by automated evidence.

## Review and manual gates

- [ ] Exact final release/demo candidate SHA recorded.
- [ ] CI artifacts downloaded/reviewed and linked to the candidate SHA.
- [ ] Contract + Master Test Plan + RTM reviewed against implementation.
- [ ] Manual keyboard/focus/accessibility and 375px responsive acceptance completed.
- [ ] Demo flow and provider-outage fallback rehearsed.
- [ ] Any remaining S3/S4 has owner-approved disposition.
- [ ] Tester/reviewer names and date recorded.

## External payment gate

Choose exactly one:

- [ ] Real MoMo sandbox/public HTTPS callback acceptance PASS with redacted evidence.
- [ ] Academic/demo exception approved with external MoMo explicitly marked **BLOCKED_EXTERNAL**.

Do not claim verified external/production payment while neither option is completed.

## Release decision

- [ ] Release owner records **GO**.
- [ ] `develop -> main` merge is reviewed and authorized.
- [ ] Version/tag is created only if required by the team.

**Current state:** automated gates PASS; manual/release-owner/external-payment decision remains pending.
