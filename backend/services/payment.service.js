import crypto from "node:crypto";
import db from "../config/db.js";
import { ORDER_STATUS } from "../domain/order-status.js";
import { orderRepository } from "../repositories/order.repository.js";
import { paymentRepository } from "../repositories/payment.repository.js";
import { createMomoPaymentLink } from "./momo.service.js";
import { withTransaction } from "../utils/transaction.js";
import { AppError } from "../utils/app-error.js";

const MIN_MOMO_AMOUNT = 1000;
const MAX_MOMO_AMOUNT = 50_000_000;

const normalizeOrderId = (orderId) => {
  const normalized = Number(orderId);
  if (!Number.isSafeInteger(normalized) || normalized < 1) {
    throw new AppError(400, "VALIDATION_ERROR", "Order id must be positive");
  }
  return normalized;
};

const assertMomoOrderCanBePaid = (order) => {
  if (order.tenPTTT !== "MOMO") {
    throw new AppError(409, "INVALID_PAYMENT_METHOD", "Order is not a MoMo order");
  }
  if (order.trangThai === ORDER_STATUS.CANCELLED) {
    throw new AppError(409, "ORDER_CANCELLED", "Cancelled orders cannot be paid");
  }
  if (order.payment_status !== "PENDING") {
    throw new AppError(409, "PAYMENT_NOT_PENDING", "Order is not awaiting payment");
  }
  const amount = Number(order.tongTien);
  if (
    !Number.isSafeInteger(amount) ||
    amount < MIN_MOMO_AMOUNT ||
    amount > MAX_MOMO_AMOUNT
  ) {
    throw new AppError(400, "INVALID_PAYMENT_AMOUNT", "Order amount is outside MoMo limits");
  }
};

const markOrderCancelled = async (
  connection,
  order,
  reason,
  repository,
) => {
  if (order.trangThai === ORDER_STATUS.CANCELLED) return;
  const items = await repository.getOrderItems(connection, order.maDonHang);
  for (const item of items) {
    const affectedRows = await repository.restoreStock(connection, item);
    if (affectedRows !== 1) {
      throw new AppError(409, "STOCK_RESTORE_FAILED", "Unable to restore stock");
    }
  }
  const affectedRows = await repository.updateOrderStatus(
    connection,
    order.maDonHang,
    ORDER_STATUS.CANCELLED,
  );
  if (affectedRows !== 1) {
    throw new AppError(409, "ORDER_STATUS_UPDATE_FAILED", "Unable to cancel order");
  }
  await repository.insertHistory(connection, {
    orderId: order.maDonHang,
    previousStatus: order.trangThai,
    newStatus: ORDER_STATUS.CANCELLED,
    actorId: null,
    reason,
  });
};

export const createMomoPaymentForOrder = async (
  { orderId, userId },
  {
    transaction = withTransaction,
    repository = paymentRepository,
    makePaymentLink = createMomoPaymentLink,
    executor = db.promise(),
    now = () => new Date(),
  } = {},
) => {
  const normalizedOrderId = normalizeOrderId(orderId);
  const payment = await transaction(async (connection) => {
    const order = await repository.lockOrder(connection, normalizedOrderId);
    if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
    if (Number(order.id) !== Number(userId)) {
      throw new AppError(403, "ORDER_ACCESS_DENIED", "Order does not belong to this user");
    }
    assertMomoOrderCanBePaid(order);
    if (
      !order.payment_expires_at ||
      new Date(order.payment_expires_at).getTime() <= now().getTime()
    ) {
      throw new AppError(409, "PAYMENT_EXPIRED", "Payment window has expired");
    }

    let record = await repository.findOrderTransaction(
      connection,
      normalizedOrderId,
    );
    if (record && record.status !== "PENDING") {
      throw new AppError(409, "PAYMENT_NOT_PENDING", "Payment attempt is no longer active");
    }
    if (!record) {
      const providerOrderId = `MOMO-${normalizedOrderId}-${crypto
        .randomUUID()
        .replaceAll("-", "")}`;
      const requestId = `MOMO-${crypto.randomUUID()}`;
      const transactionId = await repository.insertTransaction(connection, {
        orderId: normalizedOrderId,
        providerOrderId,
        requestId,
        amount: Number(order.tongTien),
        expiresAt: order.payment_expires_at,
      });
      record = {
        id: transactionId,
        maDonHang: normalizedOrderId,
        provider_order_id: providerOrderId,
        request_id: requestId,
        amount: Number(order.tongTien),
        status: "PENDING",
        pay_url: null,
      };
    }
    if (Number(record.amount) !== Number(order.tongTien)) {
      throw new AppError(409, "PAYMENT_AMOUNT_MISMATCH", "Payment amount does not match order");
    }
    return {
      transactionId: record.id,
      orderId: normalizedOrderId,
      providerOrderId: record.provider_order_id,
      requestId: record.request_id,
      amount: Number(record.amount),
      payUrl: record.pay_url,
    };
  });

  if (payment.payUrl) {
    return { maDonHang: payment.orderId, payUrl: payment.payUrl };
  }

  const response = await makePaymentLink({
    amount: payment.amount,
    orderId: payment.providerOrderId,
    requestId: payment.requestId,
    redirectQuery: `maDonHang=${payment.orderId}`,
  });
  if (Number(response?.resultCode) !== 0 || typeof response?.payUrl !== "string") {
    throw new AppError(502, "MOMO_LINK_FAILED", "MoMo did not return a payment URL");
  }
  await repository.savePaymentUrl(executor, payment.transactionId, response.payUrl);
  return { maDonHang: payment.orderId, payUrl: response.payUrl };
};

