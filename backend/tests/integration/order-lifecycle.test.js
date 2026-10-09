import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import db from "../../config/db.js";
import {
  cancelOrder,
  createOrder,
  getOrderHistory,
  updateOrderStatus,
} from "../../services/order.service.js";
import { ORDER_STATUS } from "../../domain/order-status.js";

const databaseName = process.env.DB_NAME || "";
const integrationEnabled =
  process.env.ORDER_CONCURRENCY_TEST === "1" && /_test$/i.test(databaseName);

test(
  "order full lifecycle: create -> confirmed -> shipping -> completed with audit history",
  {
    skip: integrationEnabled
      ? false
      : "Set ORDER_CONCURRENCY_TEST=1 and use a *_test database",
  },
  async () => {
    const pool = db.promise();
    const userEmail = `order-lifecycle-${randomUUID()}@example.test`;
    let userId;
    let staffId;
    let productId;
    let createdOrderId;

    try {
      const [paymentMethods] = await pool.execute(
        "SELECT maPTTT FROM phuongThucThanhToan ORDER BY maPTTT LIMIT 1",
      );
      const [sizes] = await pool.execute(
        "SELECT maSize FROM `Size` ORDER BY maSize LIMIT 1",
      );
      assert.ok(paymentMethods.length > 0 && sizes.length > 0);

      const [userResult] = await pool.execute(
        `INSERT INTO users (ten, email, sdt, matKhau, role)
         VALUES (?, ?, ?, ?, 'user')`,
        ["Lifecycle Customer", userEmail, "0900000000", randomUUID()],
      );
      userId = userResult.insertId;

      const [staffResult] = await pool.execute(
        `INSERT INTO users (ten, email, sdt, matKhau, role)
         VALUES (?, ?, ?, ?, 'staff')`,
        ["Lifecycle Staff", `staff-${randomUUID()}@example.test`, "0900000001", randomUUID()],
      );
      staffId = staffResult.insertId;

      const [prodResult] = await pool.execute(
        "INSERT INTO SanPham (tenSP, gia) VALUES (?, ?)",
        [`Lifecycle Item ${randomUUID()}`, 1000],
      );
      productId = prodResult.insertId;
      const sizeId = sizes[0].maSize;
      await pool.execute(
        "INSERT INTO ChiTietSanPham (maSP, maSize, soLuongTon) VALUES (?, ?, 10)",
        [productId, sizeId],
      );

      // Step 1: Create Order
      const createResult = await createOrder({
        userId,
        tenNguoiNhan: "Lifecycle Recipient",
        sdt: "0900000000",
        diaChiGiaoHang: "123 Hanoi",
        maPTTT: paymentMethods[0].maPTTT,
        items: [{ maSP: productId, maSize: sizeId, soLuongMua: 2 }],
      });
      createdOrderId = createResult.maDonHang;
      assert.equal(createResult.trangThai, ORDER_STATUS.PENDING);

      // Verify stock decreased
      const [stockAfterCreate] = await pool.execute(
        "SELECT soLuongTon FROM ChiTietSanPham WHERE maSP = ? AND maSize = ?",
        [productId, sizeId],
      );
      assert.equal(Number(stockAfterCreate[0]?.soLuongTon), 8);

      // Step 2: Staff confirms order (PENDING -> CONFIRMED)
      const confirmedResult = await updateOrderStatus({
        orderId: createdOrderId,
        targetStatus: ORDER_STATUS.CONFIRMED,
        actorId: staffId,
        reason: "Staff confirmed",
      });
      assert.equal(confirmedResult.trangThai, ORDER_STATUS.CONFIRMED);

      // Step 3: Staff moves order to SHIPPING (CONFIRMED -> SHIPPING)
      const shippingResult = await updateOrderStatus({
        orderId: createdOrderId,
        targetStatus: ORDER_STATUS.SHIPPING,
        actorId: staffId,
        reason: "Dispatched to courier",
      });
      assert.equal(shippingResult.trangThai, ORDER_STATUS.SHIPPING);

      // Step 4: Staff completes order (SHIPPING -> COMPLETED)
      const completedResult = await updateOrderStatus({
        orderId: createdOrderId,
        targetStatus: ORDER_STATUS.COMPLETED,
        actorId: staffId,
        reason: "Delivered to customer",
      });
      assert.equal(completedResult.trangThai, ORDER_STATUS.COMPLETED);

      // Step 5: Verify audit trail history
      const history = await getOrderHistory({
        orderId: createdOrderId,
        actorId: userId,
        role: "user",
      });
      assert.equal(history.length, 4, "should have 4 history entries");
      assert.equal(history[0].trangThaiCu, null);
      assert.equal(history[0].trangThaiMoi, ORDER_STATUS.PENDING);
      assert.equal(history[0].lyDo, "ORDER_CREATED");
      assert.equal(history[1].trangThaiCu, ORDER_STATUS.PENDING);
      assert.equal(history[1].trangThaiMoi, ORDER_STATUS.CONFIRMED);
      assert.equal(history[2].trangThaiCu, ORDER_STATUS.CONFIRMED);
      assert.equal(history[2].trangThaiMoi, ORDER_STATUS.SHIPPING);
      assert.equal(history[3].trangThaiCu, ORDER_STATUS.SHIPPING);
      assert.equal(history[3].trangThaiMoi, ORDER_STATUS.COMPLETED);
    } finally {
      if (userId) {
        await pool.execute("DELETE FROM DonHang WHERE id = ?", [userId]);
        await pool.execute("DELETE FROM users WHERE id = ?", [userId]);
      }
      if (staffId) {
        await pool.execute("DELETE FROM users WHERE id = ?", [staffId]);
      }
      if (productId) {
        await pool.execute("DELETE FROM SanPham WHERE maSP = ?", [productId]);
      }
    }
  },
);

