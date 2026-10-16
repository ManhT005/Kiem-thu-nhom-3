# CI and Evidence Index

Workflow: [`.github/workflows/commerce-regression.yml`](../.github/workflows/commerce-regression.yml)  
Name: **Commerce Full Regression**  
Runtime: Node 22 + MySQL 8  
Artifact retention: 14 days

Current verified integration baseline:

```text
develop@4d42fd767ac949543edc26eb6fd3ac8efd798215
```

Verified successful runs on 2026-10-16:

- Push run: `38862471238`
- PR-related run: `38862474567`

Both completed successfully.

## Current CI result

| Layer | Result |
|---|---:|
| Unit | 57/57 PASS |
| Integration | 43/43 PASS |
| Browser | 11/11 PASS |
| Newman | 163 requests / 316 assertions PASS |
| Endpoint coverage | 62/62 |
| Runtime audit | 0 high/critical vulnerabilities |

## Artifact paths

| Artifact path under `test-results/` | Purpose |
|---|---|
| `unit.xml` / `integration.xml` / `browser.xml` | JUnit pass/fail/skipped evidence |
| `newman-*/.json` and `.html` | API request/assertion outcomes |
| `api-summary.json` | Runtime, SHA and aggregate API result |
| `endpoint-coverage.json` | Mounted method/path mapped to collection cases |
| `release-evidence.json` | Runtime, DB, migration checksums, test counts and acceptance flags |
| `npm-audit-root.json` | Full root dependency advisory snapshot |
| `npm-audit-backend.json` | Full backend dependency advisory snapshot |
| `server.log` | Managed test server lifecycle/errors |
| `browser/` | Failure screenshots/traces when generated |
| Phase screenshots | Fixture-only UI acceptance evidence |

The CI security release gate separately runs runtime dependency audit with `--omit=dev` and blocks high/critical runtime findings.

## Evidence handling

Generated artifacts are intentionally not committed as permanent raw output. Before public sharing:

- remove secrets, tokens and environment values;
- review screenshots/traces for session data;
- never upload `.env`, provider credentials or DB dumps;
- identify evidence by candidate SHA and CI run ID.

External MoMo evidence is not present in the current CI bundle and remains a separate manual/external acceptance gate.
