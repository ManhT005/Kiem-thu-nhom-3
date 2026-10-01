import express from "express";
import {
  cancelOrder,
  createOrder,
  getMyOrders,
  getAllOrders,
  updateOrderStatus,
} from "../controllers/order.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/authorize.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  createOrderValidation,
  orderIdValidation,
  orderStatusValidation,
} from "../validators/order.validator.js";

const router = express.Router();

// POST /api/orders/create - Tạo đơn
router.post(
  "/create",
  verifyToken,
  createOrderValidation,
  validate,
  createOrder,
);
// GET /api/orders/my-orders - Xem lịch sử đơn hàng
router.get("/my-orders", verifyToken, getMyOrders);
router.put("/:id/cancel", verifyToken, orderIdValidation, validate, cancelOrder);
// GET /api/orders/all - Lấy tất cả đơn hàng (admin)
router.get("/all", verifyToken, authorizeRoles("admin", "staff"), getAllOrders);
// PUT /api/orders/:orderId/status - Cập nhật trạng thái đơn hàng (admin)
router.put(
  "/:id/status",
  verifyToken,
  authorizeRoles("admin", "staff"),
  orderIdValidation,
  orderStatusValidation,
  validate,
  updateOrderStatus,
);
export default router;