test(
  "order cancellation lifecycle: create -> cancel -> stock restored -> repeat cancel rejected",
  {
    skip: integrationEnabled
      ? false
      : "Set ORDER_CONCURRENCY_TEST=1 and use a *_test database",
  },
  async () => {
    const pool = db.promise();
    const userEmail = `order-cancel-flow-${randomUUID()}@example.test`;
    let userId;
    let productId;
    let orderId;

    try {
      const [paymentMethods] = await pool.execute(
        "SELECT maPTTT FROM phuongThucThanhToan ORDER BY maPTTT LIMIT 1",
      );
      const [sizes] = await pool.execute(
        "SELECT maSize FROM `Size` ORDER BY maSize LIMIT 1",
      );
      assert.ok(paymentMethods.length > 0 && sizes.length > 0);

      const [userResult] = await pool.execute(
        `INSERT INTO users (ten, email, sdt, matKhau, role)
         VALUES (?, ?, ?, ?, 'user')`,
        ["Cancel Customer", userEmail, "0900000000", randomUUID()],
      );
      userId = userResult.insertId;

      const [prodResult] = await pool.execute(
        "INSERT INTO SanPham (tenSP, gia) VALUES (?, ?)",
        [`Cancel Item ${randomUUID()}`, 500],
      );
      productId = prodResult.insertId;
      const sizeId = sizes[0].maSize;
      await pool.execute(
        "INSERT INTO ChiTietSanPham (maSP, maSize, soLuongTon) VALUES (?, ?, 5)",
        [productId, sizeId],
      );

      // Create order for 3 items
      const created = await createOrder({
        userId,
        tenNguoiNhan: "Cancel Recipient",
        sdt: "0900000000",
        diaChiGiaoHang: "456 Danang",
        maPTTT: paymentMethods[0].maPTTT,
        items: [{ maSP: productId, maSize: sizeId, soLuongMua: 3 }],
      });
      orderId = created.maDonHang;

      // Stock should now be 2
      const [stockAfterCreate] = await pool.execute(
        "SELECT soLuongTon FROM ChiTietSanPham WHERE maSP = ? AND maSize = ?",
        [productId, sizeId],
      );
      assert.equal(Number(stockAfterCreate[0]?.soLuongTon), 2);

      // Cancel order
      const cancelled = await cancelOrder({
        orderId,
        actorId: userId,
        reason: "Customer changed mind",
      });
      assert.equal(cancelled.trangThai, ORDER_STATUS.CANCELLED);

      // Stock restored to 5
      const [stockAfterCancel] = await pool.execute(
        "SELECT soLuongTon FROM ChiTietSanPham WHERE maSP = ? AND maSize = ?",
        [productId, sizeId],
      );
      assert.equal(Number(stockAfterCancel[0]?.soLuongTon), 5);

      // Attempt to cancel again should fail with ORDER_ALREADY_CANCELLED
      await assert.rejects(
        cancelOrder({
          orderId,
          actorId: userId,
          reason: "Trying cancel again",
        }),
        (err) => err.code === "ORDER_ALREADY_CANCELLED",
      );

      // Stock still exactly 5
      const [stockAfterSecondCancel] = await pool.execute(
        "SELECT soLuongTon FROM ChiTietSanPham WHERE maSP = ? AND maSize = ?",
        [productId, sizeId],
      );
      assert.equal(Number(stockAfterSecondCancel[0]?.soLuongTon), 5);
    } finally {
      if (userId) {
        await pool.execute("DELETE FROM DonHang WHERE id = ?", [userId]);
        await pool.execute("DELETE FROM users WHERE id = ?", [userId]);
      }
      if (productId) {
        await pool.execute("DELETE FROM SanPham WHERE maSP = ?", [productId]);
      }
    }
  },
);

test.after(async () => {
  await db.end();
});
