import express from "express";
import {
  cancelOrder,
  createOrder,
  getMyOrders,
  getAllOrders,
  getFilteredOrders,
  getOrderHistory,
  updateOrderStatus,
} from "../controllers/order.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/authorize.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  createOrderValidation,
  orderFilterValidation,
  orderIdValidation,
  orderStatusValidation,
} from "../validators/order.validator.js";

const router = express.Router();

// POST /api/orders/create - Tạo đơn
router.post(
  "/create",
  verifyToken,
  authorizeRoles("user"),
  createOrderValidation,
  validate,
  createOrder,
);
// GET /api/orders/my-orders - Xem lịch sử đơn hàng
router.get(
  "/my-orders",
  verifyToken,
  authorizeRoles("user"),
  getMyOrders,
);
router.put(
  "/:id/cancel",
  verifyToken,
  authorizeRoles("user"),
  orderIdValidation,
  validate,
  cancelOrder,
);
// GET /api/orders/all - Lấy tất cả đơn hàng (admin)
router.get("/all", verifyToken, authorizeRoles("admin", "staff"), getAllOrders);
router.get(
  "/admin/filter",
  verifyToken,
  authorizeRoles("admin", "staff"),
  orderFilterValidation,
  validate,
  getFilteredOrders,
);
router.get(
  "/:id/history",
  verifyToken,
  orderIdValidation,
  validate,
  getOrderHistory,
);
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
