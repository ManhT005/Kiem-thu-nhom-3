import express from "express";
import {
	createMomoPayment,
	getMomoPaymentStatusForOrder,
	handleMomoIpn,
} from "../controllers/payment.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/authorize.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { body, param } from "express-validator";

const router = express.Router();

router.post(
  "/momo/create",
  verifyToken,
  authorizeRoles("user"),
  body("orderId").isInt({ min: 1 }),
  validate,
  createMomoPayment,
);
router.get(
  "/momo/orders/:orderId/status",
  verifyToken,
  authorizeRoles("user"),
  param("orderId").isInt({ min: 1 }),
  validate,
  getMomoPaymentStatusForOrder,
);
router.post("/momo/ipn", handleMomoIpn);

export default router;