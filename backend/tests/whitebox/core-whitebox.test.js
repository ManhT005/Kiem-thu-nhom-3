import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { ORDER_STATUS, isOrderStatus, isOrderTransitionAllowed } from "../../domain/order-status.js";
import { voucherInput, voucherCode, calculateVoucher } from "../../domain/voucher.js";
import { MAX_STOCK, moneyCents, receiptItems, listFilters } from "../../domain/inventory.js";
import { applyMovement } from "../../services/inventory.service.js";
import { createAuthenticate } from "../../middleware/authenticate.middleware.js";
import { authorizeRoles } from "../../middleware/authorize.middleware.js";
import { SECRET_KEY } from "../../config/config.js";
import { validateMomoPayUrl, verifyMomoIpnSignature, buildMomoIpnSignatureString, createMomoPaymentLink } from "../../services/momo.service.js";
import { startPaymentExpiration } from "../../jobs/payment-expiration.js";
import { parseReportDate, reportFilters, bucketStart, exactInteger } from "../../domain/reporting.js";

const start = new Date("2026-01-01T00:00:00Z");
const end = new Date("2026-02-01T00:00:00Z");
const now = new Date("2026-01-15T12:00:00Z");
const baseVoucher = (extra = {}) => ({
  enabled: true, discount_type: "PERCENT", discount_value: "10.00",
  minimum_order_amount: "1000.00", maximum_discount_amount: null,
  start_at: start, end_at: end, usage_limit: 3, used_count: 1,
  per_user_limit: 2, ...extra,
});
const voucherError = (fields, subtotal, uses, at, code) =>
  assert.throws(() => calculateVoucher(baseVoucher(fields), subtotal, uses, at), { code });

// WB-ORD-01: transition decision table - exhaustive 5 x 5, not just happy paths.
test("WB-ORD-01: order state machine permits exactly five directed transitions", () => {
  const statuses = Object.values(ORDER_STATUS);
  const allowed = new Set([
    ORDER_STATUS.PENDING + "|" + ORDER_STATUS.CONFIRMED,
    ORDER_STATUS.PENDING + "|" + ORDER_STATUS.CANCELLED,
    ORDER_STATUS.CONFIRMED + "|" + ORDER_STATUS.SHIPPING,
    ORDER_STATUS.CONFIRMED + "|" + ORDER_STATUS.CANCELLED,
    ORDER_STATUS.SHIPPING + "|" + ORDER_STATUS.COMPLETED,
  ]);
  assert.equal(statuses.length, 5);
  let accepted = 0;
  for (const from of statuses) for (const to of statuses) {
    const expected = allowed.has(from + "|" + to);
    assert.equal(isOrderTransitionAllowed(from, to), expected, from + " to " + to);
    accepted += Number(expected);
  }
  assert.equal(accepted, 5);
  for (const invalid of ["PAID", "DELIVERED", "admin", "", null, undefined]) {
    assert.equal(isOrderStatus(invalid), false);
    assert.equal(isOrderTransitionAllowed(invalid, ORDER_STATUS.COMPLETED), false);
    assert.equal(isOrderTransitionAllowed(ORDER_STATUS.PENDING, invalid), false);
  }
});

// WB-VOU-01..09: demonstrate each eligibility predicate independently controls outcome.
test("WB-VOU-01: voucher eligibility decision table holds other guards true", () => {
  assert.equal(calculateVoucher(baseVoucher(), 2000, 0, now), 200);
  voucherError({ enabled: false }, 2000, 0, now, "VOUCHER_DISABLED");
  voucherError({}, 2000, 0, new Date(start.getTime() - 1), "VOUCHER_NOT_STARTED");
  voucherError({}, 2000, 0, end, "VOUCHER_EXPIRED");
  voucherError({}, 999, 0, now, "MIN_ORDER_NOT_MET");
  voucherError({ used_count: 3 }, 2000, 0, now, "VOUCHER_USAGE_LIMIT");
  voucherError({}, 2000, 2, now, "VOUCHER_USER_LIMIT");
  assert.equal(calculateVoucher(baseVoucher(), 2000, 0, start), 200);
  assert.equal(calculateVoucher(baseVoucher(), 2000, 0, new Date(end.getTime() - 1)), 200);
  assert.equal(calculateVoucher(baseVoucher({ usage_limit: null }), 2000, 0, now), 200);
  for (const amount of [-1, 1.3, Number.MAX_SAFE_INTEGER + 1, "2000"]) {
    assert.throws(() => calculateVoucher(baseVoucher(), amount, 0, now), { code: "VALIDATION_ERROR" });
  }
});

