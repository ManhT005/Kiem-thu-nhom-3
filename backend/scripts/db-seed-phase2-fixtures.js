import "dotenv/config";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

const databaseName = process.env.DB_NAME || "";
if (!/_test$/i.test(databaseName)) {
  throw new Error("Phase 2 test fixtures require a database ending in _test");
}

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: databaseName,
});

const passwordHash = bcrypt.hashSync("Phase2Test!", 10);
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
];

try {
  const [sizes] = await connection.execute(
    "SELECT maSize FROM `Size` WHERE tenSize = 'M' LIMIT 1",
  );
  if (!sizes.length) {
    throw new Error("Run db:reset before seeding Phase 2 test fixtures");
  }

  await connection.beginTransaction();
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
      [id, sizes[0].maSize, stock],
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
