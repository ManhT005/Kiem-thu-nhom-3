import { randomUUID } from "node:crypto";
export const integrationEnabled = process.env.ORDER_CONCURRENCY_TEST === "1" && /_test$/i.test(process.env.DB_NAME || "");
export async function fixture(pool, stock = 10) {
  if (!integrationEnabled) throw new Error("Dedicated test database is required");
  const users = {}, products = [];
  const [sizes] = await pool.execute("SELECT maSize FROM `Size` ORDER BY maSize LIMIT 2");
  const [methods] = await pool.execute("SELECT maPTTT FROM phuongThucThanhToan WHERE tenPTTT = 'COD' LIMIT 1");
  for (const role of ["user","staff","admin"]) {
    const [result] = await pool.execute("INSERT INTO users (ten, email, matKhau, role) VALUES (?, ?, 'unused', ?)",
      [role, `fixture-${randomUUID()}@example.test`, role]);
    users[role] = result.insertId;
  }
  const [product] = await pool.execute("INSERT INTO SanPham (tenSP, gia) VALUES (?, 2500)", [`Phase 3-4 ${randomUUID()}`]);
  products.push(product.insertId);
  for (const size of sizes) await pool.execute("INSERT INTO ChiTietSanPham (maSP, maSize, soLuongTon) VALUES (?, ?, ?)", [product.insertId, size.maSize, stock]);
  const variant = (index = 0) => ({ maSP: product.insertId, maSize: sizes[index].maSize });
  return {
    users, productId: product.insertId, variant,
    order: (extra = {}) => ({ userId: users.user, maPTTT: methods[0].maPTTT, tenNguoiNhan: "QA", sdt: "0900000000",
      diaChiGiaoHang: "QA address", items: [{ ...variant(), soLuongMua: 1 }], ...extra }),
    async stock(index = 0) {
      const [rows] = await pool.execute("SELECT soLuongTon FROM ChiTietSanPham WHERE maSP = ? AND maSize = ?", [product.insertId, sizes[index].maSize]);
      return rows[0].soLuongTon;
    },
    async cleanup() {
      const ids = Object.values(users), placeholders = ids.map(() => "?").join(",");
      await pool.execute(`DELETE FROM DonHang WHERE id IN (${placeholders})`, ids);
      await pool.execute(`DELETE FROM PhieuNhap WHERE created_by IN (${placeholders})`, ids);
      await pool.execute(`DELETE FROM StockAdjustment WHERE actor_id IN (${placeholders})`, ids);
      for (const id of products) {
        await pool.execute("DELETE FROM InventoryMovement WHERE maSP = ?", [id]);
        await pool.execute("DELETE FROM SanPham WHERE maSP = ?", [id]);
      }
      await pool.execute(`DELETE FROM users WHERE id IN (${placeholders})`, ids);
    },
  };
}
