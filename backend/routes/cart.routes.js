import express from "express";
import {
  getCart,
  addToCart,
  updateCart,
  removeFromCart,
} from "../controllers/cart.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { authorizeRoles } from "../middleware/authorize.middleware.js";
import {
  addCartValidation,
  removeCartValidation,
  updateCartValidation,
} from "../validators/cart.validator.js";

const router = express.Router();
router.use(verifyToken, authorizeRoles("user"));

router.get("/", getCart);
router.post("/add", addCartValidation, validate, addToCart);
router.put("/update", updateCartValidation, validate, updateCart);
// Thay đổi route xóa để nhận maSize qua body
router.post(
  "/remove",
  removeCartValidation,
  validate,
  removeFromCart,
);

export default router;
