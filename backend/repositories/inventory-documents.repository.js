export const inventoryDocumentsRepository = {
  async lockActor(connection, actorId) {
    const [rows] = await connection.execute("SELECT id FROM users WHERE id = ? FOR UPDATE", [actorId]);
    return rows[0];
  },
  async findReceiptRequest(connection, actorId, key) {
    const [rows] = await connection.execute("SELECT * FROM PhieuNhap WHERE created_by = ? AND idempotency_key = ?", [actorId, key]);
    return rows[0];
  },
  async insertReceipt(connection, input) {
    const [result] = await connection.execute(
      `INSERT INTO PhieuNhap (maPhieu, ghiChu, created_by, total_amount, idempotency_key, request_hash)
       VALUES (?, ?, ?, ?, ?, ?)`, [input.code, input.note, input.actorId, input.total, input.key, input.hash]);
    return result.insertId;
  },
  async replaceReceiptItems(connection, id, items) {
    await connection.execute("DELETE FROM ChiTietPhieuNhap WHERE maPhieuNhap = ?", [id]);
    for (const item of items) await connection.execute(
      `INSERT INTO ChiTietPhieuNhap (maPhieuNhap, maSP, maSize, soLuongNhap, donGiaNhap, line_total)
       VALUES (?, ?, ?, ?, ?, ?)`, [id, item.maSP, item.maSize, item.soLuongNhap, item.donGiaNhap, item.line_total]);
  },
  async lockReceipt(connection, id) {
    const [rows] = await connection.execute("SELECT * FROM PhieuNhap WHERE maPhieuNhap = ? FOR UPDATE", [id]);
    return rows[0];
  },
  async receiptItems(connection, id) {
    const [rows] = await connection.execute(
      "SELECT * FROM ChiTietPhieuNhap WHERE maPhieuNhap = ? ORDER BY maSP, maSize", [id]);
    return rows;
  },
  async editReceipt(connection, id, input) {
    await connection.execute("UPDATE PhieuNhap SET ghiChu = ?, total_amount = ? WHERE maPhieuNhap = ? AND status = 'DRAFT'", [input.note, input.total, id]);
  },
  async postReceipt(connection, id, actorId) {
    const [result] = await connection.execute(
      "UPDATE PhieuNhap SET status = 'POSTED', posted_by = ?, posted_at = NOW() WHERE maPhieuNhap = ? AND status = 'DRAFT'", [actorId, id]);
    return result.affectedRows;
  },
  async findAdjustmentRequest(connection, actorId, key) {
    const [rows] = await connection.execute("SELECT * FROM StockAdjustment WHERE actor_id = ? AND idempotency_key = ?", [actorId, key]);
    return rows[0];
  },
  async insertAdjustment(connection, input) {
    const [result] = await connection.execute(
      "INSERT INTO StockAdjustment (actor_id, reason, idempotency_key, request_hash) VALUES (?, ?, ?, ?)",
      [input.actorId, input.reason, input.key, input.hash]);
    return result.insertId;
  },
};
