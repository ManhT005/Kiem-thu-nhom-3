import express from "express";
import multer from "multer";
import path from "path";
import {
  getProducts,
  getProductById,
  getProductCategories,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/product.controller.js";
import { verifyToken, verifyAdmin } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { productIdValidation } from "../validators/product.validator.js";

const router = express.Router();

// Cấu hình multer để upload ảnh
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), "../frontend/Asset"));
  },
  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9) +
      path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file ảnh (jpg, png, gif, webp)"));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// ================= PUBLIC ROUTES =================

// Lấy danh sách sản phẩm
router.get("/", getProducts);

// Lấy danh mục của sản phẩm (PHẢI ĐẶT TRƯỚC /:id)
router.get(
  "/:id/categories",
  productIdValidation,
  validate,
  getProductCategories,
);

// Lấy chi tiết 1 sản phẩm
router.get("/:id", productIdValidation, validate, getProductById);

// ================= ADMIN ROUTES =================

// Thêm sản phẩm
router.post(
  "/",
  verifyToken,
  verifyAdmin,
  upload.single("anhSP"),
  createProduct,
);

// Cập nhật sản phẩm
router.put(
  "/:id",
  verifyToken,
  verifyAdmin,
  productIdValidation,
  validate,
  upload.single("anhSP"),
  updateProduct,
);

// Xóa sản phẩm
router.delete(
  "/:id",
  verifyToken,
  verifyAdmin,
  productIdValidation,
  validate,
  deleteProduct,
);

export default router;
