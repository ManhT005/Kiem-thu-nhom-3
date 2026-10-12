import express from "express";
import { verifyToken } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/authorize.middleware.js";
import { success } from "../utils/api-response.js";
import * as inventory from "../services/inventory-documents.service.js";

const router = express.Router();
router.use(verifyToken, authorizeRoles("admin", "staff"));
const endpoint = (work, status = 200) => async (req, res, next) => {
  try { return success(res, { status, data: await work(req) }); } catch (error) { return next(error); }
};
router.post("/receipts", endpoint((req) => inventory.createReceipt({ ...req.body, actorId: req.user.id }), 201));
router.get("/receipts", endpoint((req) => inventory.listReceipts(req.query)));
router.get("/receipts/:id", endpoint((req) => inventory.getReceipt(req.params.id)));
router.put("/receipts/:id", endpoint((req) => inventory.editReceipt(req.params.id, req.body)));
router.post("/receipts/:id/post", endpoint((req) => inventory.postReceipt(req.params.id, req.user.id)));
router.get("/movements", endpoint((req) => inventory.listMovements(req.query)));
router.get("/low-stock", endpoint((req) => inventory.lowStock(req.query)));
router.get("/reconciliation", authorizeRoles("admin"), endpoint((req) => inventory.reconciliation(req.query)));
router.post("/adjustments", authorizeRoles("admin"), endpoint((req) => inventory.createAdjustment({ ...req.body, actorId: req.user.id }), 201));
export default router;
