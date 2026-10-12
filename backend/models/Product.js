import db from "../config/db.js";

const Product = {
  getAll: (callback) => {
    const sql = `
      SELECT p.*,
             COALESCE(SUM(ct.soLuongTon), 0) AS tongSoLuong
      FROM SanPham p
      LEFT JOIN ChiTietSanPham ct ON p.maSP = ct.maSP AND ct.is_active = 1
      GROUP BY p.maSP, p.tenSP, p.gia, p.moTa, p.anhSP
      ORDER BY p.maSP DESC

    `;

    db.query(sql, callback);
  },

  getById: (id, callback) => {
    // Query này lấy thông tin SP kèm thông tin Size
    const sql = `
      SELECT p.*, s.maSize, s.tenSize, ct.soLuongTon
      FROM SanPham p
      LEFT JOIN ChiTietSanPham ct ON p.maSP = ct.maSP AND ct.is_active = 1
      LEFT JOIN Size s ON ct.maSize = s.maSize
      WHERE p.maSP = ?
    `;
    db.query(sql, [id], callback);
  },

  create: (product, callback) => {
    const sql =
      "INSERT INTO SanPham (tenSP, gia, moTa, anhSP) VALUES (?, ?, ?, ?)";
    db.query(
      sql,
      [product.tenSP, product.gia, product.moTa, product.anhSP],
      callback,
    );
  },



  update: (id, product, callback) => {
    const sql =
      "UPDATE SanPham SET tenSP = ?, gia = ?, moTa = ?, anhSP = ? WHERE maSP = ?";
    db.query(
      sql,
      [product.tenSP, product.gia, product.moTa, product.anhSP, id],
      callback,
    );
  },



  delete: (id, callback) => {
    const sql = "DELETE FROM SanPham WHERE maSP = ?";
    db.query(sql, [id], callback);
  },

  getCategories: (productId, callback) => {
    const sql = `SELECT d.maDanhMuc, d.tenDanhMuc FROM SanPham_DanhMuc sd JOIN danhMuc d ON sd.maDanhMuc = d.maDanhMuc WHERE sd.maSP = ?`;
    db.query(sql, [productId], callback);
  },
  addCategory: (productId, categoryId, callback) => {
    const sql = "INSERT INTO SanPham_DanhMuc (maSP, maDanhMuc) VALUES (?, ?)";
    db.query(sql, [productId, categoryId], callback);
  },
  removeAllCategories: (productId, callback) => {
    const sql = "DELETE FROM SanPham_DanhMuc WHERE maSP = ?";
    db.query(sql, [productId], callback);
  },


};

export default Product;
