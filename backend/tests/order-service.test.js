import test from "node:test";
import assert from "node:assert/strict";
import {
  cancelOrder,
  createOrder,
  getFilteredOrders,
  getOrderHistory,
  updateOrderStatus,
} from "../services/order.service.js";
import { ORDER_STATUS } from "../domain/order-status.js";
import { withTransaction } from "../utils/transaction.js";

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

const makeLifecycleRepository = ({
  ownerId = 3,
  status = ORDER_STATUS.PENDING,
} = {}) => {
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
  assert.equal(calls.find(([name]) => name === "insertOrder")[1].tongTien, 375);
  assert.deepEqual(
    calls
      .filter(([name]) => name === "insertItem")
      .map(([, , item]) => item.giaMua),
    [125, 125],
  );
  assert.equal(
    calls.some(([name]) => name === "history"),
    true,
  );
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
  assert.equal(
    calls.some(([name]) => name === "insertOrder"),
    false,
  );
  assert.equal(
    calls.some(([name]) => name === "reduceStock"),
    false,
  );
});

test("rolls back order writes when stock reservation fails", async () => {
  const events = [];
  const { calls, repository } = makeRepository();
  repository.reduceStock = async () => {
    calls.push(["reduceStock"]);
    return 0;
  };
  const pool = {
    promise: () => ({
      async getConnection() {
        return {
          async beginTransaction() {
            events.push("begin");
          },
          async commit() {
            events.push("commit");
          },
          async rollback() {
            events.push("rollback");
          },
          release() {
            events.push("release");
          },
        };
      },
    }),
  };

  await assert.rejects(
    createOrder(
      {
        userId: 3,
        tenNguoiNhan: "Buyer",
        sdt: "0912345678",
        diaChiGiaoHang: "Hanoi",
        maPTTT: 1,
        items: [{ maSP: 2, maSize: 1, soLuongMua: 1 }],
      },
      {
        transaction: (work) => withTransaction(work, pool),
        repository,
      },
    ),
    { code: "STOCK_UPDATE_FAILED" },
  );

  assert.equal(
    calls.some(([name]) => name === "insertOrder"),
    true,
  );
  assert.deepEqual(events, ["begin", "rollback", "release"]);
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

test("filters orders with bound parameters and returns page metadata", async () => {
  const calls = [];
  const executor = {
    async execute(sql, values = []) {
      calls.push({ sql, values });
      if (sql.includes("COUNT(*)")) return [[{ total: 3 }]];
      if (sql.includes("LIMIT ? OFFSET ?")) return [[{ maDonHang: 42 }]];
      return [
        [
          {
            maDonHang: 42,
            trangThai: ORDER_STATUS.PENDING,
            tongTien: 50,
            maSP: 2,
            maSize: 4,
            soLuongMua: 1,
            giaMua: 50,
            tenSP: "Shirt",
            tenSize: "M",
          },
        ],
      ];
    },
  };

  const result = await getFilteredOrders(
    {
      trangThai: ORDER_STATUS.PENDING,
      fromDate: "2026-01-01",
      toDate: "2026-01-31",
      minTotal: "10",
      maxTotal: "100",
      keyword: "Ada%_",
      page: "2",
      limit: "1",
    },
    { executor },
  );

  assert.equal(result.pagination.page, 2);
  assert.equal(result.pagination.limit, 1);
  assert.equal(result.pagination.total, 3);
  assert.equal(result.pagination.totalPages, 3);
  assert.equal(result.items[0].items[0].maSize, 4);
  assert.equal(calls[0].sql.includes("Ada"), false);
  assert.equal(calls[0].values.includes("%Ada\\%\\_%"), true);
  assert.deepEqual(calls[1].values.slice(-2), [1, 1]);
});

test("allows order history only for its owner or staff", async () => {
  let historyRead = false;
  const repository = {
    async getOrderOwner() {
      return { maDonHang: 42, id: 99 };
    },
    async getOrderHistory() {
      historyRead = true;
      return [];
    },
  };

  await assert.rejects(
    getOrderHistory(
      { orderId: 42, actorId: 3, role: "user" },
      { executor: {}, repository },
    ),
    { code: "ORDER_ACCESS_DENIED" },
  );
  assert.equal(historyRead, false);

  await getOrderHistory(
    { orderId: 42, actorId: 8, role: "staff" },
    { executor: {}, repository },
  );
  assert.equal(historyRead, true);
});
