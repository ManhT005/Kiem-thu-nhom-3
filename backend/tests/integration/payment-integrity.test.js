import "dotenv/config";
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import db from "../../config/db.js";
import { createOrder } from "../../services/order.service.js";
import { createMomoPaymentForOrder, processMomoIpn, expirePendingMomoPayments, getMomoPaymentStatus } from "../../services/payment.service.js";
import { paymentRepository } from "../../repositories/payment.repository.js";

const enabled = process.env.ORDER_CONCURRENCY_TEST === "1" && /_test$/i.test(process.env.DB_NAME || "");
const pool = db.promise();
let userId, otherUserId, sizeId, methodId;
const products = [];
const integration = (name, work) => test(name, { skip: !enabled }, work);
before(async () => {
  if (!enabled) return;
  for (let index = 0; index < 2; index++) {
    const [result] = await pool.execute("INSERT INTO users (ten, email, matKhau, role) VALUES ('Payment QA', ?, 'unused', 'user')", [`payment-${randomUUID()}@example.test`]);
    if (index === 0) userId = result.insertId; else otherUserId = result.insertId;
  }
  const [sizes] = await pool.execute("SELECT maSize FROM `Size` ORDER BY maSize LIMIT 1");
  sizeId = sizes[0].maSize;
  const [method] = await pool.execute("INSERT INTO phuongThucThanhToan (tenPTTT) VALUES ('MOMO')");
  methodId = method.insertId;
});
after(async () => {
  try {
    if (userId) {
      await pool.execute("DELETE FROM DonHang WHERE id IN (?, ?)", [userId, otherUserId]);
      await pool.execute("DELETE FROM users WHERE id IN (?, ?)", [userId, otherUserId]);
    }
    for (const id of products) await pool.execute("DELETE FROM SanPham WHERE maSP = ?", [id]);
    if (methodId) await pool.execute("DELETE FROM phuongThucThanhToan WHERE maPTTT = ?", [methodId]);
  } finally { await pool.end(); }
});

async function input() {
  const [product] = await pool.execute("INSERT INTO SanPham (tenSP, gia) VALUES (?, 2500)", [`Payment ${randomUUID()}`]);
  const id = product.insertId;
  products.push(id);
  await pool.execute("INSERT INTO ChiTietSanPham (maSP, maSize, soLuongTon) VALUES (?, ?, 10)", [id, sizeId]);
  return { userId, tenNguoiNhan: "Payment QA", sdt: "0900000000", diaChiGiaoHang: "QA address",
    maPTTT: methodId, items: [{ maSP: id, maSize: sizeId, soLuongMua: 2 }] };
}
async function paymentOrder() {
  const request = await input();
  const order = await createOrder(request);
  await createMomoPaymentForOrder({ orderId: order.maDonHang, userId }, {
    makePaymentLink: async () => ({ resultCode: 0, payUrl: "https://test-payment.momo.vn/pay" }),
  });
  const [rows] = await pool.execute("SELECT * FROM MomoPaymentTransaction WHERE maDonHang = ?", [order.maDonHang]);
  return { request, order, payment: rows[0] };
}
function ipn(payment, overrides = {}) {
  return { amount: Number(payment.amount), orderId: payment.provider_order_id, requestId: payment.request_id,
    partnerCode: "MOMO", resultCode: 0, transId: String(payment.id + 1000000), ...overrides };
}
async function past(orderId) {
  await pool.execute("UPDATE DonHang SET payment_expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE maDonHang = ?", [orderId]);
  await pool.execute("UPDATE MomoPaymentTransaction SET expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE maDonHang = ?", [orderId]);
}
async function stock(request) {
  const [rows] = await pool.execute("SELECT soLuongTon FROM ChiTietSanPham WHERE maSP = ? AND maSize = ?", [request.items[0].maSP, sizeId]);
  return rows[0].soLuongTon;
}

integration("MySQL 8 expiration query handles empty queue, 1/100/500 and latest transaction deterministically", async () => {
  assert.deepEqual(await paymentRepository.findExpiredTransactions(pool), []);
  const ids = [];
  try {
    for (let index = 0; index < 501; index++) {
      const [result] = await pool.execute(`INSERT INTO DonHang (id, maPTTT, tongTien, trangThai, payment_status, payment_expires_at)
        VALUES (?, ?, 2500, 'Chờ xác nhận', 'PENDING', '2020-01-01')`, [userId, methodId]);
      ids.push(result.insertId);
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      await paymentRepository.insertTransaction(pool, { orderId: ids[0], providerOrderId: randomUUID(), requestId: randomUUID(), amount: 2500, expiresAt: new Date("2020-01-01") });
    }
    for (const limit of [1, 100, 500]) {
      const rows = await paymentRepository.findExpiredTransactions(pool, limit);
      assert.deepEqual(rows.map((row) => row.maDonHang), ids.slice(0, limit));
      assert.ok(rows[0].id);
      if (limit > 1) assert.equal(rows[1].id, null);
    }
    assert.equal((await paymentRepository.findExpiredTransactions(pool)).length, 100);
    for (const limit of [0, -1, 501, "1 OR 1=1"]) await assert.rejects(paymentRepository.findExpiredTransactions(pool, limit), RangeError);
  } finally {
    for (const id of ids) await pool.execute("DELETE FROM DonHang WHERE maDonHang = ?", [id]);
  }
});

