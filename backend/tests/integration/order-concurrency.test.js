import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import db from "../../config/db.js";
import { createOrder } from "../../services/order.service.js";

const databaseName = process.env.DB_NAME || "";
const integrationEnabled =
  process.env.ORDER_CONCURRENCY_TEST === "1" && /_test$/i.test(databaseName);

test(
  "serializes concurrent orders so stock=1 cannot be oversold",
  {
    skip: integrationEnabled
      ? false
      : "Set ORDER_CONCURRENCY_TEST=1 and use a *_test database",
  },
  async () => {
    const pool = db.promise();
    const userEmail = `order-concurrency-${randomUUID()}@example.test`;
    let userId;
    let productId;

    try {
      const [paymentMethods] = await pool.execute(
        "SELECT maPTTT FROM phuongThucThanhToan ORDER BY maPTTT LIMIT 1",
      );
      const [sizes] = await pool.execute(
        "SELECT maSize FROM \`Size\` ORDER BY maSize LIMIT 1",
      );
      assert.ok(
        paymentMethods.length > 0,
        "test database needs payment reference data",
      );
      assert.ok(sizes.length > 0, "test database needs size reference data");

      const [userResult] = await pool.execute(
        `INSERT INTO users (ten, email, sdt, matKhau, role)
         VALUES (?, ?, ?, ?, 'user')`,
        ["Concurrency Test", userEmail, "0900000000", randomUUID()],
      );
      userId = userResult.insertId;

      const [productResult] = await pool.execute(
        "INSERT INTO SanPham (tenSP, gia) VALUES (?, ?)",
        [`Concurrency test ${randomUUID()}`, 500],
      );
      productId = productResult.insertId;
      const sizeId = sizes[0].maSize;
      await pool.execute(
        "INSERT INTO ChiTietSanPham (maSP, maSize, soLuongTon) VALUES (?, ?, 1)",
        [productId, sizeId],
      );

      const input = {
        userId,
        tenNguoiNhan: "Concurrency Test",
        sdt: "0900000000",
        diaChiGiaoHang: "Test address",
        maPTTT: paymentMethods[0].maPTTT,
        items: [{ maSP: productId, maSize: sizeId, soLuongMua: 1 }],
      };
      const outcomes = await Promise.allSettled([
        createOrder(input),
        createOrder(input),
      ]);
      const fulfilled = outcomes.filter(
        (outcome) => outcome.status === "fulfilled",
      );
      const rejected = outcomes.filter(
        (outcome) => outcome.status === "rejected",
      );
      assert.equal(fulfilled.length, 1, "exactly one order should succeed");
      assert.equal(rejected.length, 1, "exactly one order should be rejected");
      assert.equal(rejected[0].reason.code, "INSUFFICIENT_STOCK");

      const [stockRows] = await pool.execute(
        "SELECT soLuongTon FROM ChiTietSanPham WHERE maSP = ? AND maSize = ?",
        [productId, sizeId],
      );
      assert.equal(Number(stockRows[0]?.soLuongTon), 0);
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

test(
  "serializes 10 concurrent orders competing for stock=5 without overselling",
  {
    skip: integrationEnabled
      ? false
      : "Set ORDER_CONCURRENCY_TEST=1 and use a *_test database",
  },
  async () => {
    const pool = db.promise();
    const userEmail = `order-concurrency-5-${randomUUID()}@example.test`;
    let userId;
    let productId;

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
        ["Concurrency Test 5", userEmail, "0900000000", randomUUID()],
      );
      userId = userResult.insertId;

      const [productResult] = await pool.execute(
        "INSERT INTO SanPham (tenSP, gia) VALUES (?, ?)",
        [`Concurrency stock 5 test ${randomUUID()}`, 500],
      );
      productId = productResult.insertId;
      const sizeId = sizes[0].maSize;
      await pool.execute(
        "INSERT INTO ChiTietSanPham (maSP, maSize, soLuongTon) VALUES (?, ?, 5)",
        [productId, sizeId],
      );

      const input = {
        userId,
        tenNguoiNhan: "Concurrency Test 5",
        sdt: "0900000000",
        diaChiGiaoHang: "Test address",
        maPTTT: paymentMethods[0].maPTTT,
        items: [{ maSP: productId, maSize: sizeId, soLuongMua: 1 }],
      };

      const promises = Array.from({ length: 10 }, () => createOrder(input));
      const outcomes = await Promise.allSettled(promises);
      const fulfilled = outcomes.filter((o) => o.status === "fulfilled");
      const rejected = outcomes.filter((o) => o.status === "rejected");

      assert.equal(fulfilled.length, 5, "exactly 5 orders should succeed");
      assert.equal(rejected.length, 5, "exactly 5 orders should be rejected");
      for (const rej of rejected) {
        assert.equal(rej.reason.code, "INSUFFICIENT_STOCK");
      }

      const [stockRows] = await pool.execute(
        "SELECT soLuongTon FROM ChiTietSanPham WHERE maSP = ? AND maSize = ?",
        [productId, sizeId],
      );
      assert.equal(Number(stockRows[0]?.soLuongTon), 0, "final stock must be exactly 0");
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

test(
  "preserves lock ordering and avoids deadlock across multi-item concurrent orders",
  {
    skip: integrationEnabled
      ? false
      : "Set ORDER_CONCURRENCY_TEST=1 and use a *_test database",
  },
  async () => {
    const pool = db.promise();
    const userEmail = `order-concurrency-multi-${randomUUID()}@example.test`;
    let userId;
    let prodAId;
    let prodBId;

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
        ["Concurrency Multi Test", userEmail, "0900000000", randomUUID()],
      );
      userId = userResult.insertId;

      const [prodAResult] = await pool.execute(
        "INSERT INTO SanPham (tenSP, gia) VALUES (?, ?)",
        [`Product A ${randomUUID()}`, 300],
      );
      prodAId = prodAResult.insertId;

      const [prodBResult] = await pool.execute(
        "INSERT INTO SanPham (tenSP, gia) VALUES (?, ?)",
        [`Product B ${randomUUID()}`, 400],
      );
      prodBId = prodBResult.insertId;

      const sizeId = sizes[0].maSize;
      await pool.execute(
        "INSERT INTO ChiTietSanPham (maSP, maSize, soLuongTon) VALUES (?, ?, 2)",
        [prodAId, sizeId],
      );
      await pool.execute(
        "INSERT INTO ChiTietSanPham (maSP, maSize, soLuongTon) VALUES (?, ?, 2)",
        [prodBId, sizeId],
      );

      // Order 1 passes items [A, B]
      const order1Input = {
        userId,
        tenNguoiNhan: "Multi Order 1",
        sdt: "0900000000",
        diaChiGiaoHang: "Test address 1",
        maPTTT: paymentMethods[0].maPTTT,
        items: [
          { maSP: prodAId, maSize: sizeId, soLuongMua: 1 },
          { maSP: prodBId, maSize: sizeId, soLuongMua: 1 },
        ],
      };

      // Order 2 passes items in reverse [B, A]
      const order2Input = {
        userId,
        tenNguoiNhan: "Multi Order 2",
        sdt: "0900000000",
        diaChiGiaoHang: "Test address 2",
        maPTTT: paymentMethods[0].maPTTT,
        items: [
          { maSP: prodBId, maSize: sizeId, soLuongMua: 1 },
          { maSP: prodAId, maSize: sizeId, soLuongMua: 1 },
        ],
      };

      const outcomes = await Promise.allSettled([
        createOrder(order1Input),
        createOrder(order2Input),
      ]);

      const fulfilled = outcomes.filter((o) => o.status === "fulfilled");
      const rejected = outcomes.filter((o) => o.status === "rejected");

      assert.equal(rejected.length, 0, "neither order should deadlock or fail");
      assert.equal(fulfilled.length, 2, "both multi-product orders should succeed");

      const [stockARows] = await pool.execute(
        "SELECT soLuongTon FROM ChiTietSanPham WHERE maSP = ? AND maSize = ?",
        [prodAId, sizeId],
      );
      const [stockBRows] = await pool.execute(
        "SELECT soLuongTon FROM ChiTietSanPham WHERE maSP = ? AND maSize = ?",
        [prodBId, sizeId],
      );

      assert.equal(Number(stockARows[0]?.soLuongTon), 0);
      assert.equal(Number(stockBRows[0]?.soLuongTon), 0);
    } finally {
      if (userId) {
        await pool.execute("DELETE FROM DonHang WHERE id = ?", [userId]);
        await pool.execute("DELETE FROM users WHERE id = ?", [userId]);
      }
      if (prodAId) {
        await pool.execute("DELETE FROM SanPham WHERE maSP = ?", [prodAId]);
      }
      if (prodBId) {
        await pool.execute("DELETE FROM SanPham WHERE maSP = ?", [prodBId]);
      }
    }
  },
);

test.after(async () => {
  await db.end();
});
