import { AppError } from "../utils/app-error.js";
import { withTransaction } from "../utils/transaction.js";
import { orderRepository } from "../repositories/order.repository.js";
import {
  isOrderStatus,
  isOrderTransitionAllowed,
  ORDER_STATUS,
} from "../domain/order-status.js";

const prepareItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError(400, "ORDER_INVALID_ITEM", "Order must include items");
  }

  const normalized = items.map((item) => ({
    maSP: Number(item.maSP),
    maSize: Number(item.maSize),
    soLuongMua: Number(item.soLuongMua),
  }));

  if (
    normalized.some(
      (item) =>
        !Number.isSafeInteger(item.maSP) ||
        item.maSP < 1 ||
        !Number.isSafeInteger(item.maSize) ||
        item.maSize < 1 ||
        !Number.isSafeInteger(item.soLuongMua) ||
        item.soLuongMua < 1,
    )
  ) {
    throw new AppError(400, "ORDER_INVALID_ITEM", "Order contains an invalid item");
  }

  const keys = normalized.map((item) => `${item.maSP}:${item.maSize}`);
  if (new Set(keys).size !== keys.length) {
    throw new AppError(
      400,
      "ORDER_DUPLICATE_ITEM",
      "An order cannot contain the same product and size more than once",
    );
  }

  return normalized.sort((left, right) =>
    left.maSP - right.maSP || left.maSize - right.maSize,
  );
};

export const createOrder = async (
  input,
  { transaction = withTransaction, repository = orderRepository } = {},
) => {
  const items = prepareItems(input.items);
  const paymentMethodId = Number(input.maPTTT);

  if (!Number.isSafeInteger(paymentMethodId) || paymentMethodId < 1) {
    throw new AppError(400, "VALIDATION_ERROR", "maPTTT must be a positive integer");
  }

  return transaction(async (connection) => {
    const paymentMethod = await repository.findPaymentMethod(
      connection,
      paymentMethodId,
    );
    if (!paymentMethod) {
      throw new AppError(404, "PAYMENT_METHOD_NOT_FOUND", "Payment method not found");
    }

    const pricedItems = [];
    for (const item of items) {
      const variant = await repository.lockVariant(
        connection,
        item.maSP,
        item.maSize,
      );
      if (!variant) {
        throw new AppError(
          404,
          "ORDER_VARIANT_NOT_FOUND",
          "Product variant not found",
        );
      }
      if (Number(variant.soLuongTon) < item.soLuongMua) {
        throw new AppError(409, "INSUFFICIENT_STOCK", "Insufficient stock");
      }

      pricedItems.push({ ...item, giaMua: Number(variant.gia) });
    }

    const total = pricedItems.reduce(
      (sum, item) => sum + item.giaMua * item.soLuongMua,
      0,
    );
    if (!Number.isSafeInteger(total) || total < 0) {
      throw new AppError(
        422,
        "ORDER_TOTAL_CALCULATION_FAILED",
        "Unable to calculate order total",
      );
    }

    const status = ORDER_STATUS.PENDING;
    const orderId = await repository.insertOrder(connection, {
      userId: input.userId,
      tenNguoiNhan: input.tenNguoiNhan,
      sdt: input.sdt,
      diaChiGiaoHang: input.diaChiGiaoHang,
      ghiChu: input.ghiChu || null,
      tongTien: total,
      maPTTT: paymentMethodId,
      trangThai: status,
    });

    for (const item of pricedItems) {
      await repository.insertOrderItem(connection, orderId, item);
      const affectedRows = await repository.reduceStock(connection, item);
      if (affectedRows !== 1) {
        throw new AppError(409, "STOCK_UPDATE_FAILED", "Unable to reserve stock");
      }
    }

    const cartId = await repository.lockCart(connection, input.userId);
    if (cartId) {
      for (const item of pricedItems) {
        await repository.removeCartItem(connection, cartId, item);
      }
    }

    await repository.insertHistory(connection, {
      orderId,
      previousStatus: null,
      newStatus: status,
      actorId: input.userId,
      reason: "ORDER_CREATED",
    });

    return { maDonHang: orderId, tongTien: total, trangThai: status };
  });
};

const restoreOrderStock = async (connection, orderId, repository) => {
  const items = await repository.getOrderItems(connection, orderId);
  for (const item of items) {
    const affectedRows = await repository.restoreStock(connection, item);
    if (affectedRows !== 1) {
      throw new AppError(409, "STOCK_RESTORE_FAILED", "Unable to restore stock");
    }
  }
};

const transitionOrder = async (
  { orderId, targetStatus, actorId, reason, ownOrderOnly = false },
  { transaction = withTransaction, repository = orderRepository } = {},
) => {
  const normalizedOrderId = Number(orderId);
  if (!Number.isSafeInteger(normalizedOrderId) || normalizedOrderId < 1) {
    throw new AppError(400, "VALIDATION_ERROR", "Order id must be a positive integer");
  }
  if (!isOrderStatus(targetStatus)) {
    throw new AppError(400, "INVALID_ORDER_STATUS", "Unknown order status");
  }

  return transaction(async (connection) => {
    const order = await repository.lockOrder(connection, normalizedOrderId);
    if (!order) {
      throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
    }
    if (ownOrderOnly && Number(order.id) !== Number(actorId)) {
      throw new AppError(403, "ORDER_ACCESS_DENIED", "Order does not belong to this user");
    }
    if (order.trangThai === ORDER_STATUS.CANCELLED) {
      throw new AppError(409, "ORDER_ALREADY_CANCELLED", "Order is already cancelled");
    }
    if (ownOrderOnly && order.trangThai !== ORDER_STATUS.PENDING) {
      throw new AppError(
        409,
        "ORDER_CANCEL_NOT_ALLOWED",
        "Only pending orders can be cancelled by their owner",
      );
    }
    if (order.trangThai === targetStatus) {
      throw new AppError(409, "ORDER_STATUS_UNCHANGED", "Order status is unchanged");
    }
    if (!isOrderTransitionAllowed(order.trangThai, targetStatus)) {
      throw new AppError(
        409,
        "INVALID_ORDER_TRANSITION",
        "Order status transition is not allowed",
      );
    }

    if (targetStatus === ORDER_STATUS.CANCELLED) {
      await restoreOrderStock(connection, normalizedOrderId, repository);
    }

    const affectedRows = await repository.updateOrderStatus(
      connection,
      normalizedOrderId,
      targetStatus,
    );
    if (affectedRows !== 1) {
      throw new AppError(409, "ORDER_STATUS_UPDATE_FAILED", "Unable to update order status");
    }

    await repository.insertHistory(connection, {
      orderId: normalizedOrderId,
      previousStatus: order.trangThai,
      newStatus: targetStatus,
      actorId,
      reason: reason || null,
    });

    return { maDonHang: normalizedOrderId, trangThai: targetStatus };
  });
};

export const cancelOrder = (input, dependencies) =>
  transitionOrder(
    { ...input, targetStatus: ORDER_STATUS.CANCELLED, ownOrderOnly: true },
    dependencies,
  );

export const updateOrderStatus = (input, dependencies) =>
  transitionOrder(input, dependencies);