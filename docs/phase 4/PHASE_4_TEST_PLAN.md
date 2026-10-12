# Phase 4 test plan

Environment: Node 22, MySQL 8, Chromium, dedicated *_test fixture database. Master plan P4-00–P4-06.

| Cases / technique | Inputs and assertion | Suite |
|---|---|---|
| P4-U-01–05 / lifecycle | ACTIVE login; LOCKED login; old token after lock/unlock; staff demotion; missing/deleted/unversioned identity | Unit factory + real HTTP/MySQL integration, Newman and admin browser |
| P4-U-06 / concurrency | Self-management denied, last-admin guard, reciprocal simultaneous admin demotions | Unit business guard and serialized MySQL transitions |
| P4-R-01 / matrix | 4 actors × 12 protected operations (48 requests), persisted role vs advisory JWT | user-voucher-integrity integration and RBAC_MATRIX |
| P4-R-02 / IDOR | Foreign Order history/cancel/payment status, payload actor/user ID ignored | Retained Phase 2 integration/Newman guards |
| P4-V-01–08 / decision table | Enabled/window/min/global/per-user eligibility, replay | Pure domain boundaries + MySQL preview/application |
| BVA | Percent 0/1/100/101; fixed 0/equal/>subtotal; cap 0/positive; min-1/min; start-1ms/start; end-1ms/end; limit 0/1/null | voucher-domain tests |
| P4-V-09 / concurrency | Ten buyers, one usage; ten same-key retries | One order/redemption/usage; no double stock/ledger |
| P4-V-10 / atomic rejection | Unknown/disabled/exhausted/per-user voucher | Preserve order/cart/stock/ledger and usage |
| P4-V-11 / rollback | Inject trigger failure on second ORDER movement after voucher reservation | Roll back order, all stock rows, ledger, redemption, used_count |
| P4-V-12 / state | Concurrent cancellation; MoMo FAILED/EXPIRED/PAID and late IPN; COD completion | Release once or keep committed per frozen policy |
| P4-V-13/14 / tampering/history | Fake price/subtotal/discount; edit voucher after Order | Recompute from DB and preserve discount/code/subtotal snapshots |
| Migration | Existing GiamGia/DonHang preserved; disabled legacy codes; user defaults; registry replay; guarded test-only down/up | Isolated user-voucher-migration |
| Browser | Admin lock/unlock/change role; create voucher; real checkout preview/apply/cancel | UI → authenticated Express → MySQL; screenshots |
| P4-REG-01 | Full Phase 1–3 unit, transaction, concurrent Order/payment, receipts, migration, Newman and Chromium | test:all on final implementation SHA |

Require no failures/skips of critical cases, zero usage duplication and stock/ledger mismatches. Archive JUnit/Newman/screenshot/log evidence and require fresh remote CI on pushed head before merging. Local tests use injected MoMo gateway responses; real sandbox payment/IPN readiness is not claimed.
