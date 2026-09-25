import "dotenv/config";
import express from "express";
import path from "path";
import authRoutes from "./routes/auth.routes.js";
import productRoutes from "./routes/product.routes.js";
import userRoutes from "./routes/user.routes.js";
import khoRoutes from "./routes/kho.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import orderRoutes from "./routes/order.routes.js";
import cors from "cors";
import axios from "axios"; //phần momo
import crypto from "crypto"; // phần momo
import { CORS_ORIGIN } from "./config/config.js";
import { success } from "./utils/api-response.js";
import { notFound } from "./middleware/not-found.middleware.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { responseContract } from "./middleware/response-contract.middleware.js";
const app = express();

app.use(
  cors({
    origin: CORS_ORIGIN.split(",").map((origin) => origin.trim()),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json());
app.use(responseContract);

const __dirname = path.resolve();

// ------------------ API ROUTES -----------------
app.get("/api/health", (_req, res) => success(res, { data: { status: "UP" } }));
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/users", userRoutes);
app.use("/api/kho", khoRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
// ------------------ STATIC FRONTEND ------------------
app.use("/Asset", express.static(path.join(__dirname, "../frontend/Asset")));
app.use(express.static(path.join(__dirname, "../frontend")));

app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "../frontend/html/index.html")),
);

app.get("/login", (req, res) =>
  res.sendFile(path.join(__dirname, "../frontend/html/login.html")),
);

app.get("/register", (req, res) =>
  res.sendFile(path.join(__dirname, "../frontend/html/register.html")),
);

// Serve uploads
app.use("/uploads", express.static(path.join(__dirname, "../frontend/Asset")));

// --- CẤU HÌNH MOMO SANDBOX (DÙNG CHUNG CHO TEST) ---
const config = {
  accessKey: "F8BBA842ECF85", // Key test công khai của MoMo
  secretKey: "K951B6PE1waDMi640xX08PD3vg6EkVlz", // Key test công khai
  partnerCode: "MOMO",
  redirectUrl: "http://127.0.0.1:5500/html/orderSuccess.html", // Quay về trang thông báo thành công
  ipnUrl: "http://127.0.0.1:5500/html/orderSuccess.html", // (Lưu ý: Localhost không nhận được IPN thật, đây chỉ là demo)
  requestType: "payWithATM",
  extraData: "",
  orderInfo: "Thanh toán đơn hàng quần áo",
  autoCapture: true,
  lang: "vi",
};

// API TẠO LINK THANH TOÁN MOMO
app.post("/api/create-payment-momo", async (req, res, next) => {
  const { amount } = req.body; // Lấy tổng tiền từ Frontend gửi lên

  // Tạo mã đơn hàng ngẫu nhiên để không bị trùng
  const orderId = "MOMO" + new Date().getTime();
  const requestId = orderId;

  // Tạo chữ ký bảo mật (Signature) theo yêu cầu của MoMo
  const rawSignature = `accessKey=${config.accessKey}&amount=${amount}&extraData=${config.extraData}&ipnUrl=${config.ipnUrl}&orderId=${orderId}&orderInfo=${config.orderInfo}&partnerCode=${config.partnerCode}&redirectUrl=${config.redirectUrl}&requestId=${requestId}&requestType=${config.requestType}`;

  const signature = crypto
    .createHmac("sha256", config.secretKey)
    .update(rawSignature)
    .digest("hex");

  // Tạo body gửi sang MoMo
  const requestBody = {
    partnerCode: config.partnerCode,
    partnerName: "Test MoMo",
    storeId: "MomoTestStore",
    requestId: requestId,
    amount: amount,
    orderId: orderId,
    orderInfo: config.orderInfo,
    redirectUrl: config.redirectUrl,
    ipnUrl: config.ipnUrl,
    lang: config.lang,
    requestType: config.requestType,
    autoCapture: config.autoCapture,
    extraData: config.extraData,
    signature: signature,
  };

  try {
    // Gọi API của MoMo
    const response = await axios.post(
      "https://test-payment.momo.vn/v2/gateway/api/create",
      requestBody,
    );

    // Trả về link thanh toán (payUrl) cho Frontend
    res.status(200).json(response.data);
  } catch (error) {
    console.error("Lỗi thanh toán MoMo:", error);
    next(error);
  }
});

app.use("/api", notFound);
app.use(errorHandler);

export default app;

// ------------------ START SERVER ------------------
if (process.env.NODE_ENV !== "test") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Frontend: http://localhost:${PORT}`);
    console.log(`API:      http://localhost:${PORT}/api/products`);
  });
}

// tắt bằng terminal:  taskkill /F /IM node.exe