integration("concurrent checkout retries create one order and preserve stock/history; changed payload conflicts", async () => {
  const request = { ...await input(), idempotencyKey: randomUUID() };
  const orders = await Promise.all(Array.from({ length: 10 }, () => createOrder(request)));
  assert.equal(new Set(orders.map((order) => order.maDonHang)).size, 1);
  assert.equal(await stock(request), 8);
  await assert.rejects(createOrder({ ...request, diaChiGiaoHang: "Changed" }), { code: "IDEMPOTENCY_CONFLICT" });
  const [history] = await pool.execute("SELECT * FROM LichSuDonHang WHERE maDonHang = ?", [orders[0].maDonHang]);
  assert.equal(history.length, 1);
  const other = await createOrder({ ...request, userId: otherUserId });
  assert.notEqual(other.maDonHang, orders[0].maDonHang);
  assert.equal(await stock(request), 6);
});

integration("idempotency reservation rolls back with insufficient stock and the same key can retry", async () => {
  const request = { ...await input(), idempotencyKey: randomUUID() };
  await pool.execute("UPDATE ChiTietSanPham SET soLuongTon = 0 WHERE maSP = ?", [request.items[0].maSP]);
  await assert.rejects(createOrder(request), { code: "INSUFFICIENT_STOCK" });
  const [keys] = await pool.execute("SELECT * FROM OrderCheckoutRequest WHERE user_id = ? AND idempotency_key = ?", [userId, request.idempotencyKey]);
  assert.equal(keys.length, 0);
  await pool.execute("UPDATE ChiTietSanPham SET soLuongTon = 10 WHERE maSP = ?", [request.items[0].maSP]);
  assert.ok((await createOrder(request)).maDonHang);
});

integration("two expiration workers restore stock exactly once for pending orders with and without transactions", async () => {
  for (const hasTransaction of [true, false]) {
    const request = await input();
    const order = await createOrder(request);
    if (hasTransaction) await createMomoPaymentForOrder({ orderId: order.maDonHang, userId }, {
      makePaymentLink: async () => ({ resultCode: 0, payUrl: "https://test-payment.momo.vn/pay" }),
    });
    await past(order.maDonHang);
    const counts = await Promise.all([expirePendingMomoPayments(), expirePendingMomoPayments()]);
    assert.equal(counts.reduce((sum, count) => sum + count, 0), 1);
    assert.equal(await stock(request), 10);
    assert.equal((await getMomoPaymentStatus({ orderId: order.maDonHang, userId })).paymentStatus, "EXPIRED");
    const [history] = await pool.execute("SELECT * FROM LichSuDonHang WHERE maDonHang = ?", [order.maDonHang]);
    assert.equal(history.length, 2);
  }
});

integration("concurrent valid IPNs are idempotent, mismatches and foreign users cannot modify state", async () => {
  const { request, order, payment } = await paymentOrder();
  await assert.rejects(getMomoPaymentStatus({ orderId: order.maDonHang, userId: otherUserId }), { code: "ORDER_ACCESS_DENIED" });
  await assert.rejects(processMomoIpn(ipn(payment, { amount: 1 })), { code: "MOMO_PAYMENT_MISMATCH" });
  const results = await Promise.all(Array.from({ length: 10 }, () => processMomoIpn(ipn(payment))));
  assert.equal(results.filter((result) => !result.duplicate).length, 1);
  assert.equal(await stock(request), 8);
  assert.equal((await getMomoPaymentStatus({ orderId: order.maDonHang, userId })).paymentStatus, "PAID");
  const [history] = await pool.execute("SELECT * FROM LichSuDonHang WHERE maDonHang = ?", [order.maDonHang]);
  assert.equal(history.length, 2);
});

integration("IPN racing expiration yields paid or refund-required state without double stock restoration", async () => {
  const { request, order, payment } = await paymentOrder();
  await past(order.maDonHang);
  await Promise.all([processMomoIpn(ipn(payment), { now: () => new Date(Date.now() - 120000) }), expirePendingMomoPayments()]);
  const status = await getMomoPaymentStatus({ orderId: order.maDonHang, userId });
  assert.ok(["PAID", "REFUND_REQUIRED"].includes(status.paymentStatus));
  assert.equal(await stock(request), status.paymentStatus === "PAID" ? 8 : 10);
  assert.equal((await processMomoIpn(ipn(payment))).duplicate, true);
  assert.equal(await expirePendingMomoPayments(), 0);
});

integration("provider link failure leaves an expirable order and retry reuses provider identifiers", async () => {
  const request = await input();
  const order = await createOrder(request);
  const call = () => createMomoPaymentForOrder({ orderId: order.maDonHang, userId }, {
    makePaymentLink: async () => { throw new Error("Provider unavailable"); },
  });
  await assert.rejects(call(), /Provider unavailable/);
  await assert.rejects(call(), /Provider unavailable/);
  const [attempts] = await pool.execute("SELECT * FROM MomoPaymentTransaction WHERE maDonHang = ?", [order.maDonHang]);
  assert.equal(attempts.length, 1);
  await past(order.maDonHang);
  assert.equal(await expirePendingMomoPayments(), 1);
  assert.equal(await stock(request), 10);
});
