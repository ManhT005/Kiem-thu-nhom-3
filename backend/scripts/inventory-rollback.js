// Test-only rollback: production rollback must be reviewed against applied business events.
export async function rollbackInventoryMigration(connection) {
  const [[database]] = await connection.query("SELECT DATABASE() AS name");
  if (!/_test$/i.test(database.name || "")) throw new Error("Inventory rollback is only allowed on *_test databases");
  const [[later]] = await connection.execute("SELECT COUNT(*) AS count FROM schema_migrations WHERE name > '005_inventory_goods_receipt.sql'");
  if (later.count) throw new Error("Roll back later migrations first");
  const [[events]] = await connection.query("SELECT COUNT(*) AS count FROM InventoryMovement WHERE event_type <> 'OPENING'");
  const [[receipts]] = await connection.query("SELECT COUNT(*) AS count FROM PhieuNhap");
  if (events.count || receipts.count) throw new Error("Business inventory data prevents rollback");
  await connection.query("DROP TABLE InventoryMovement, ChiTietPhieuNhap, PhieuNhap, StockAdjustment");
  await connection.query("ALTER TABLE ChiTietSanPham DROP CHECK chk_variant_stock, DROP COLUMN is_active, MODIFY soLuongTon INT NULL DEFAULT 0");
  await connection.execute("DELETE FROM schema_migrations WHERE name = '005_inventory_goods_receipt.sql'");
}
