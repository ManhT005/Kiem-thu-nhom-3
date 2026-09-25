import express from "express";
import {
  getAllUsers,
  deleteUser,
  updateUserRole,
  getProfile,
  updateProfile,
  addAddress,
  deleteAddress,
  setDefaultAddress, // <--- 1. BẠN CẦN THÊM CÁI NÀY VÀO IMPORT
} from "../controllers/user.controller.js";
import { verifyToken, verifyAdmin } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  addressValidation,
  idParamValidation,
  profileValidation,
  roleValidation,
} from "../validators/user.validator.js";

const router = express.Router();

// --- USER ROUTES ---
router.get("/profile", verifyToken, getProfile);
router.put("/profile", verifyToken, profileValidation, validate, updateProfile);
router.post("/address", verifyToken, addressValidation, validate, addAddress);
router.delete(
  "/address/:id",
  verifyToken,
  idParamValidation,
  validate,
  deleteAddress,
);

// <--- 2. THÊM DÒNG NÀY VÀO ĐÂY (Đã sửa lại tên biến cho đúng)
router.put(
  "/address/:id/default",
  verifyToken,
  idParamValidation,
  validate,
  setDefaultAddress,
);

// --- ADMIN ROUTES (Giữ nguyên) ---
router.get("/", verifyToken, verifyAdmin, getAllUsers);
router.delete(
  "/:id",
  verifyToken,
  verifyAdmin,
  idParamValidation,
  validate,
  deleteUser,
);
router.put(
  "/:id/role",
  verifyToken,
  verifyAdmin,
  idParamValidation,
  roleValidation,
  validate,
  updateUserRole,
);

export default router;
