export const ORDER_STATUS = Object.freeze({
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  SHIPPING: "Đang giao",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
});

export const ORDER_STATUS_VALUES = Object.freeze(Object.values(ORDER_STATUS));

export const ORDER_TRANSITIONS = Object.freeze({
  [ORDER_STATUS.PENDING]: Object.freeze([
    ORDER_STATUS.CONFIRMED,
    ORDER_STATUS.CANCELLED,
  ]),
  [ORDER_STATUS.CONFIRMED]: Object.freeze([
    ORDER_STATUS.SHIPPING,
    ORDER_STATUS.CANCELLED,
  ]),
  [ORDER_STATUS.SHIPPING]: Object.freeze([ORDER_STATUS.COMPLETED]),
  [ORDER_STATUS.COMPLETED]: Object.freeze([]),
  [ORDER_STATUS.CANCELLED]: Object.freeze([]),
});

export const isOrderStatus = (status) => ORDER_STATUS_VALUES.includes(status);

export const isOrderTransitionAllowed = (from, to) =>
  ORDER_TRANSITIONS[from]?.includes(to) ?? false;