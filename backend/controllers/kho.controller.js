import db from "../config/db.js";
import { AppError } from "../utils/app-error.js";

// ------------------- LẤY DANH SÁCH KHO (GOM NHÓM THEO SP) -------------------
export const getKho = (req, res) => {
  const search = req.query.search || "";

  // LEFT JOIN để lấy cả sản phẩm chưa có size (nếu có)
  const sql = `
    SELECT p.maSP, p.tenSP, p.anhSP, s.tenSize, s.maSize, ct.soLuongTon
    FROM SanPham p
    LEFT JOIN ChiTietSanPham ct ON p.maSP = ct.maSP AND ct.is_active = 1
    LEFT JOIN Size s ON ct.maSize = s.maSize
    WHERE p.tenSP LIKE ?
    ORDER BY p.maSP DESC, s.maSize ASC
  `;

  db.query(sql, [`%${search}%`], (err, results) => {
    if (err) {
      console.error("Lỗi lấy kho:", err);
      return res.status(500).json({ error: "Lỗi server" });
    }

    // --- LOGIC GOM NHÓM (GROUP BY maSP) ---
    const productsMap = {};

    results.forEach(row => {
        if (!productsMap[row.maSP]) {
            productsMap[row.maSP] = {
                maSP: row.maSP,
                tenSP: row.tenSP,
                anhSP: row.anhSP,
                tongTonKho: 0,
                sizes: []
            };
        }
        
        // Nếu dòng này có dữ liệu size (không phải null do Left Join)
        if (row.maSize) {
            productsMap[row.maSP].sizes.push({
                maSize: row.maSize,
                tenSize: row.tenSize,
                soLuongTon: row.soLuongTon
            });
            productsMap[row.maSP].tongTonKho += row.soLuongTon;
        }
    });

    // Chuyển Map thành Array để trả về frontend
    const products = Object.values(productsMap);

    res.json({ products });
  });
};

// ------------------- CẬP NHẬT KHO (BATCH UPDATE) -------------------
export const updateKho = (_req, _res, next) => next(
  new AppError(409, "INVENTORY_ADJUSTMENT_REQUIRED", "Use inventory adjustments with a reason and an idempotency key"),
);
