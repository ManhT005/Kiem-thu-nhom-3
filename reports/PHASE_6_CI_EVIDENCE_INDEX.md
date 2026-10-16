# CI and evidence index

Workflow: [.github/workflows/commerce-regression.yml](../.github/workflows/commerce-regression.yml), Commerce Full Regression, job commerce-regression, Node 22 + MySQL 8, 25-minute deadline, always artifact upload, 14-day retention. Remote run URL/candidate SHA/artifact URL: PENDING; no new remote run is claimed.

| Artifact path under test-results | Purpose |
|---|---|
| unit.xml / integration.xml / browser.xml | JUnit pass/fail/skipped counts |
| newman-ClothesShop/Phase3/Phase4/Phase5/Phase6.json and .html | Request status/timing/assertion outcomes; omit bodies/headers/tokens/env |
| api-summary.json | Manifest completion, runtime, SHA and aggregate suite results |
| endpoint-coverage.json | Mounted method/path → named collection cases |
| release-evidence.json | Runtime/DB/checksums/counts/coverage/measured latency and pending external/manual gates |
| npm-audit-root.json / npm-audit-backend.json | Full dependency-tree advisory snapshots; CI release gate separately blocks high/critical runtime dependencies with `--omit=dev` |
| server.log | Managed server startup/shutdown errors; no .env dump |
| browser/ | Failure screenshots/traces; review before public sharing |
| phase3/phase4/phase5 screenshots | Browser acceptance screenshots with fixture-only UI data |

Artifacts are ignored by Git; rerun produces them. Store public screenshots after redaction; never share .env, provider keys, DB dumps or raw Newman request/response exports. Fixture passwords exist only in test definitions and are not deployment credentials. Uploaded browser traces can contain test-session tokens; repository artifact access controls and retention apply.
