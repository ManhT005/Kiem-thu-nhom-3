import crypto from "node:crypto";

const partnerCode = process.env.MOMO_PARTNER_CODE || "MOMO";
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

export const validateMomoPayUrl = (value) => {
  let url;
  try { url = new URL(value); } catch { throw new Error("Invalid MoMo payment URL"); }
  if (url.protocol !== "https:" || url.username || url.password ||
      url.port || !["test-payment.momo.vn", "payment.momo.vn"].includes(url.hostname)) {
    throw new Error("Invalid MoMo payment URL");
  }
  return url.href;
};

const getPaymentUrls = (redirectQuery) => {
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
  if (
    process.env.NODE_ENV === "production" &&
    (new URL(appBaseUrl).protocol !== "https:" ||
      new URL(publicApiUrl).protocol !== "https:")
  ) {
    throw new Error("MoMo redirect and IPN URLs must use HTTPS in production");
  }

  return {
    redirectUrl: `${appBaseUrl}/order-success${
      redirectQuery ? `?${redirectQuery}` : ""
    }`,
    ipnUrl: `${publicApiUrl}/api/payments/momo/ipn`,
  };
};

export const createMomoPaymentLink = async ({
  amount,
  orderId,
  requestId,
  redirectQuery,
}) => {
  const { accessKey, secretKey } = getMomoCredentials();
  if (!Number.isSafeInteger(amount) || amount < 1000 || amount > 50_000_000) {
    throw new Error("MoMo amount must be an integer from 1000 to 50000000 VND");
  }
  if (!orderId || !requestId) {
    throw new Error("MoMo orderId and requestId are required");
  }
  const { redirectUrl, ipnUrl } = getPaymentUrls(redirectQuery);
  const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(rawSignature)
    .digest("hex");

  const response = await fetch(
    "https://test-payment.momo.vn/v2/gateway/api/create",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
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
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`MoMo gateway returned invalid JSON (HTTP ${response.status})`);
  }
  if (!response.ok) {
    throw new Error(`MoMo gateway request failed with HTTP ${response.status}`);
  }
  return payload;
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
  credentials,
) => {
  if (
    !payload ||
    typeof payload.signature !== "string" ||
    !/^[a-f\d]{64}$/i.test(payload.signature)
  ) {
    return false;
  }

  const configuredCredentials = credentials ?? getMomoCredentials();
  const rawSignature = buildMomoIpnSignatureString(
    payload,
    configuredCredentials.accessKey,
  );
  const expected = crypto
    .createHmac("sha256", configuredCredentials.secretKey)
    .update(rawSignature)
    .digest();
  const received = Buffer.from(payload.signature, "hex");
  return (
    received.length === expected.length &&
    crypto.timingSafeEqual(received, expected)
  );
};
