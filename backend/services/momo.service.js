import axios from "axios";
import crypto from "node:crypto";

const accessKey = process.env.MOMO_ACCESS_KEY || "F8BBA842ECF85";
const secretKey = process.env.MOMO_SECRET_KEY || "K951B6PE1waDMi640xX08PD3vg6EkVlz";
const partnerCode = "MOMO";
const requestType = "payWithATM";
const extraData = "";
const orderInfo = "Thanh toán đơn hàng quần áo";

const getPaymentUrls = () => {
  const appBaseUrl = process.env.APP_BASE_URL?.replace(/\/+$/, "");
  const publicApiUrl = (process.env.PUBLIC_API_URL || appBaseUrl)?.replace(
    /\/+$/,
    "",
  );
  if (!appBaseUrl || !publicApiUrl) {
    throw new Error(
      "APP_BASE_URL and PUBLIC_API_URL are required for MoMo payments",
    );
  }

  return {
    redirectUrl: `${appBaseUrl}/order-success`,
    ipnUrl: `${publicApiUrl}/api/payments/momo/ipn`,
  };
};

export const createMomoPaymentLink = async (amount) => {
  const { redirectUrl, ipnUrl } = getPaymentUrls();
  const orderId = `MOMO${Date.now()}`;
  const requestId = orderId;
  const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(rawSignature)
    .digest("hex");

  const response = await axios.post(
    "https://test-payment.momo.vn/v2/gateway/api/create",
    {
      partnerCode,
      partnerName: "Test MoMo",
      storeId: "MomoTestStore",
      requestId,
      amount,
      orderId,
      orderInfo,
      redirectUrl,
      ipnUrl,
      lang: "vi",
      requestType,
      autoCapture: true,
      extraData,
      signature,
    },
  );

  return response.data;
};

export const verifyMomoIpnSignature = (payload, key = secretKey) => {
  const fields = [
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
  ];
  if (!payload || typeof payload.signature !== "string") return false;

  const rawSignature = fields
    .map((field) => `${field}=${payload[field] ?? ""}`)
    .join("&");
  const expected = crypto.createHmac("sha256", key).update(rawSignature).digest();
  const received = Buffer.from(payload.signature, "hex");
  return (
    received.length === expected.length &&
    crypto.timingSafeEqual(received, expected)
  );
};