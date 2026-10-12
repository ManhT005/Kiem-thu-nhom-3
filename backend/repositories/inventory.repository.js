export const inventoryRepository = {
  async lockVariant(connection, maSP, maSize) {
    const [rows] = await connection.execute(
      "SELECT maSP, maSize, soLuongTon, is_active FROM ChiTietSanPham WHERE maSP = ? AND maSize = ? FOR UPDATE", [maSP, maSize]);
    return rows[0] ?? null;
  },
  async findMovement(connection, movement) {
    const [rows] = await connection.execute(
      `SELECT * FROM InventoryMovement WHERE maSP = ? AND maSize = ?
       AND event_type = ? AND reference_type = ? AND reference_id = ?`,
      [movement.maSP, movement.maSize, movement.eventType, movement.referenceType, movement.referenceId]);
    return rows[0] ?? null;
  },
  async ensureOpening(connection, variant) {
    const [rows] = await connection.execute(
      "SELECT id FROM InventoryMovement WHERE maSP = ? AND maSize = ? LIMIT 1", [variant.maSP, variant.maSize]);
    if (rows.length) return;
    await this.insertMovement(connection, { maSP: variant.maSP, maSize: variant.maSize,
      eventType: "OPENING", referenceType: "OPENING", referenceId: `${variant.maSP}:${variant.maSize}`,
      delta: variant.soLuongTon, before: 0, after: variant.soLuongTon, actorId: null, reason: "VARIANT_OPENING_BALANCE" });
  },
  async updateStock(connection, movement) {
    const [result] = await connection.execute(
      "UPDATE ChiTietSanPham SET soLuongTon = ? WHERE maSP = ? AND maSize = ? AND soLuongTon = ?",
      [movement.after, movement.maSP, movement.maSize, movement.before]);
    return result.affectedRows;
  },
  async insertMovement(connection, movement) {
    const [result] = await connection.execute(
      `INSERT INTO InventoryMovement (maSP, maSize, event_type, reference_type, reference_id,
       delta, quantity_before, quantity_after, actor_id, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [movement.maSP, movement.maSize, movement.eventType, movement.referenceType, movement.referenceId,
        movement.delta, movement.before, movement.after, movement.actorId ?? null, movement.reason]);
    return result.insertId;
  },
};
