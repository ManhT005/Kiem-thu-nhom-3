import axios from "axios";
import crypto from "node:crypto";

const partnerCode = "MOMO";
const requestType = "payWithATM";
const extraData = "";
const orderInfo = "Thanh toán đơn hàng quần áo";
const ipnSignatureFields = [
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

const getMomoCredentials = () => {
  const { MOMO_ACCESS_KEY: accessKey, MOMO_SECRET_KEY: secretKey } =
    process.env;
  if (!accessKey || !secretKey) {
    throw new Error("MOMO_ACCESS_KEY and MOMO_SECRET_KEY are required");
  }
  return { accessKey, secretKey };
};

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
  const { accessKey, secretKey } = getMomoCredentials();
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

export const buildMomoIpnSignatureString = (payload, accessKey) => {
  if (!accessKey) throw new Error("MOMO_ACCESS_KEY is required");
  return ipnSignatureFields
    .map((field) =>
      field === "accessKey"
        ? `accessKey=${accessKey}`
        : `${field}=${payload[field] ?? ""}`,
    )
    .join("&");
};

export const verifyMomoIpnSignature = (
  payload,
  credentials = getMomoCredentials(),
) => {
  if (
    !payload ||
    typeof payload.signature !== "string" ||
    !/^[a-f\d]{64}$/i.test(payload.signature)
  ) {
    return false;
  }

  const rawSignature = buildMomoIpnSignatureString(
    payload,
    credentials.accessKey,
  );
  const expected = crypto
    .createHmac("sha256", credentials.secretKey)
    .update(rawSignature)
    .digest();
  const received = Buffer.from(payload.signature, "hex");
  return (
    received.length === expected.length &&
    crypto.timingSafeEqual(received, expected)
  );
};