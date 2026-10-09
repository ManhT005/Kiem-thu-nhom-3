import test from "node:test";
import assert from "node:assert/strict";
import {
  createMomoPaymentForOrder,
  expirePendingMomoPayments,
  processMomoIpn,
} from "../services/payment.service.js";
import { ORDER_STATUS } from "../domain/order-status.js";

const future = new Date(Date.now() + 15 * 60 * 1000);

const makePaymentState = ({ expiresAt = future } = {}) => ({
  order: {
    maDonHang: 42,
    id: 7,
    maPTTT: 3,
    tenPTTT: "MOMO",
    trangThai: ORDER_STATUS.PENDING,
    tongTien: 2500,
    payment_status: "PENDING",
    payment_expires_at: expiresAt,
  },
  payment: null,
  stock: 3,
  history: [],
});

const makeDependencies = (state) => {
  let nextId = 1;
  const paymentRepository = {
    async lockOrder() {
      return state.order;
    },
    async findOrderTransaction() {
      return state.payment;
    },
    async insertTransaction(_connection, payment) {
      state.payment = {
        maDonHang: payment.orderId,
        provider_order_id: payment.providerOrderId,
        request_id: payment.requestId,
        amount: payment.amount,
        id: nextId++,
        status: "PENDING",
        trans_id: null,
        pay_url: null,
        expires_at: payment.expiresAt,
      };
      return state.payment.id;
    },
    async savePaymentUrl(_executor, _id, payUrl) {
      state.payment.pay_url = payUrl;
    },
    async findOrderIdByProviderOrderId(_executor, providerOrderId) {
      return state.payment?.provider_order_id === providerOrderId
        ? { id: state.payment.id, maDonHang: state.order.maDonHang }
        : null;
    },
    async lockTransaction(_connection, id) {
      return state.payment?.id === id ? state.payment : null;
    },
    async updateTransaction(_connection, _id, { status, transId = null }) {
      state.payment.status = status;
      state.payment.trans_id = transId;
    },
    async updateOrderPaymentStatus(_connection, _orderId, status) {
      state.order.payment_status = status;
    },
    async confirmPaidOrder() {
      state.order.payment_status = "PAID";
      state.order.trangThai = ORDER_STATUS.CONFIRMED;
      return 1;
    },
    async updateOrderForRefund() {
      state.order.payment_status = "REFUND_REQUIRED";
    },
    async findExpiredTransactions() {
      return state.order.payment_status === "PENDING" &&
        new Date(state.order.payment_expires_at).getTime() <= Date.now()
        ? [{ id: state.payment?.id ?? null, maDonHang: state.order.maDonHang }]
        : [];
    },
    async findExpiredTransactionForOrder() {
      return state.payment?.status === "PENDING"
        ? { id: state.payment.id, maDonHang: state.order.maDonHang }
        : null;
    },
  };
  const orderRepository = {
    async getOrderItems() {
      return [{ maSP: 1, maSize: 1, soLuongMua: 2 }];
    },
    async restoreStock(_connection, item) {
      state.stock += item.soLuongMua;
      return 1;
    },
    async updateOrderStatus(_connection, _orderId, status) {
      state.order.trangThai = status;
      return 1;
    },
    async insertHistory(_connection, entry) {
      state.history.push(entry);
    },
  };
  return {
    repository: paymentRepository,
    paymentRepository,
    orderRepository,
    transaction: async (work) => work({}),
    executor: {},
  };
};

const makeIpn = (state, overrides = {}) => ({
  amount: state.payment.amount,
  orderId: state.payment.provider_order_id,
  requestId: state.payment.request_id,
  partnerCode: "MOMO",
  resultCode: 0,
  transId: 123456,
  ...overrides,
});

test("creates an authenticated MoMo link using the server-side order total", async () => {
  const state = makePaymentState();
  const deps = makeDependencies(state);
  let request;
  const result = await createMomoPaymentForOrder(
    { orderId: 42, userId: 7 },
    {
      ...deps,
      makePaymentLink: async (value) => {
        request = value;
        return { resultCode: 0, payUrl: "https://momo.example/pay" };
      },
    },
  );

  assert.equal(request.amount, 2500);
  assert.equal(result.maDonHang, 42);
  assert.equal(result.payUrl, "https://momo.example/pay");
  assert.equal(state.payment.amount, 2500);
});

test("rejects payment-link creation for an order owned by another user", async () => {
  const state = makePaymentState();
  const deps = makeDependencies(state);
  await assert.rejects(
    createMomoPaymentForOrder(
      { orderId: 42, userId: 8 },
      {
        ...deps,
        makePaymentLink: async () => {
          assert.fail("MoMo must not be called for a foreign order");
        },
      },
    ),
    { code: "ORDER_ACCESS_DENIED" },
  );
});