export const processMomoIpn = async (
  payload,
  {
    transaction = withTransaction,
    repository = paymentRepository,
    orders = orderRepository,
    executor = db.promise(),
    partnerCode = process.env.MOMO_PARTNER_CODE || "MOMO",
    now = () => new Date(),
  } = {},
) => {
  const amount = Number(payload?.amount);
  const resultCode = Number(payload?.resultCode);
  if (
    payload?.amount === undefined ||
    payload.amount === null ||
    String(payload.amount).trim() === "" ||
    payload?.resultCode === undefined ||
    payload.resultCode === null ||
    String(payload.resultCode).trim() === "" ||
    !Number.isSafeInteger(amount) ||
    !Number.isSafeInteger(resultCode) ||
    typeof payload?.orderId !== "string" ||
    typeof payload?.requestId !== "string" ||
    typeof payload?.partnerCode !== "string" ||
    payload.partnerCode !== partnerCode
  ) {
    throw new AppError(400, "INVALID_MOMO_IPN", "MoMo IPN fields are invalid");
  }
  if (
    resultCode === 0 &&
    !/^[1-9]\d*$/.test(String(payload.transId ?? ""))
  ) {
    throw new AppError(400, "INVALID_MOMO_IPN", "Successful MoMo IPN requires transId");
  }

  const reference = await repository.findOrderIdByProviderOrderId(
    executor,
    payload.orderId,
  );
  if (!reference) {
    throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment transaction not found");
  }

  return transaction(async (connection) => {
    const order = await repository.lockOrder(connection, reference.maDonHang);
    const payment = await repository.lockTransaction(connection, reference.id);
    if (!order || !payment || Number(payment.maDonHang) !== Number(order.maDonHang)) {
      throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment transaction not found");
    }
    if (
      payment.provider_order_id !== payload.orderId ||
      payment.request_id !== payload.requestId ||
      Number(payment.amount) !== amount ||
      Number(order.tongTien) !== amount
    ) {
      throw new AppError(400, "MOMO_PAYMENT_MISMATCH", "MoMo IPN does not match the order");
    }

    if (
      payment.status === "PENDING" &&
      new Date(payment.expires_at).getTime() <= now().getTime()
    ) {
      await repository.updateTransaction(connection, payment.id, {
        status: "EXPIRED",
      });
      await repository.updateOrderPaymentStatus(
        connection,
        order.maDonHang,
        "EXPIRED",
      );
      if (order.trangThai === ORDER_STATUS.PENDING) {
        await markOrderCancelled(
          connection,
          order,
          "MOMO_PAYMENT_EXPIRED",
          orders,
        );
      }
      payment.status = "EXPIRED";
      order.payment_status = "EXPIRED";
      if (order.trangThai !== ORDER_STATUS.CANCELLED) {
        order.trangThai = ORDER_STATUS.CANCELLED;
      }
    }

    if (payment.status === "PAID") {
      if (resultCode !== 0 || String(payment.trans_id) !== String(payload.transId)) {
        throw new AppError(409, "MOMO_PAYMENT_CONFLICT", "Conflicting MoMo callback");
      }
      return { duplicate: true, paymentStatus: order.payment_status };
    }
    if (payment.status === "FAILED" || payment.status === "EXPIRED") {
      if (resultCode !== 0) return { duplicate: true, paymentStatus: order.payment_status };
      await repository.updateTransaction(connection, payment.id, {
        status: "PAID",
        transId: payload.transId,
      });
      await repository.updateOrderForRefund(connection, order.maDonHang);
      await orders.insertHistory(connection, {
        orderId: order.maDonHang,
        previousStatus: order.trangThai,
        newStatus: order.trangThai,
        actorId: null,
        reason: "LATE_MOMO_PAYMENT_REFUND_REQUIRED",
      });
      return { duplicate: false, paymentStatus: "REFUND_REQUIRED" };
    }

    if (resultCode === 0) {
      if (order.trangThai !== ORDER_STATUS.PENDING || order.payment_status !== "PENDING") {
        await repository.updateTransaction(connection, payment.id, {
          status: "PAID",
          transId: payload.transId,
        });
        await repository.updateOrderForRefund(connection, order.maDonHang);
        await orders.insertHistory(connection, {
          orderId: order.maDonHang,
          previousStatus: order.trangThai,
          newStatus: order.trangThai,
          actorId: null,
          reason: "LATE_MOMO_PAYMENT_REFUND_REQUIRED",
        });
        return { duplicate: false, paymentStatus: "REFUND_REQUIRED" };
      }
      await repository.updateTransaction(connection, payment.id, {
        status: "PAID",
        transId: payload.transId,
      });
      const affectedRows = await repository.confirmPaidOrder(
        connection,
        order.maDonHang,
      );
      if (affectedRows !== 1) {
        throw new AppError(409, "ORDER_PAYMENT_UPDATE_FAILED", "Unable to confirm paid order");
      }
      await orders.insertHistory(connection, {
        orderId: order.maDonHang,
        previousStatus: order.trangThai,
        newStatus: ORDER_STATUS.CONFIRMED,
        actorId: null,
        reason: "MOMO_PAYMENT_CONFIRMED",
      });
      return { duplicate: false, paymentStatus: "PAID" };
    }

    await repository.updateTransaction(connection, payment.id, {
      status: "FAILED",
    });
    await repository.updateOrderPaymentStatus(
      connection,
      order.maDonHang,
      "FAILED",
    );
    if (order.trangThai === ORDER_STATUS.PENDING) {
      await markOrderCancelled(
        connection,
        order,
        "MOMO_PAYMENT_FAILED",
        orders,
      );
    }
    return { duplicate: false, paymentStatus: "FAILED" };
  });
};

