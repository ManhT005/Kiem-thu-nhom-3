import {
  createMomoPaymentLink,
  verifyMomoIpnSignature,
} from "../services/momo.service.js";

export const createMomoPayment = async (req, res, next) => {
  try {
    const { amount } = req.body;
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      return res
        .status(400)
        .json({ message: "A positive payment amount is required" });
    }

    const payment = await createMomoPaymentLink(Number(amount));
    return res.status(200).json(payment);
  } catch (error) {
    console.error("MoMo payment creation failed:", error);
    return next(error);
  }
};

export const handleMomoIpn = (req, res) => {
  if (!verifyMomoIpnSignature(req.body)) {
    return res.status(400).json({ message: "Invalid MoMo IPN signature" });
  }

  return res.status(204).end();
};