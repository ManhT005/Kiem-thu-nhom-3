# External MoMo sandbox acceptance

Status: **BLOCKED_EXTERNAL**. No provider credentials/public HTTPS callback acceptance evidence was supplied or executed in this change. Local mock gateway plus signed HTTP IPN tests are separate evidence; they do not verify external MoMo connectivity.

Release owner must record tester/date, candidate SHA, provider sandbox environment and redacted artifact location. Keep credentials in environment/hosting secrets, never in this document or public Postman reports.

1. Configure MOMO_ACCESS_KEY, MOMO_SECRET_KEY, MOMO_PARTNER_CODE, APP_BASE_URL and PUBLIC_API_URL. Both URLs must be reachable public HTTPS. Callback is POST /api/payments/momo/ipn.
2. Create a real persisted MoMo order for 1000–50000000 VND. Call authenticated POST /api/payments/momo/create with orderId. Capture references after redaction; verify order amount matches signed request.
3. Open returned provider sandbox pay URL; complete sandbox interaction and observe browser return. Return resultCode never establishes PAID.
4. Observe provider-signed IPN accepted with 204; authenticated GET /api/payments/momo/orders/:orderId/status must report PAID, or an observed failure state.
5. Compare DB transaction/provider references, amount/transId, order history, stock and voucher. Replay identical callback: no additional effective transition. Forged signature must return 400.
6. Exercise timeout/late success and verify cancellation restoration once, REFUND_REQUIRED and read-only reconciliation. Do not claim automatic refund.
7. Store redacted logs/screenshots/SQL observations, time and SHA; peer reviewer signs pass/fail. Provider outage is BLOCKED, not PASS.

Decision: NO-GO for claims of verified external or production payment. Academic demo with clearly labelled mocked payment remains subject to human risk acceptance. Tester/signoff: PENDING.