const expireTransaction = async (
  transactionId,
  orderId,
  { transaction, repository, orders, now },
) =>
  transaction(async (connection) => {
    const order = await repository.lockOrder(connection, orderId);
    const payment = transactionId
      ? await repository.lockTransaction(connection, transactionId)
      : null;
    if (
      !order ||
      (transactionId && (!payment || payment.status !== "PENDING")) ||
      order.payment_status !== "PENDING" ||
      !order.payment_expires_at ||
      new Date(order.payment_expires_at).getTime() > now().getTime()
    ) {
      return false;
    }
    if (payment) {
      await repository.updateTransaction(connection, payment.id, {
        status: "EXPIRED",
      });
    }
    await repository.updateOrderPaymentStatus(
      connection,
      order.maDonHang,
      "EXPIRED",
    );
    if (order.trangThai === ORDER_STATUS.PENDING) {
      await markOrderCancelled(
        connection,
        order,
        "MOMO_PAYMENT_EXPIRED",
        orders,
      );
    }
    return true;
  });

export const expirePendingMomoPayments = async (
  {
    transaction = withTransaction,
    repository = paymentRepository,
    orders = orderRepository,
    executor = db.promise(),
    now = () => new Date(),
  } = {},
) => {
  const expired = await repository.findExpiredTransactions(executor);
  let count = 0;
  for (const payment of expired) {
    if (
      await expireTransaction(payment.id, payment.maDonHang, {
        transaction,
        repository,
        orders,
        now,
      })
    ) {
      count += 1;
    }
  }
  return count;
};

export const getMomoPaymentStatus = async (
  { orderId, userId },
  {
    transaction = withTransaction,
    repository = paymentRepository,
    orders = orderRepository,
    executor = db.promise(),
  } = {},
) => {
  const normalizedOrderId = normalizeOrderId(orderId);
  const order = await repository.getOrderPaymentStatus(
    executor,
    normalizedOrderId,
  );
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
  if (Number(order.id) !== Number(userId)) {
    throw new AppError(403, "ORDER_ACCESS_DENIED", "Order does not belong to this user");
  }
  if (
    order.payment_status === "PENDING" &&
    order.payment_expires_at &&
    new Date(order.payment_expires_at).getTime() <= Date.now()
  ) {
    const candidate = await repository.findExpiredTransactionForOrder(
      executor,
      normalizedOrderId,
    );
    if (candidate) {
      await expireTransaction(candidate.id, normalizedOrderId, {
        transaction,
        repository,
        orders,
        now: () => new Date(),
      });
    }
  }
  const current = await repository.getOrderPaymentStatus(
    executor,
    normalizedOrderId,
  );
  return {
    maDonHang: current.maDonHang,
    trangThai: current.trangThai,
    paymentStatus: current.payment_status,
    expiresAt: current.payment_expires_at,
  };
};
