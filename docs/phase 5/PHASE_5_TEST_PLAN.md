# Phase 5 test plan

Use isolated MySQL 8 *_test, ORDER_CONCURRENCY_TEST=1 and no production environment. Tests are sequential per DB. Run npm run test:all after migration and phase2 seed. Canonical evidence and test IDs are in [Phase 6 RTM](../phase%206/PHASE_6_REQUIREMENT_TRACEABILITY_MATRIX.md).

| Matrix IDs | Layer/oracle |
|---|---|
| P5-R-001–005,010 | MySQL fixture: net 7000, gross 7500, discount 500, two completions; duplicate history, multiple sizes, exclusive end, creation outside completion period, legacy excluded |
| P5-R-006–008 | Unit + MySQL + Newman: zero buckets, UTC offset, Monday/week/year/month/leap boundaries, top limits and ties, invalid calendar/range/SQL-shaped whitelist |
| P5-R-009 | All five endpoints: guest/user/staff/admin, persisted lock/revocation, auth claim ignored by baseline auth tests |
| P5-R-011 | Concurrent writer while repeatable read snapshot remains unchanged; write in snapshot denied; pooled default isolation preserved |
| P5-P-001–005,008 | Existing payment integration plus new signed HTTP replay/correlation/late callback journeys and voucher/ledger assertions |
| P5-P-006,007 | Baseline browser return spoof and retry; provider failure integration |
| P5-P-009 | Clean/failed attempts vs refund/mismatch fixtures, overlapping reasons, pagination and private-field omission |
| P5-P-010 | Separate external acceptance; BLOCKED_EXTERNAL until signed public callback is evidenced |
| P5-REG-001 | All prior unit/MySQL/Newman/Playwright suites remain required |

Browser acceptance: populated/exact values; chart table; malicious product label rendered literally; empty period; invalid range retains controls; loading disables controls; 500/403 hides stale data; mobile width and reduced motion. Screenshot artifacts are generated, not committed with sessions/tokens.
