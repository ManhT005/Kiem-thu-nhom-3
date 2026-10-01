export const orderRepository = {
  async findPaymentMethod(connection, paymentMethodId) {
    const [rows] = await connection.execute(
      "SELECT maPTTT FROM phuongThucThanhToan WHERE maPTTT = ?",
      [paymentMethodId],
    );
    return rows[0] ?? null;
  },

  async lockVariant(connection, productId, sizeId) {
    const [rows] = await connection.execute(
      `SELECT sp.maSP, sp.gia, ct.maSize, ct.soLuongTon
       FROM SanPham sp
       JOIN ChiTietSanPham ct ON ct.maSP = sp.maSP
       WHERE sp.maSP = ? AND ct.maSize = ?
       FOR UPDATE`,
      [productId, sizeId],
    );
    return rows[0] ?? null;
  },

  async insertOrder(connection, order) {
    const [result] = await connection.execute(
      `INSERT INTO DonHang
       (id, tenNguoiNhan, sdt, diaChiGiaoHang, ghiChu, tongTien, maPTTT, trangThai)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        order.userId,
        order.tenNguoiNhan,
        order.sdt,
        order.diaChiGiaoHang,
        order.ghiChu,
        order.tongTien,
        order.maPTTT,
        order.trangThai,
      ],
    );
    return result.insertId;
  },

  async insertOrderItem(connection, orderId, item) {
    await connection.execute(
      `INSERT INTO ChiTietDonHang
       (maDonHang, maSP, maSize, soLuongMua, giaMua)
       VALUES (?, ?, ?, ?, ?)`,
      [orderId, item.maSP, item.maSize, item.soLuongMua, item.giaMua],
    );
  },

  async reduceStock(connection, item) {
    const [result] = await connection.execute(
      `UPDATE ChiTietSanPham
       SET soLuongTon = soLuongTon - ?
       WHERE maSP = ? AND maSize = ? AND soLuongTon >= ?`,
      [item.soLuongMua, item.maSP, item.maSize, item.soLuongMua],
    );
    return result.affectedRows;
  },

  async lockCart(connection, userId) {
    const [rows] = await connection.execute(
      "SELECT maGioHang FROM GioHang WHERE userId = ? ORDER BY maGioHang LIMIT 1 FOR UPDATE",
      [userId],
    );
    return rows[0]?.maGioHang ?? null;
  },

  async removeCartItem(connection, cartId, item) {
    await connection.execute(
      "DELETE FROM ChiTietGioHang WHERE maGioHang = ? AND maSP = ? AND maSize = ?",
      [cartId, item.maSP, item.maSize],
    );
  },

  async insertHistory(connection, history) {
    await connection.execute(
      `INSERT INTO LichSuDonHang
       (maDonHang, trangThaiCu, trangThaiMoi, nguoiThayDoi, lyDo)
       VALUES (?, ?, ?, ?, ?)`,
      [
        history.orderId,
        history.previousStatus,
        history.newStatus,
        history.actorId,
        history.reason,
      ],
    );
  },
};