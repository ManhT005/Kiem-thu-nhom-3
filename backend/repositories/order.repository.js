const ORDER_ROWS_SELECT = `
  SELECT
    d.maDonHang, d.ngayDat, d.trangThai, d.tongTien, d.tenNguoiNhan,
    d.sdt, d.diaChiGiaoHang, d.ghiChu,
    c.maSP, c.maSize, c.soLuongMua, c.giaMua,
    s.tenSP, s.anhSP, sz.tenSize
  FROM DonHang d
  LEFT JOIN ChiTietDonHang c ON d.maDonHang = c.maDonHang
  LEFT JOIN SanPham s ON c.maSP = s.maSP
  LEFT JOIN \`Size\` sz ON c.maSize = sz.maSize`;

const buildOrderFilters = (filters) => {
  const conditions = [];
  const values = [];

  if (filters.trangThai) {
    conditions.push("d.trangThai = ?");
    values.push(filters.trangThai);
  }
  if (filters.fromDate) {
    conditions.push("d.ngayDat >= ?");
    values.push(filters.fromDate);
  }
  if (filters.toDate) {
    conditions.push("d.ngayDat < DATE_ADD(?, INTERVAL 1 DAY)");
    values.push(filters.toDate);
  }
  if (filters.minTotal !== undefined) {
    conditions.push("d.tongTien >= ?");
    values.push(filters.minTotal);
  }
  if (filters.maxTotal !== undefined) {
    conditions.push("d.tongTien <= ?");
    values.push(filters.maxTotal);
  }
  if (filters.keyword) {
    const keyword = `%${String(filters.keyword).replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(
      "(CAST(d.maDonHang AS CHAR) LIKE ? OR d.tenNguoiNhan LIKE ? OR d.sdt LIKE ?)",
    );
    values.push(keyword, keyword, keyword);
  }

  return {
    clause: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    values,
  };
};

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

  async lockOrder(connection, orderId) {
    const [rows] = await connection.execute(
      "SELECT maDonHang, id, trangThai FROM DonHang WHERE maDonHang = ? FOR UPDATE",
      [orderId],
    );
    return rows[0] ?? null;
  },

  async getOrderItems(connection, orderId) {
    const [rows] = await connection.execute(
      `SELECT maSP, maSize, soLuongMua
       FROM ChiTietDonHang
       WHERE maDonHang = ?
       ORDER BY maSP, maSize
       FOR UPDATE`,
      [orderId],
    );
    return rows;
  },

  async restoreStock(connection, item) {
    const [result] = await connection.execute(
      `UPDATE ChiTietSanPham
       SET soLuongTon = soLuongTon + ?
       WHERE maSP = ? AND maSize = ?`,
      [item.soLuongMua, item.maSP, item.maSize],
    );
    return result.affectedRows;
  },

  async updateOrderStatus(connection, orderId, status) {
    const [result] = await connection.execute(
      "UPDATE DonHang SET trangThai = ? WHERE maDonHang = ?",
      [status, orderId],
    );
    return result.affectedRows;
  },

  async getMyOrderRows(executor, userId) {
    const [rows] = await executor.execute(
      `${ORDER_ROWS_SELECT}
       WHERE d.id = ?
       ORDER BY d.ngayDat DESC, d.maDonHang DESC`,
      [userId],
    );
    return rows;
  },

  async getAllOrderRows(executor) {
    const [rows] = await executor.execute(
      `${ORDER_ROWS_SELECT}
       ORDER BY d.ngayDat DESC, d.maDonHang DESC`,
    );
    return rows;
  },

  async getOrderOwner(executor, orderId) {
    const [rows] = await executor.execute(
      "SELECT maDonHang, id FROM DonHang WHERE maDonHang = ?",
      [orderId],
    );
    return rows[0] ?? null;
  },

  async getOrderHistory(executor, orderId) {
    const [rows] = await executor.execute(
      `SELECT h.maLichSu, h.maDonHang, h.trangThaiCu, h.trangThaiMoi,
              h.nguoiThayDoi, u.ten AS tenNguoiThayDoi, h.lyDo, h.thoiGian
       FROM LichSuDonHang h
       LEFT JOIN users u ON u.id = h.nguoiThayDoi
       WHERE h.maDonHang = ?
       ORDER BY h.thoiGian ASC, h.maLichSu ASC`,
      [orderId],
    );
    return rows;
  },

  async getFilteredOrderPage(executor, filters, { limit, offset }) {
    const { clause, values } = buildOrderFilters(filters);
    const [countRows] = await executor.execute(
      `SELECT COUNT(*) AS total FROM DonHang d ${clause}`,
      values,
    );
    const total = Number(countRows[0]?.total || 0);
    if (total === 0) return { rows: [], total };

    const queryMethod = executor.query
      ? executor.query.bind(executor)
      : executor.execute.bind(executor);
    const [orderRows] = await queryMethod(
      `SELECT d.maDonHang
       FROM DonHang d
       ${clause}
       ORDER BY d.ngayDat DESC, d.maDonHang DESC
       LIMIT ? OFFSET ?`,
      [...values, limit, offset],
    );
    const orderIds = orderRows.map((row) => row.maDonHang);
    if (orderIds.length === 0) return { rows: [], total };

    const placeholders = orderIds.map(() => "?").join(", ");
    const [rows] = await executor.execute(
      `${ORDER_ROWS_SELECT}
       WHERE d.maDonHang IN (${placeholders})
       ORDER BY d.ngayDat DESC, d.maDonHang DESC, c.maSP, c.maSize`,
      orderIds,
    );
    return { rows, total };
  },
};
