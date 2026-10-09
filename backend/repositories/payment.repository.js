export const paymentRepository = {
  async lockOrder(connection, orderId) {
    const [rows] = await connection.execute(
      `SELECT d.maDonHang, d.id, d.maPTTT, d.trangThai, d.tongTien,
              d.payment_status, d.payment_expires_at, p.tenPTTT
       FROM DonHang d
       JOIN phuongThucThanhToan p ON p.maPTTT = d.maPTTT
       WHERE d.maDonHang = ?
       FOR UPDATE`,
      [orderId],
    );
    return rows[0] ?? null;
  },

  async findOrderTransaction(connection, orderId) {
    const [rows] = await connection.execute(
      `SELECT id, maDonHang, provider_order_id, request_id, amount, status,
              trans_id, pay_url, expires_at
       FROM MomoPaymentTransaction
       WHERE maDonHang = ?
       ORDER BY id DESC
       LIMIT 1
       FOR UPDATE`,
      [orderId],
    );
    return rows[0] ?? null;
  },

  async insertTransaction(connection, payment) {
    const [result] = await connection.execute(
      `INSERT INTO MomoPaymentTransaction
       (maDonHang, provider_order_id, request_id, amount, status, expires_at)
       VALUES (?, ?, ?, ?, 'PENDING', ?)`,
      [
        payment.orderId,
        payment.providerOrderId,
        payment.requestId,
        payment.amount,
        payment.expiresAt,
      ],
    );
    return result.insertId;
  },

  async savePaymentUrl(executor, transactionId, payUrl) {
    await executor.execute(
      "UPDATE MomoPaymentTransaction SET pay_url = ? WHERE id = ? AND status = 'PENDING'",
      [payUrl, transactionId],
    );
  },

  async findOrderIdByProviderOrderId(executor, providerOrderId) {
    const [rows] = await executor.execute(
      `SELECT id, maDonHang
       FROM MomoPaymentTransaction
       WHERE provider_order_id = ?`,
      [providerOrderId],
    );
    return rows[0] ?? null;
  },

  async lockTransaction(connection, transactionId) {
    const [rows] = await connection.execute(
      `SELECT id, maDonHang, provider_order_id, request_id, amount, status,
              trans_id, expires_at
       FROM MomoPaymentTransaction
       WHERE id = ?
       FOR UPDATE`,
      [transactionId],
    );
    return rows[0] ?? null;
  },

  async updateTransaction(connection, transactionId, { status, transId = null }) {
    await connection.execute(
      `UPDATE MomoPaymentTransaction
       SET status = ?, trans_id = ?
       WHERE id = ?`,
      [status, transId, transactionId],
    );
  },

  async updateOrderPaymentStatus(connection, orderId, paymentStatus) {
    await connection.execute(
      "UPDATE DonHang SET payment_status = ? WHERE maDonHang = ?",
      [paymentStatus, orderId],
    );
  },

  async confirmPaidOrder(connection, orderId) {
    const [result] = await connection.execute(
      `UPDATE DonHang
       SET payment_status = 'PAID', trangThai = 'Đã xác nhận'
       WHERE maDonHang = ? AND payment_status = 'PENDING'
         AND trangThai = 'Chờ xác nhận'`,
      [orderId],
    );
    return result.affectedRows;
  },

  async updateOrderForRefund(connection, orderId) {
    await connection.execute(
      "UPDATE DonHang SET payment_status = 'REFUND_REQUIRED' WHERE maDonHang = ?",
      [orderId],
    );
  },

  async findExpiredTransactions(executor, limit = 100) {
    const [rows] = await executor.execute(
      `SELECT d.maDonHang, MAX(t.id) AS id
       FROM DonHang d
       LEFT JOIN MomoPaymentTransaction t
         ON t.maDonHang = d.maDonHang AND t.status = 'PENDING'
       WHERE d.payment_status = 'PENDING'
         AND d.payment_expires_at <= NOW()
       GROUP BY d.maDonHang
       ORDER BY d.payment_expires_at, d.maDonHang
       LIMIT ?`,
      [limit],
    );
    return rows;
  },

  async findExpiredTransactionForOrder(executor, orderId) {
    const [rows] = await executor.execute(
      `SELECT d.maDonHang, MAX(t.id) AS id
       FROM DonHang d
       LEFT JOIN MomoPaymentTransaction t
         ON t.maDonHang = d.maDonHang AND t.status = 'PENDING'
       WHERE d.maDonHang = ? AND d.payment_status = 'PENDING'
         AND d.payment_expires_at <= NOW()
       GROUP BY d.maDonHang
       LIMIT 1`,
      [orderId],
    );
    return rows[0] ?? null;
  },

  async getOrderPaymentStatus(executor, orderId) {
    const [rows] = await executor.execute(
      `SELECT maDonHang, id, trangThai, payment_status, payment_expires_at
       FROM DonHang
       WHERE maDonHang = ?`,
      [orderId],
    );
    return rows[0] ?? null;
  },
};