test("WB-VOU-02: PERCENT/FIXED, max cap and order-total cap take each branch", () => {
  assert.equal(calculateVoucher(baseVoucher({ minimum_order_amount: "0", discount_value: "12.34" }), 10001, 0, now), 1234);
  assert.equal(calculateVoucher(baseVoucher({ maximum_discount_amount: "100.00" }), 2000, 0, now), 100);
  assert.equal(calculateVoucher(baseVoucher({ maximum_discount_amount: "500.00" }), 2000, 0, now), 200);
  assert.equal(calculateVoucher(baseVoucher({ discount_type: "FIXED", discount_value: "5000.00" }), 2000, 0, now), 2000);
  assert.equal(calculateVoucher(baseVoucher({ discount_type: "FIXED", discount_value: "199.99" }), 2000, 0, now), 199);
  assert.equal(calculateVoucher(baseVoucher({ discount_type: "FIXED", discount_value: "500.00" }), 2000, 0, now), 500);
});

test("WB-VOU-03: voucher validation covers time, code, flags and numeric boundaries", () => {
  const input = { code: " wb_test ", discountType: "PERCENT", discountValue: 100, startAt: start.toISOString(), endAt: end.toISOString() };
  assert.equal(voucherInput(input).code, "WB_TEST");
  assert.equal(voucherInput({ ...input, usageLimit: null }).usage_limit, null);
  assert.equal(voucherInput({ ...input, usageLimit: 0 }).usage_limit, 0);
  assert.equal(voucherCode(undefined, true), "");
  for (const bad of ["a", "a b", "!CODE", 17, null]) assert.throws(() => voucherCode(bad), { code: "VALIDATION_ERROR" });
  for (const bad of [0, 101, -1]) assert.throws(() => voucherInput({ ...input, discountValue: bad }), { code: "VALIDATION_ERROR" });
  for (const patch of [
    { discountType: "BOGUS" }, { enabled: 1 }, { perUserLimit: -1 },
    { startAt: "2026-02-30T00:00:00Z" }, { startAt: "2026-01-01T00:00:00" },
    { endAt: input.startAt }, { description: "x".repeat(501) },
  ]) assert.throws(() => voucherInput({ ...input, ...patch }), { code: "VALIDATION_ERROR" });
});

// WB-INV-01..03: input branches, mutation guards, success and dedup paths.
test("WB-INV-01: receipt boundaries, duplicate variants and overflow", () => {
  const item = { maSP: 2, maSize: 1, soLuongNhap: 1, donGiaNhap: "5.02" };
  assert.equal(receiptItems([item]).total, "5.02");
  assert.deepEqual(receiptItems([{ ...item, maSP: 9 }, item]).items.map(x => x.maSP), [2, 9]);
  for (const bad of [0, -1, MAX_STOCK + 1, 1.5, null]) {
    assert.throws(() => receiptItems([{ ...item, soLuongNhap: bad }]), { code: "VALIDATION_ERROR" });
  }
  assert.throws(() => receiptItems([item, item]), { code: "VALIDATION_ERROR" });
  assert.throws(() => receiptItems([]), { code: "VALIDATION_ERROR" });
  assert.throws(() => receiptItems([{ ...item, soLuongNhap: MAX_STOCK, donGiaNhap: "999999999999.99" }]), { code: "VALIDATION_ERROR" });
  assert.equal(moneyCents("1.25"), 125);
  for (const bad of ["1.999", "-1", "1e4", null]) assert.throws(() => moneyCents(bad), { code: "VALIDATION_ERROR" });
  assert.equal(listFilters({ page: "2", limit: "3" }).offset, 3);
  assert.throws(() => listFilters({ fromDate: "2026-02-30" }), { code: "VALIDATION_ERROR" });
  assert.throws(() => listFilters({ fromDate: "2026-03-01", toDate: "2026-02-01" }), { code: "VALIDATION_ERROR" });
});

