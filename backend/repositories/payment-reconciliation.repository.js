// Aggregate attempts BEFORE joining orders; historical failed attempts are valid.
const flags = `WITH attempts AS (
  SELECT maDonHang, COUNT(*) AS attemptCount, SUM(status='PAID') AS paidCount,
    SUM(amount <> (SELECT tongTien FROM DonHang WHERE maDonHang=t.maDonHang)) AS amountMismatch
  FROM MomoPaymentTransaction t GROUP BY maDonHang
), exceptions AS (
  SELECT d.maDonHang AS orderId,d.trangThai AS orderStatus,d.payment_status AS paymentStatus,
    CAST(d.tongTien AS CHAR) AS orderValue,d.ngayDat AS createdAt,COALESCE(a.attemptCount,0) AS attemptCount,
    d.payment_status='REFUND_REQUIRED' AS refundRequired,
    ((COALESCE(a.paidCount,0)>0 AND d.payment_status NOT IN ('PAID','REFUND_REQUIRED'))
      OR (d.payment_status='PAID' AND m.tenPTTT='MOMO' AND COALESCE(a.paidCount,0)=0)
      OR (d.payment_status='PAID' AND d.trangThai='Đã hủy')) AS paymentMismatch,
    COALESCE(a.amountMismatch,0)>0 AS amountMismatch,COALESCE(a.paidCount,0)>1 AS multiplePaid,
    ((v.status='RELEASED' AND d.trangThai <> 'Đã hủy')
      OR (v.status='RESERVED' AND (d.trangThai='Hoàn thành' OR d.payment_status='PAID'))
      OR (d.maGiamGia IS NOT NULL AND v.order_id IS NULL)
      OR (v.status IN ('RESERVED','COMMITTED') AND d.trangThai='Đã hủy' AND d.payment_status <> 'REFUND_REQUIRED')) AS voucherMismatch
  FROM DonHang d LEFT JOIN attempts a ON a.maDonHang=d.maDonHang
  LEFT JOIN phuongThucThanhToan m ON m.maPTTT=d.maPTTT LEFT JOIN VoucherRedemption v ON v.order_id=d.maDonHang
  WHERE d.ngayDat >= ? AND d.ngayDat < ?
)`;
const columns = { REFUND_REQUIRED: "refundRequired", PAYMENT_MISMATCH: "paymentMismatch", AMOUNT_MISMATCH: "amountMismatch", MULTIPLE_PAID: "multiplePaid", VOUCHER_MISMATCH: "voucherMismatch" };
const any = Object.values(columns).map(column => `${column}=1`).join(" OR ");
export const reconciliationRepository = {
  async list(connection, filter) {
    const where = filter.status === "ALL" ? `(${any})` : `${columns[filter.status]}=1`;
    const args = [filter.from,filter.to];
    const [[count]] = await connection.execute(`${flags} SELECT COUNT(*) AS total FROM exceptions WHERE ${where}`,args);
    const [items] = await connection.execute(`${flags} SELECT * FROM exceptions WHERE ${where}
      ORDER BY createdAt DESC,orderId DESC LIMIT ${filter.limit} OFFSET ${(filter.page-1)*filter.limit}`,args);
    return { total: count.total, items };
  },
  async summary(connection, filter) {
    const [[row]] = await connection.execute(`${flags} SELECT COUNT(*) AS total,
      ${Object.entries(columns).map(([name,column]) => `COALESCE(SUM(${column}=1),0) AS ${name}`).join(",")}
      FROM exceptions WHERE ${any}`,[filter.from,filter.to]);
    return row;
  },
};
export const reconciliationReasons = row => Object.entries(columns).filter(([,column])=>Number(row[column])===1).map(([name])=>name);
