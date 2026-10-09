import {
  cancelOrder as cancelOrderService,
  createOrder as createOrderService,
  getAllOrders as getAllOrdersService,
  getFilteredOrders as getFilteredOrdersService,
  getMyOrders as getMyOrdersService,
  getOrderHistory as getOrderHistoryService,
  updateOrderStatus as updateOrderStatusService,
} from "../services/order.service.js";
import { success } from "../utils/api-response.js";

export const createOrder = async (req, res, next) => {
  try {
    const order = await createOrderService({
      ...req.body,
      userId: req.user.id,
    });
    return success(res, {
      status: 201,
      code: "ORDER_CREATED",
      message: "Order created successfully",
      data: order,
    });
  } catch (error) {
    return next(error);
  }
};

export const getMyOrders = async (req, res, next) => {
  try {
    const orders = await getMyOrdersService(req.user.id);
    return success(res, {
      code: "MY_ORDERS_FETCHED",
      message: "Orders fetched successfully",
      data: orders,
    });
  } catch (error) {
    return next(error);
  }
};

export const getAllOrders = async (_req, res, next) => {
  try {
    const orders = await getAllOrdersService();
    return success(res, {
      code: "ORDER_LIST_SUCCESS",
      message: "Orders fetched successfully",
      data: orders,
    });
  } catch (error) {
    return next(error);
  }
};

export const getFilteredOrders = async (req, res, next) => {
  try {
    const result = await getFilteredOrdersService(req.query);
    return success(res, {
      code: "ORDER_LIST_SUCCESS",
      message: "Orders fetched successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

export const getOrderHistory = async (req, res, next) => {
  try {
    const history = await getOrderHistoryService({
      orderId: req.params.id,
      actorId: req.user.id,
      role: req.user.role,
    });
    return success(res, {
      code: "ORDER_HISTORY_FETCHED",
      message: "Order history fetched successfully",
      data: history,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateOrderStatus = async (req, res, next) => {
  try {
    const order = await updateOrderStatusService({
      orderId: req.params.id,
      targetStatus: req.body.trangThai,
      actorId: req.user.id,
      reason: req.body.lyDo,
    });
    return success(res, {
      code: "ORDER_STATUS_UPDATED",
      message: "Order status updated successfully",
      data: order,
    });
  } catch (error) {
    return next(error);
  }
};

export const cancelOrder = async (req, res, next) => {
  try {
    const order = await cancelOrderService({
      orderId: req.params.id,
      actorId: req.user.id,
      reason: req.body?.lyDo,
    });
    return success(res, {
      code: "ORDER_CANCELLED",
      message: "Order cancelled successfully",
      data: order,
    });
  } catch (error) {
    return next(error);
  }
};