test("WB-INV-02: invalid inventory movements cannot reach a repository write", async () => {
  let mutations = 0;
  const repository = {
    lockVariant: async () => ({ is_active: 1, soLuongTon: 2 }),
    findMovement: async () => null,
    ensureOpening: async () => { mutations++; },
    updateStock: async () => { mutations++; return 1; },
    insertMovement: async () => { mutations++; return 10; },
  };
  const base = { maSP: 1, maSize: 1, delta: -1, eventType: "ORDER", referenceType: "ORDER", referenceId: "A123", reason: "purchase" };
  const invalidCases = [
    [{ delta: 0 }, "INVALID_MOVEMENT"],
    [{ delta: 1 }, "INVALID_MOVEMENT"],
    [{ eventType: "RECEIPT", referenceType: "GOODS_RECEIPT", delta: -1 }, "INVALID_MOVEMENT"],
    [{ referenceId: "has space" }, "INVALID_MOVEMENT"],
    [{ reason: "" }, "VALIDATION_ERROR"],
  ];
  for (const [patch, code] of invalidCases) await assert.rejects(
    applyMovement({}, { ...base, ...patch }, repository), { code });
  repository.lockVariant = async () => null;
  await assert.rejects(applyMovement({}, base, repository), { code: "INVENTORY_VARIANT_NOT_FOUND" });
  repository.lockVariant = async () => ({ is_active: 0, soLuongTon: 2 });
  await assert.rejects(applyMovement({}, base, repository), { code: "VARIANT_INACTIVE" });
  repository.lockVariant = async () => ({ is_active: 1, soLuongTon: 0 });
  await assert.rejects(applyMovement({}, base, repository), { code: "INSUFFICIENT_STOCK" });
  repository.lockVariant = async () => ({ is_active: 1, soLuongTon: MAX_STOCK });
  await assert.rejects(applyMovement({}, { ...base, delta: 1, eventType: "RECEIPT", referenceType: "GOODS_RECEIPT" }, repository), { code: "STOCK_OVERFLOW" });
  assert.equal(mutations, 0);
});

test("WB-INV-03: movement idempotency/conflict, failed update and successful write", async () => {
  const base = { maSP: 1, maSize: 1, delta: -1, eventType: "ORDER", referenceType: "ORDER", referenceId: "123", reason: "purchase" };
  let writes = 0;
  const repository = {
    lockVariant: async () => ({ is_active: 1, soLuongTon: 2 }),
    findMovement: async () => ({ id: 11, delta: -1, quantity_after: 1 }),
    ensureOpening: async () => { writes++; },
    updateStock: async () => { writes++; return 1; },
    insertMovement: async () => { writes++; return 12; },
  };
  assert.deepEqual(await applyMovement({}, base, repository), { id: 11, quantityAfter: 1, duplicate: true });
  await assert.rejects(applyMovement({}, { ...base, delta: -2 }, repository), { code: "MOVEMENT_CONFLICT" });
  assert.equal(writes, 0);
  repository.findMovement = async () => null;
  repository.updateStock = async () => 0;
  await assert.rejects(applyMovement({}, base, repository), { code: "STOCK_UPDATE_FAILED" });
  repository.updateStock = async () => { writes++; return 1; };
  const result = await applyMovement({}, base, repository);
  assert.deepEqual(result, { id: 12, quantityAfter: 1, duplicate: false });
  assert.equal(writes, 4);
});

