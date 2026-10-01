import test from "node:test";
import assert from "node:assert/strict";
import {
  cancelOrder,
  createOrder,
  updateOrderStatus,
} from "../services/order.service.js";
import { ORDER_STATUS } from "../domain/order-status.js";

const makeRepository = ({ stock = 10 } = {}) => {
  const calls = [];
  const repository = {
    async findPaymentMethod(_connection, paymentMethodId) {
      calls.push(["payment", paymentMethodId]);
      return { maPTTT: paymentMethodId };
    },
    async lockVariant(_connection, productId, sizeId) {
      calls.push(["lock", productId, sizeId]);
      return { maSP: productId, maSize: sizeId, gia: 125, soLuongTon: stock };
    },
    async insertOrder(_connection, order) {
      calls.push(["insertOrder", order]);
      return 42;
    },
    async insertOrderItem(_connection, orderId, item) {
      calls.push(["insertItem", orderId, item]);
    },
    async reduceStock(_connection, item) {
      calls.push(["reduceStock", item]);
      return 1;
    },
    async lockCart(_connection, userId) {
      calls.push(["cart", userId]);
      return 7;
    },
    async removeCartItem(_connection, cartId, item) {
      calls.push(["removeCartItem", cartId, item]);
    },
    async insertHistory(_connection, history) {
      calls.push(["history", history]);
    },
  };
  return { calls, repository };
};

const transaction = async (work) => work({});

const makeLifecycleRepository = ({ ownerId = 3, status = ORDER_STATUS.PENDING } = {}) => {
  const state = { ownerId, status, stock: 8, history: [] };
  const repository = {
    async lockOrder() {
      return { maDonHang: 42, id: state.ownerId, trangThai: state.status };
    },
    async getOrderItems() {
      return [{ maSP: 1, maSize: 2, soLuongMua: 2 }];
    },
    async restoreStock(_connection, item) {
      state.stock += item.soLuongMua;
      return 1;
    },
    async updateOrderStatus(_connection, _orderId, nextStatus) {
      state.status = nextStatus;
      return 1;
    },
    async insertHistory(_connection, entry) {
      state.history.push(entry);
    },
  };
  return { repository, state };
};

test("prices order items from locked products and ignores client totals", async () => {
  const { calls, repository } = makeRepository();
  const result = await createOrder(
    {
      userId: 3,
      tenNguoiNhan: "Buyer",
      sdt: "0912345678",
      diaChiGiaoHang: "Hanoi",
      maPTTT: 1,
      tongTien: 1,
      items: [
        { maSP: 9, maSize: 2, soLuongMua: 2, gia: 1 },
        { maSP: 2, maSize: 1, soLuongMua: 1, gia: 1 },
      ],
    },
    { transaction, repository },
  );

  assert.deepEqual(
    calls.filter(([name]) => name === "lock").map(([, productId]) => productId),
    [2, 9],
  );
  assert.equal(result.tongTien, 375);
  assert.equal(result.trangThai, ORDER_STATUS.PENDING);
  assert.equal(
    calls.find(([name]) => name === "insertOrder")[1].tongTien,
    375,
  );
  assert.deepEqual(
    calls
      .filter(([name]) => name === "insertItem")
      .map(([, , item]) => item.giaMua),
    [125, 125],
  );
  assert.equal(calls.some(([name]) => name === "history"), true);
});

test("rejects duplicate variants before opening a transaction", async () => {
  let transactionStarted = false;
  await assert.rejects(
    createOrder(
      {
        maPTTT: 1,
        items: [
          { maSP: 2, maSize: 1, soLuongMua: 1 },
          { maSP: 2, maSize: 1, soLuongMua: 2 },
        ],
      },
      {
        transaction: async (work) => {
          transactionStarted = true;
          return work({});
        },
        repository: makeRepository().repository,
      },
    ),
    { code: "ORDER_DUPLICATE_ITEM" },
  );
  assert.equal(transactionStarted, false);
});

test("checks every locked stock row before creating an order", async () => {
  const { calls, repository } = makeRepository({ stock: 1 });
  await assert.rejects(
    createOrder(
      {
        userId: 3,
        maPTTT: 1,
        items: [
          { maSP: 1, maSize: 1, soLuongMua: 1 },
          { maSP: 2, maSize: 1, soLuongMua: 2 },
        ],
      },
      { transaction, repository },
    ),
    { code: "INSUFFICIENT_STOCK" },
  );
  assert.equal(calls.some(([name]) => name === "insertOrder"), false);
  assert.equal(calls.some(([name]) => name === "reduceStock"), false);
});

test("cancels an owned pending order once and restores stock once", async () => {
  const { repository, state } = makeLifecycleRepository();
  const input = { orderId: 42, actorId: 3 };

  await cancelOrder(input, { transaction, repository });
  assert.equal(state.status, ORDER_STATUS.CANCELLED);
  assert.equal(state.stock, 10);
  assert.equal(state.history.length, 1);

  await assert.rejects(cancelOrder(input, { transaction, repository }), {
    code: "ORDER_ALREADY_CANCELLED",
  });
  assert.equal(state.stock, 10);
  assert.equal(state.history.length, 1);
});

test("prevents users from cancelling another owner's order", async () => {
  const { repository, state } = makeLifecycleRepository({ ownerId: 99 });
  await assert.rejects(
    cancelOrder({ orderId: 42, actorId: 3 }, { transaction, repository }),
    { code: "ORDER_ACCESS_DENIED" },
  );
  assert.equal(state.stock, 8);
  assert.equal(state.history.length, 0);
});

test("rejects invalid transitions before restoring stock", async () => {
  const { repository, state } = makeLifecycleRepository();
  await assert.rejects(
    updateOrderStatus(
      { orderId: 42, actorId: 8, targetStatus: ORDER_STATUS.SHIPPING },
      { transaction, repository },
    ),
    { code: "INVALID_ORDER_TRANSITION" },
  );
  assert.equal(state.status, ORDER_STATUS.PENDING);
  assert.equal(state.stock, 8);
});