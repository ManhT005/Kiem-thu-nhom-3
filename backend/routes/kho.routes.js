import express from "express";
import { getKho, updateKho } from "../controllers/kho.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/authorize.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { inventoryValidation } from "../validators/inventory.validator.js";

const router = express.Router();

router.get("/", verifyToken, authorizeRoles("admin", "staff"), getKho);
router.put(
  "/:maSP",
  verifyToken,
  authorizeRoles("admin", "staff"),
  inventoryValidation,
  validate,
  updateKho,
);

export default router;
