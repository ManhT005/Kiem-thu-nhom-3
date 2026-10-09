import express from "express";
import {
	createMomoPayment,
	handleMomoIpn,
} from "../controllers/payment.controller.js";

const router = express.Router();

router.post("/momo/create", createMomoPayment);
router.post("/momo/ipn", handleMomoIpn);

export default router;