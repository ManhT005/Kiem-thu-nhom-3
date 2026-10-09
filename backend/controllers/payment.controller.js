import {
  createMomoPaymentForOrder,
  getMomoPaymentStatus,
  processMomoIpn,
} from "../services/payment.service.js";
import { verifyMomoIpnSignature } from "../services/momo.service.js";
import { success } from "../utils/api-response.js";

export const createMomoPayment = async (req, res, next) => {
  try {
    const payment = await createMomoPaymentForOrder({
      orderId: req.body.orderId,
      userId: req.user.id,
    });
    return success(res, {
      code: "MOMO_PAYMENT_CREATED",
      message: "MoMo payment link created",
      data: payment,
    });
  } catch (error) {
    return next(error);
  }
};

export const getMomoPaymentStatusForOrder = async (req, res, next) => {
  try {
    const payment = await getMomoPaymentStatus({
      orderId: req.params.orderId,
      userId: req.user.id,
    });
    return success(res, {
      code: "MOMO_PAYMENT_STATUS_FETCHED",
      message: "MoMo payment status fetched",
      data: payment,
    });
  } catch (error) {
    return next(error);
  }
};

export const handleMomoIpn = async (req, res, next) => {
  try {
    if (!verifyMomoIpnSignature(req.body)) {
      return res.status(400).json({ message: "Invalid MoMo IPN signature" });
    }
    await processMomoIpn(req.body);
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
};