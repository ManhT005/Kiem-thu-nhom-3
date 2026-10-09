import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  buildMomoIpnSignatureString,
  verifyMomoIpnSignature,
} from "../services/momo.service.js";

test("verifies MoMo IPN signatures and rejects altered callback data", () => {
  const payload = {
    amount: 120000,
    extraData: "",
    message: "Successful.",
    orderId: "MOMO123",
    orderInfo: "Test order",
    orderType: "momo_wallet",
    partnerCode: "MOMO",
    payType: "qr",
    requestId: "MOMO123",
    responseTime: "1720000000000",
    resultCode: 0,
    transId: 99,
  };
  const credentials = {
    accessKey: "test-access",
    secretKey: "test-secret",
  };
  const rawSignature = buildMomoIpnSignatureString(
    payload,
    credentials.accessKey,
  );
  payload.signature = crypto
    .createHmac("sha256", credentials.secretKey)
    .update(rawSignature)
    .digest("hex");

  assert.equal(verifyMomoIpnSignature(payload, credentials), true);
  assert.equal(
    verifyMomoIpnSignature({ ...payload, amount: 1 }, credentials),
    false,
  );
  assert.equal(
    verifyMomoIpnSignature({ ...payload, signature: "not-hex" }, credentials),
    false,
  );
  assert.equal(
    buildMomoIpnSignatureString(
      { ...payload, accessKey: "attacker-controlled" },
      credentials.accessKey,
    ),
    rawSignature,
  );
});

test("verifies MoMo IPN without an accessKey callback property", () => {
  const payload = {
    amount: 120000,
    extraData: "",
    message: "Successful.",
    orderId: "MOMO123",
    orderInfo: "Test order",
    orderType: "momo_wallet",
    partnerCode: "MOMO",
    payType: "qr",
    requestId: "MOMO123",
    responseTime: "1720000000000",
    resultCode: 0,
    transId: 99,
  };
  const credentials = { accessKey: "test-access", secretKey: "test-secret" };
  payload.signature = crypto
    .createHmac("sha256", credentials.secretKey)
    .update(buildMomoIpnSignatureString(payload, credentials.accessKey))
    .digest("hex");

  assert.equal(verifyMomoIpnSignature(payload, credentials), true);
});

test("rejects missing MoMo credentials instead of using demo keys", () => {
  assert.throws(
    () => buildMomoIpnSignatureString({}, ""),
    /MOMO_ACCESS_KEY is required/,
  );
});