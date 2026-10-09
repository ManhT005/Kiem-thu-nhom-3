import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "node:url";
import authRoutes from "./routes/auth.routes.js";
import productRoutes from "./routes/product.routes.js";
import userRoutes from "./routes/user.routes.js";
import khoRoutes from "./routes/kho.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import orderRoutes from "./routes/order.routes.js";
import cors from "cors";
import { CORS_ORIGIN } from "./config/config.js";
import { success } from "./utils/api-response.js";
import { notFound } from "./middleware/not-found.middleware.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { responseContract } from "./middleware/response-contract.middleware.js";
import { createPageRouter } from "./routes/page.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import { createMomoPayment } from "./controllers/payment.controller.js";
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, "../frontend");

// ------------------ API ROUTES -----------------
app.get("/api/health", (_req, res) => success(res, { data: { status: "UP" } }));
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/users", userRoutes);
app.use("/api/kho", khoRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.post("/api/create-payment-momo", createMomoPayment);
app.use("/api", notFound);

// ------------------ STATIC FRONTEND ------------------
app.use("/css", express.static(path.join(frontendRoot, "css")));
app.use("/js", express.static(path.join(frontendRoot, "js")));
app.use("/Asset", express.static(path.join(frontendRoot, "Asset")));

// Serve uploads
app.use("/uploads", express.static(path.join(frontendRoot, "Asset")));

app.use(createPageRouter(frontendRoot));
app.use((req, res) =>
  res.status(404).sendFile(path.join(frontendRoot, "html", "404.html")),
);
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
