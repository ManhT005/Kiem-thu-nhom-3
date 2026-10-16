# Phase 4 RBAC and token policy

The permission table in PHASE_4_IMPLEMENTATION.md is frozen for this implementation. HTTP service guard order is authenticate persisted identity → authorize stored role → validate business payload → mutate atomically. Guest protected requests are 401; disallowed authenticated roles are 403. Cross-user Order/payment access is 403, preserving the Phase 2 policy.

Authentication rejects locked users immediately, compares token_version on every request and ignores role claims for authorization. Unlock requires a new login; role/status mutations audit actor/reason/version. No physical account delete is exposed. Profile/address is always scoped by authenticated ID, never a submitted user ID.

The integration matrix executes 48 requests: guest/user/staff/admin × user admin list, voucher admin list, receipt read, reconciliation, cart, my-orders, all-orders, voucher preview, receipt create, adjustment, payment create and product create. Allowed mutation routes receive intentionally invalid bodies and must reach validation (400), while forbidden roles must stop at 401/403 without mutation. Separate tests cover forged advisory role, old staff token after demotion, locked login, unlock replay, reciprocal admin changes and cross-user history/payment regressions.

The API suites additionally verify legacy setters use the lifecycle service, staff cannot apply vouchers, users cannot administer vouchers and admin self-lock conflicts. UI role/status hints do not replace these backend guards.
