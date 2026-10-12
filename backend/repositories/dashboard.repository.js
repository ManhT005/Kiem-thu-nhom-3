import db from "../config/db.js";

// Transaction-local isolation preserves READ COMMITTED for existing write services.
export async function withReportingSnapshot(work, pool = db) {
  const connection = await pool.promise().getConnection();
  try {
    await connection.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await connection.query("START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY");
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try { await connection.rollback(); } catch { /* Preserve original failure. */ }
    throw error;
  } finally { connection.release(); }
}

export const completionEvents = `SELECT maDonHang, MIN(thoiGian) AS completedAt
  FROM LichSuDonHang WHERE trangThaiMoi = 'Hoàn thành'
    AND (lyDo IS NULL OR lyDo <> 'LEGACY_STATUS_NORMALIZED') GROUP BY maDonHang`;
const completedOrders = `FROM DonHang d JOIN (${completionEvents}) h ON h.maDonHang = d.maDonHang
  WHERE d.trangThai = 'Hoàn thành' AND h.completedAt >= ? AND h.completedAt < ?`;
const dates = filter => [filter.from, filter.to];

export const dashboardRepository = {
  async summary(connection, filter) {
    const [[money]] = await connection.execute(`SELECT COUNT(*) AS completedOrderCount,
      COALESCE(SUM(d.tongTien),0) AS completedOrderValue,
      COALESCE(SUM(d.subtotal_before_discount),0) AS grossCompletedValue,
      COALESCE(SUM(d.discount_amount),0) AS completedDiscountAmount ${completedOrders}`, dates(filter));
    const [statuses] = await connection.execute(`SELECT trangThai AS status, COUNT(*) AS count FROM DonHang
      WHERE ngayDat >= ? AND ngayDat < ? GROUP BY trangThai ORDER BY trangThai`, dates(filter));
    const [[current]] = await connection.execute(`SELECT
      (SELECT COUNT(*) FROM users WHERE role='user' AND status='ACTIVE') AS activeCustomerCount,
      (SELECT COUNT(*) FROM DonHang WHERE payment_status='REFUND_REQUIRED') AS refundRequiredCount,
      (SELECT COUNT(*) FROM DonHang d LEFT JOIN (${completionEvents}) h ON h.maDonHang=d.maDonHang
        WHERE d.trangThai='Hoàn thành' AND h.maDonHang IS NULL) AS legacyExcluded`);
    return { ...money, ...current, ordersByStatus: statuses };
  },
  async topProducts(connection, filter) {
    const sort = filter.sort === "grossSales" ? "grossSales" : "quantity";
    const [rows] = await connection.execute(`SELECT p.maSP AS productId, p.tenSP AS name,
      SUM(i.soLuongMua) AS quantity, SUM(CAST(i.giaMua AS DECIMAL(30,0))*i.soLuongMua) AS grossSales
      FROM DonHang d JOIN (${completionEvents}) h ON h.maDonHang=d.maDonHang
      JOIN ChiTietDonHang i ON i.maDonHang=d.maDonHang JOIN SanPham p ON p.maSP=i.maSP
      WHERE d.trangThai='Hoàn thành' AND h.completedAt >= ? AND h.completedAt < ?
      GROUP BY p.maSP,p.tenSP ORDER BY ${sort} DESC,p.maSP ASC LIMIT ${filter.limit}`, dates(filter));
    return rows;
  },
  async chart(connection, filter) {
    const expression = { day: "DATE(h.completedAt)", week: "DATE_SUB(DATE(h.completedAt), INTERVAL WEEKDAY(h.completedAt) DAY)",
      month: "DATE_FORMAT(h.completedAt,'%Y-%m-01')" }[filter.groupBy];
    const [rows] = await connection.execute(`SELECT CAST(${expression} AS CHAR) AS bucket,
      COUNT(*) AS completedOrderCount, SUM(d.tongTien) AS completedOrderValue ${completedOrders}
      GROUP BY bucket ORDER BY bucket`, dates(filter));
    return rows;
  },
};
