import express from "express";
import { summary,topProducts,revenueChart } from "../controllers/dashboard.controller.js";
const router = express.Router();
// Mounted after persisted-user authorization in admin.routes.js.
router.get("/summary",summary);
router.get("/top-products",topProducts);
router.get("/revenue-chart",revenueChart);
export default router;
