# Release candidate checklist

- [ ] Exact candidate SHA fixed; develop-target PR peer reviewed.
- [ ] Commerce Full Regression green on candidate SHA, no skipped critical layer, endpoint inventory fully mapped.
- [ ] Unit/MySQL/Newman/browser evidence reviewed; all critical cases pass; ≥95% overall; no open S1/S2.
- [ ] Contract + Master Plan + RTM match implementation; defect disposition and acceptance signed.
- [ ] Migration 001–006 checksums/backup/recovery reviewed; no production reset/fixture accounts.
- [ ] Hosting env/JWT/CORS/URLs/secrets configured privately; dependency high/critical audit addressed.
- [ ] External payment status disclosed; real sandbox signed callback evidenced or demo exception approved.
- [ ] 5–10 minute demo and provider-outage fallback rehearsed.
- [ ] Artifact URLs/index recorded with SHA/runtime/DB; traces reviewed before public sharing.
- [ ] Human GO; develop→main review/merge authorized; version/tag only if explicitly requested.

Current state: implementation and local automated evidence prepared. Remote CI/review/manual release decision PENDING. No verified external-payment release authorization.
