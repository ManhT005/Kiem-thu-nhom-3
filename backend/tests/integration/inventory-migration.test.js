import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import mysql from "mysql2/promise";
import { randomUUID } from "node:crypto";
import { applyMigrations } from "../../scripts/migration-runner.js";
import { rollbackInventoryMigration } from "../../scripts/inventory-rollback.js";
import { integrationEnabled } from "./fixture-helper.js";
test("legacy migration adoption, opening backfill, replay and test-only up/down preserve stock", { skip: !integrationEnabled }, async () => {
  const name = "migration_" + randomUUID().replaceAll("-","") + "_test";
  const connection = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, multipleStatements: true });
  try {
    await connection.query(`CREATE DATABASE \`${name}\``);
    await connection.query(`USE \`${name}\``);
    await applyMigrations(connection, { through: 4 });
    await connection.query("DROP TABLE schema_migrations");
    await connection.execute("INSERT INTO SanPham (maSP, tenSP, gia) VALUES (1, 'Legacy', 1000)");
    await connection.execute("INSERT INTO `Size` (maSize, tenSize) VALUES (1, 'M')");
    await connection.execute("INSERT INTO ChiTietSanPham (maSP, maSize, soLuongTon) VALUES (1, 1, 7)");
    await applyMigrations(connection, { through: 5 });
    await applyMigrations(connection, { through: 5 });
    const [[opening]] = await connection.query("SELECT COUNT(*) AS count, SUM(delta) AS quantity FROM InventoryMovement");
    assert.equal(opening.count,1); assert.equal(Number(opening.quantity),7);
    await rollbackInventoryMigration(connection);
    const [[stock]] = await connection.query("SELECT soLuongTon FROM ChiTietSanPham");
    assert.equal(stock.soLuongTon,7);
    await applyMigrations(connection, { through: 5 });
    const [[replayed]] = await connection.query("SELECT COUNT(*) AS count FROM InventoryMovement");
    assert.equal(replayed.count,1);
  } finally {
    // Only the fresh, validated generated test-schema name is ever dropped.
    assert.match(name,/^migration_[a-f0-9]{32}_test$/);
    await connection.query(`DROP DATABASE IF EXISTS \`${name}\``);
    await connection.end();
  }
});
