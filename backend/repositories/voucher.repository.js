export const voucherRepository = {
  async lockByCode(connection, code) {
    const [rows] = await connection.execute("SELECT * FROM GiamGia WHERE code = ? FOR UPDATE", [code]);
    return rows[0] ?? null;
  },
  async lockById(connection, id) {
    const [rows] = await connection.execute("SELECT * FROM GiamGia WHERE maGiamGia = ? FOR UPDATE", [id]);
    return rows[0] ?? null;
  },
  async userUses(connection, voucherId, userId) {
    const [[row]] = await connection.execute(
      "SELECT COUNT(*) AS count FROM VoucherRedemption WHERE voucher_id = ? AND user_id = ? AND status IN ('RESERVED','COMMITTED')", [voucherId,userId]);
    return Number(row.count);
  },
  async insertRedemption(connection, input) {
    await connection.execute("INSERT INTO VoucherRedemption (voucher_id, order_id, user_id, discount_amount) VALUES (?, ?, ?, ?)",
      [input.voucherId,input.orderId,input.userId,input.discountAmount]);
    const [result] = await connection.execute("UPDATE GiamGia SET used_count = used_count + 1 WHERE maGiamGia = ? AND (usage_limit IS NULL OR used_count < usage_limit)", [input.voucherId]);
    return result.affectedRows;
  },
  async redemption(connection, orderId, lock = false) {
    const [rows] = await connection.execute("SELECT * FROM VoucherRedemption WHERE order_id = ?" + (lock ? " FOR UPDATE" : ""), [orderId]);
    return rows[0] ?? null;
  },
  async changeRedemption(connection, orderId, status) {
    const [result] = await connection.execute(
      "UPDATE VoucherRedemption SET status = ?, released_at = CASE WHEN ? = 'RELEASED' THEN NOW(3) ELSE NULL END WHERE order_id = ? AND status = 'RESERVED'", [status,status,orderId]);
    return result.affectedRows;
  },
  async releaseUsage(connection, voucherId) {
    const [result] = await connection.execute("UPDATE GiamGia SET used_count = used_count - 1 WHERE maGiamGia = ? AND used_count > 0", [voucherId]);
    return result.affectedRows;
  },
  async save(connection, voucher, id = null) {
    const fields = [voucher.code,voucher.discount_type,voucher.discount_value,voucher.minimum_order_amount,voucher.maximum_discount_amount,
      voucher.start_at,voucher.end_at,voucher.usage_limit,voucher.per_user_limit,voucher.enabled ? 1 : 0,voucher.moTa,
      voucher.discount_type === "PERCENT" ? Math.floor(Number(voucher.discount_value)) : 0,
      voucher.start_at.toISOString().slice(0,10),voucher.end_at.toISOString().slice(0,10)];
    if (id) {
      await connection.execute(
        `UPDATE GiamGia SET code=?, discount_type=?, discount_value=?, minimum_order_amount=?, maximum_discount_amount=?,
        start_at=?, end_at=?, usage_limit=?, per_user_limit=?, enabled=?, moTa=?, chietKhau=?, ngayBatDau=?, ngayKetThuc=? WHERE maGiamGia=?`, [...fields,id]);
      return id;
    }
    const [result] = await connection.execute(
      `INSERT INTO GiamGia (code,discount_type,discount_value,minimum_order_amount,maximum_discount_amount,
      start_at,end_at,usage_limit,per_user_limit,enabled,moTa,chietKhau,ngayBatDau,ngayKetThuc) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, fields);
    return result.insertId;
  },
  async audit(connection, id, actorId, operation, before, after) {
    await connection.execute("INSERT INTO VoucherAudit (voucher_id, actor_id, operation, before_state, after_state) VALUES (?, ?, ?, ?, ?)",
      [id,actorId,operation,before ? JSON.stringify(before) : null,JSON.stringify(after)]);
  },
};