const invokeAuth = (header, options = {}, user = { id: 7, role: "user", status: "ACTIVE", token_version: 1 }) => {
  const middleware = createAuthenticate({ ...options, loadUser: async () => user });
  const req = { headers: header === undefined ? {} : { authorization: header } };
  return new Promise(resolve => middleware(req, {}, error => resolve({ error, req })));
};
const token = (claims, options) => jwt.sign(claims, SECRET_KEY, { algorithm: "HS256", ...options });
test("WB-AUTH-01: absent, malformed, altered and expired JWT branches return 401", async () => {
  const claims = { id: 7, token_version: 1, role: "admin" };
  for (const header of [
    undefined, "Basic " + token(claims), "Bearer ", "Bearer garbage",
    "Bearer " + token(claims) + "tamper",
    "Bearer " + token(claims, { expiresIn: -1 }),
  ]) {
    const result = await invokeAuth(header);
    assert.equal(result.error?.status, 401);
  }
  assert.equal((await invokeAuth(undefined, { optional: true })).error, undefined);
  assert.equal((await invokeAuth("Basic bad", { optional: true })).error?.status, 401);
  assert.equal((await invokeAuth("Bearer " + token({ id: 7 }), {})).error?.code, "TOKEN_REVOKED");
});

test("WB-AUTH-02: persisted identity/role gate is authoritative and failures are independent", async () => {
  const claims = { id: 7, token_version: 1, role: "admin" };
  const header = "Bearer " + token(claims);
  const ok = await invokeAuth(header);
  assert.equal(ok.error, undefined);
  assert.equal(ok.req.user.role, "user");
  let decision;
  authorizeRoles("admin")(ok.req, {}, error => { decision = error; });
  assert.equal(decision?.code, "FORBIDDEN");
  authorizeRoles("user")(ok.req, {}, error => { decision = error; });
  assert.equal(decision, undefined);
  for (const [user, code] of [
    [null, "TOKEN_REVOKED"],
    [{ id: 7, role: "user", status: "LOCKED", token_version: 1 }, "ACCOUNT_LOCKED"],
    [{ id: 7, role: "user", status: "ACTIVE", token_version: 2 }, "TOKEN_REVOKED"],
  ]) assert.equal((await invokeAuth(header, {}, user)).error?.code, code);
  authorizeRoles("user")({}, {}, error => { decision = error; });
  assert.equal(decision?.code, "FORBIDDEN");
});

test("WB-MOMO-01: URL allowlist and HMAC integrity reject altered IPN fields", () => {
  const credentials = { accessKey: "access", secretKey: "secret" };
  const payload = { amount: 120000, extraData: "", message: "OK", orderId: "O1", orderInfo: "order",
    orderType: "momo_wallet", partnerCode: "MOMO", payType: "qr", requestId: "R1",
    responseTime: "1720000000000", resultCode: 0, transId: 99 };
  const signature = crypto.createHmac("sha256", credentials.secretKey)
    .update(buildMomoIpnSignatureString(payload, credentials.accessKey)).digest("hex");
  assert.equal(verifyMomoIpnSignature({ ...payload, signature }, credentials), true);
  assert.equal(verifyMomoIpnSignature({ ...payload, amount: 1, signature }, credentials), false);
  assert.equal(verifyMomoIpnSignature({ ...payload, signature: "bad" }, credentials), false);
  assert.equal(verifyMomoIpnSignature(null, credentials), false);
  assert.equal(validateMomoPayUrl("https://test-payment.momo.vn/v2/pay"), "https://test-payment.momo.vn/v2/pay");
  for (const url of ["http://payment.momo.vn/", "https://payment.momo.vn.evil.test/", "https://user@payment.momo.vn/", "javascript:alert(1)"]) {
    assert.throws(() => validateMomoPayUrl(url), /Invalid MoMo/);
  }
});

