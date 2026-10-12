// Intentionally test-only: production rollback cannot silently remove account security or voucher accounting.
export async function rollbackLifecycleVoucherMigration(connection) {
  const [[database]]=await connection.query("SELECT DATABASE() AS name");
  if(!/_test$/i.test(database.name||""))throw new Error("Lifecycle rollback requires a *_test database");
  const [[later]]=await connection.query("SELECT COUNT(*) AS count FROM schema_migrations WHERE name > '006_user_lifecycle_voucher.sql'");
  if(later.count)throw new Error("Roll back later migrations first");
  const [[users]]=await connection.query("SELECT COUNT(*) AS count FROM users WHERE status <> 'ACTIVE' OR token_version <> 0");
  const [[redemptions]]=await connection.query("SELECT COUNT(*) AS count FROM VoucherRedemption");
  const [[userAudit]]=await connection.query("SELECT COUNT(*) AS count FROM UserLifecycleAudit");
  const [[voucherAudit]]=await connection.query("SELECT COUNT(*) AS count FROM VoucherAudit");
  const [[newVouchers]]=await connection.query("SELECT COUNT(*) AS count FROM GiamGia WHERE code NOT LIKE 'LEGACY-%'");
  const [[totals]]=await connection.query("SELECT COUNT(*) AS count FROM DonHang WHERE tongTien > 2147483647 OR discount_amount <> 0");
  if(users.count||redemptions.count||userAudit.count||voucherAudit.count||newVouchers.count||totals.count)throw new Error("Business lifecycle/voucher data prevents rollback");
  await connection.query("DROP TABLE VoucherRedemption, VoucherAudit, UserLifecycleAudit");
  await connection.query("ALTER TABLE users DROP INDEX idx_users_role_status, DROP COLUMN status, DROP COLUMN token_version");
  await connection.query("ALTER TABLE DonHang DROP COLUMN subtotal_before_discount, DROP COLUMN discount_amount, DROP COLUMN voucher_code_snapshot, MODIFY tongTien INT NULL DEFAULT 0");
  await connection.query(`ALTER TABLE GiamGia DROP CHECK chk_voucher_value, DROP CHECK chk_voucher_money,
    DROP COLUMN code, DROP COLUMN discount_type, DROP COLUMN discount_value, DROP COLUMN minimum_order_amount,
    DROP COLUMN maximum_discount_amount, DROP COLUMN start_at, DROP COLUMN end_at, DROP COLUMN usage_limit,
    DROP COLUMN used_count, DROP COLUMN per_user_limit, DROP COLUMN enabled, DROP COLUMN created_at, DROP COLUMN updated_at`);
  await connection.execute("DELETE FROM schema_migrations WHERE name='006_user_lifecycle_voucher.sql'");
}
