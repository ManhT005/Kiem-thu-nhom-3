import express from "express";
import {
  getCart,
  addToCart,
  updateCart,
  removeFromCart,
} from "../controllers/cart.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  addCartValidation,
  removeCartValidation,
  updateCartValidation,
} from "../validators/cart.validator.js";

const router = express.Router();

router.get("/", verifyToken, getCart);
router.post("/add", verifyToken, addCartValidation, validate, addToCart);
router.put("/update", verifyToken, updateCartValidation, validate, updateCart);
// Thay đổi route xóa để nhận maSize qua body
router.post(
  "/remove",
  verifyToken,
  removeCartValidation,
  validate,
  removeFromCart,
);

export default router;