test("WB-MOMO-02: outbound gateway request is signed and boundaries fail before fetch", async () => {
  const originalFetch = globalThis.fetch;
  const keys = ["MOMO_ACCESS_KEY", "MOMO_SECRET_KEY", "APP_BASE_URL", "PUBLIC_API_URL"];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const observed = [];
  try {
    Object.assign(process.env, { MOMO_ACCESS_KEY: "access", MOMO_SECRET_KEY: "secret",
      APP_BASE_URL: "https://shop.example.test", PUBLIC_API_URL: "https://api.example.test" });
    globalThis.fetch = async (url, options) => {
      observed.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ payUrl: "https://test-payment.momo.vn/pay" }) };
    };
    for (const amount of [999, 50000001, 1.5]) await assert.rejects(
      createMomoPaymentLink({ amount, orderId: "O1", requestId: "R1" }), /amount/);
    assert.equal(observed.length, 0);
    const response = await createMomoPaymentLink({ amount: 120000, orderId: "O1", requestId: "R1" });
    assert.match(response.payUrl, /^https:/);
    assert.equal(observed.length, 1);
    const call = observed[0];
    assert.equal(call.url, "https://test-payment.momo.vn/v2/gateway/api/create");
    const body = JSON.parse(call.options.body);
    const raw = "accessKey=access&amount=120000&extraData=&ipnUrl=https://api.example.test/api/payments/momo/ipn&orderId=O1&orderInfo=Thanh toán đơn hàng quần áo&partnerCode=MOMO&redirectUrl=https://shop.example.test/order-success&requestId=R1&requestType=payWithATM";
    assert.equal(body.signature, crypto.createHmac("sha256", "secret").update(raw).digest("hex"));
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of keys) if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
  }
});

test("WB-JOB-01: expiration worker invalid intervals, disabled and de-duplicated execution", async () => {
  for (const intervalMs of [0, -1, 1.5, NaN]) assert.throws(() => startPaymentExpiration({ intervalMs, enabled: false }), RangeError);
  const disabled = startPaymentExpiration({ enabled: false, expire: () => assert.fail("not called") });
  await disabled.run();
  await disabled.stop();
  let done, calls = 0;
  const worker = startPaymentExpiration({ enabled: true, intervalMs: 100000,
    expire: async () => { calls++; await new Promise(resolve => { done = resolve; }); } });
  const work = worker.run();
  assert.equal(worker.run(), work);
  await Promise.resolve();
  assert.equal(calls, 1);
  const stopping = worker.stop();
  done();
  await stopping;
  await worker.run();
  assert.equal(calls, 1);
});

test("WB-REP-01: report filters cover UTC calendar, whitelist, interval and category branches", () => {
  assert.equal(parseReportDate("2024-02-29").toISOString(), "2024-02-29T00:00:00.000Z");
  for (const bad of ["2023-02-29", "2026-02-30", "2026-01-01T24:00:00Z", "2026-01-01T00:00:00", [], "a"]) {
    assert.throws(() => parseReportDate(bad), { code: "INVALID_REPORT_FILTER" });
  }
  assert.throws(() => reportFilters({ from: "2026-01-01" }), { code: "INVALID_REPORT_FILTER" });
  assert.throws(() => reportFilters({ from: "2026-02-01", to: "2026-01-01" }), { code: "INVALID_REPORT_FILTER" });
  assert.throws(() => reportFilters({ unexpected: "1" }), { code: "INVALID_REPORT_FILTER" });
  assert.equal(reportFilters({ limit: "20", sort: "grossSales" }, "top").limit, 20);
  for (const bad of ["0", "21", "1 OR 1=1"]) assert.throws(() => reportFilters({ limit: bad }, "top"), { code: "INVALID_REPORT_FILTER" });
  assert.throws(() => reportFilters({ sort: "random" }, "top"), { code: "INVALID_REPORT_FILTER" });
  assert.equal(reportFilters({ from: "2026-01-01", to: "2026-01-03" }, "chart").buckets.length, 2);
  assert.throws(() => reportFilters({ from: "2026-01-01", to: "2026-02-01" }, "chart"), { code: "INVALID_REPORT_FILTER" });
  assert.throws(() => reportFilters({ groupBy: "quarter" }, "chart"), { code: "INVALID_REPORT_FILTER" });
  assert.equal(reportFilters({ status: "AMOUNT_MISMATCH", page: "2" }, "reconciliation").page, 2);
  assert.throws(() => reportFilters({ status: "HACKED" }, "reconciliation"), { code: "INVALID_REPORT_FILTER" });
  assert.equal(bucketStart("2026-01-07", "week").toISOString(), "2026-01-05T00:00:00.000Z");
  assert.equal(bucketStart("2026-01-07", "month").toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal(exactInteger("9007199254740993.00"), "9007199254740993");
  assert.throws(() => exactInteger("1.75"), { code: "INVALID_REPORT_DATA" });
});