test("confirms a paid order once and treats repeated IPN as idempotent", async () => {
  const state = makePaymentState();
  const deps = makeDependencies(state);
  await createMomoPaymentForOrder(
    { orderId: 42, userId: 7 },
    {
      ...deps,
      makePaymentLink: async () => ({ resultCode: 0, payUrl: "pay-url" }),
    },
  );
  const payload = makeIpn(state);

  const first = await processMomoIpn(payload, {
    ...deps,
    orders: deps.orderRepository,
    partnerCode: "MOMO",
  });
  const duplicate = await processMomoIpn(payload, {
    ...deps,
    orders: deps.orderRepository,
    partnerCode: "MOMO",
  });

  assert.deepEqual(first, { duplicate: false, paymentStatus: "PAID" });
  assert.deepEqual(duplicate, { duplicate: true, paymentStatus: "PAID" });
  assert.equal(state.payment.status, "PAID");
  assert.equal(state.order.trangThai, ORDER_STATUS.CONFIRMED);
  assert.equal(state.history.length, 1);
});

test("rejects mismatched callback amounts without updating payment state", async () => {
  const state = makePaymentState();
  const deps = makeDependencies(state);
  await createMomoPaymentForOrder(
    { orderId: 42, userId: 7 },
    {
      ...deps,
      makePaymentLink: async () => ({ resultCode: 0, payUrl: "pay-url" }),
    },
  );

  await assert.rejects(
    processMomoIpn(makeIpn(state, { amount: 1 }), {
      ...deps,
      orders: deps.orderRepository,
      partnerCode: "MOMO",
    }),
    { code: "MOMO_PAYMENT_MISMATCH" },
  );
  assert.equal(state.payment.status, "PENDING");
  assert.equal(state.order.payment_status, "PENDING");
});

test("a failed IPN cancels the pending order and releases stock only once", async () => {
  const state = makePaymentState();
  const deps = makeDependencies(state);
  await createMomoPaymentForOrder(
    { orderId: 42, userId: 7 },
    {
      ...deps,
      makePaymentLink: async () => ({ resultCode: 0, payUrl: "pay-url" }),
    },
  );
  const payload = makeIpn(state, { resultCode: 1006 });

  const first = await processMomoIpn(payload, {
    ...deps,
    orders: deps.orderRepository,
    partnerCode: "MOMO",
  });
  const duplicate = await processMomoIpn(payload, {
    ...deps,
    orders: deps.orderRepository,
    partnerCode: "MOMO",
  });

  assert.equal(first.paymentStatus, "FAILED");
  assert.equal(duplicate.duplicate, true);
  assert.equal(state.order.trangThai, ORDER_STATUS.CANCELLED);
  assert.equal(state.order.payment_status, "FAILED");
  assert.equal(state.stock, 5);
  assert.equal(state.history.length, 1);
});

test("expires payment once and releases reserved stock", async () => {
  const state = makePaymentState({
    expiresAt: new Date(Date.now() - 1000),
  });
  const deps = makeDependencies(state);
  await createMomoPaymentForOrder(
    { orderId: 42, userId: 7 },
    {
      ...deps,
      now: () => new Date(Date.now() - 60_000),
      makePaymentLink: async () => ({ resultCode: 0, payUrl: "pay-url" }),
    },
  );

  const expired = await expirePendingMomoPayments({
    ...deps,
    orders: deps.orderRepository,
  });
  const repeated = await expirePendingMomoPayments({
    ...deps,
    orders: deps.orderRepository,
  });

  assert.equal(expired, 1);
  assert.equal(repeated, 0);
  assert.equal(state.payment.status, "EXPIRED");
  assert.equal(state.order.payment_status, "EXPIRED");
  assert.equal(state.order.trangThai, ORDER_STATUS.CANCELLED);
  assert.equal(state.stock, 5);
  assert.equal(state.history.length, 1);
});

test("expires an order even if link creation never created a provider transaction", async () => {
  const state = makePaymentState({
    expiresAt: new Date(Date.now() - 1000),
  });
  const deps = makeDependencies(state);

  const expired = await expirePendingMomoPayments({
    ...deps,
    orders: deps.orderRepository,
  });

  assert.equal(expired, 1);
  assert.equal(state.payment, null);
  assert.equal(state.order.payment_status, "EXPIRED");
  assert.equal(state.order.trangThai, ORDER_STATUS.CANCELLED);
  assert.equal(state.stock, 5);
});

test("records a late successful payment for manual refund without reopening order", async () => {
  const state = makePaymentState();
  const deps = makeDependencies(state);
  await createMomoPaymentForOrder(
    { orderId: 42, userId: 7 },
    {
      ...deps,
      makePaymentLink: async () => ({ resultCode: 0, payUrl: "pay-url" }),
    },
  );
  state.payment.status = "EXPIRED";
  state.order.payment_status = "EXPIRED";
  state.order.trangThai = ORDER_STATUS.CANCELLED;

  const result = await processMomoIpn(makeIpn(state), {
    ...deps,
    orders: deps.orderRepository,
    partnerCode: "MOMO",
  });

  assert.deepEqual(result, { duplicate: false, paymentStatus: "REFUND_REQUIRED" });
  assert.equal(state.payment.status, "PAID");
  assert.equal(state.order.payment_status, "REFUND_REQUIRED");
  assert.equal(state.order.trangThai, ORDER_STATUS.CANCELLED);
  assert.equal(state.history.at(-1).reason, "LATE_MOMO_PAYMENT_REFUND_REQUIRED");
});
