import "dotenv/config";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

const databaseName = process.env.DB_NAME || "";
if (!/_test$/i.test(databaseName)) {
  throw new Error("Phase 2 test fixtures require a database ending in _test");
}

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: databaseName,
});

const passwordHash = bcrypt.hashSync("Phase2Test!", 10);
const sizeId = 92901;
const paymentMethodId = 92901;
const users = [
  [92001, "Phase 2 User A", "phase2-user-a@example.test", "user"],
  [92002, "Phase 2 User B", "phase2-user-b@example.test", "user"],
  [92003, "Phase 2 Staff", "phase2-staff@example.test", "staff"],
  [92004, "Phase 2 Admin", "phase2-admin@example.test", "admin"],
];
const products = [
  [93001, "Phase 2 stock 0", 1000, 0],
  [93002, "Phase 2 stock 1", 2000, 1],
  [93003, "Phase 2 stock 5", 3000, 5],
  [93004, "Phase 2 stock 10", 4000, 10],
  [93005, "Phase 2 stock 0 second item", 5000, 0],
];

try {
  await connection.beginTransaction();
  await connection.execute(
    `INSERT INTO \`Size\` (maSize, tenSize) VALUES (?, 'P2-M')
     ON DUPLICATE KEY UPDATE tenSize = VALUES(tenSize)`,
    [sizeId],
  );
  await connection.execute(
    `INSERT INTO phuongThucThanhToan (maPTTT, tenPTTT)
     VALUES (?, 'P2_COD')
     ON DUPLICATE KEY UPDATE tenPTTT = VALUES(tenPTTT)`,
    [paymentMethodId],
  );
  await connection.execute("DELETE FROM DonHang WHERE id IN (92001, 92002)");

  for (const [id, name, email, role] of users) {
    await connection.execute(
      `INSERT INTO users (id, ten, email, sdt, matKhau, role)
       VALUES (?, ?, ?, '0900000000', ?, ?)
       ON DUPLICATE KEY UPDATE ten = VALUES(ten), email = VALUES(email),
         sdt = VALUES(sdt), matKhau = VALUES(matKhau), role = VALUES(role)`,
      [id, name, email, passwordHash, role],
    );
  }

  for (const [id, name, price, stock] of products) {
    await connection.execute(
      `INSERT INTO SanPham (maSP, tenSP, gia, moTa, anhSP)
       VALUES (?, ?, ?, 'Phase 2 test fixture', NULL)
       ON DUPLICATE KEY UPDATE tenSP = VALUES(tenSP), gia = VALUES(gia),
         moTa = VALUES(moTa), anhSP = VALUES(anhSP)`,
      [id, name, price],
    );
    await connection.execute(
      `INSERT INTO ChiTietSanPham (maSP, maSize, soLuongTon)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE soLuongTon = VALUES(soLuongTon)`,
      [id, sizeId, stock],
    );
  }
  await connection.commit();
  console.log("Phase 2 test fixtures seeded (password: Phase2Test!).");
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
