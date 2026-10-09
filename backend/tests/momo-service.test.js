import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { verifyMomoIpnSignature } from "../services/momo.service.js";

test("verifies MoMo IPN signatures and rejects altered callback data", () => {
  const payload = {
    accessKey: "test-access",
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
  const rawSignature = [
    "accessKey",
    "amount",
    "extraData",
    "message",
    "orderId",
    "orderInfo",
    "orderType",
    "partnerCode",
    "payType",
    "requestId",
    "responseTime",
    "resultCode",
    "transId",
  ]
    .map((field) => `${field}=${payload[field] ?? ""}`)
    .join("&");
  payload.signature = crypto
    .createHmac("sha256", "test-secret")
    .update(rawSignature)
    .digest("hex");

  assert.equal(verifyMomoIpnSignature(payload, "test-secret"), true);
  assert.equal(verifyMomoIpnSignature({ ...payload, amount: 1 }, "test-secret"), false);
  assert.equal(verifyMomoIpnSignature({ signature: "not-hex" }, "test-secret"), false);
});