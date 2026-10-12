import Product from "../models/Product.js";
import path from "path";
import fs from "fs";
import { saveProduct } from "../services/product-write.service.js";

// ... (Giữ nguyên getProducts) ...
export const getProducts = (req, res) => {
  Product.getAll((err, result) => {
    if (err) {
      console.error("Lỗi lấy danh sách:", err);
      return res.status(500).json({ message: "Lỗi server" });
    }
    res.json({ products: result });
  });
};

// ... (SỬA HÀM getProductById) ...
export const getProductById = (req, res) => {
  const { id } = req.params;
  Product.getById(id, (err, result) => {
    if (err) return res.status(500).json({ message: "Lỗi server" });
    if (!result || result.length === 0)
      return res.status(404).json({ message: "Không tìm thấy" });

    // Gom nhóm sizes
    const firstRow = result[0];
    const product = {
      maSP: firstRow.maSP,
      tenSP: firstRow.tenSP,
      gia: firstRow.gia,
      moTa: firstRow.moTa,
      anhSP: firstRow.anhSP,
      sizes: [], // Chúng ta sẽ chứa danh sách tên size: ['S', 'M', 'L']
    };

    // --- SỬA ĐOẠN NÀY ---
    let totalStock = 0;
    result.forEach((row) => {
      if (row.tenSize) {
        // Thay vì chỉ push tên, hãy push cả OBJECT chứa thông tin size
        // Frontend cần maSize để thêm vào giỏ, và soLuongTon để kiểm tra kho
        product.sizes.push({
          maSize: row.maSize, // Cần cái này để thêm vào giỏ hàng
          tenSize: row.tenSize, // Cần cái này để hiển thị tên (S, M)
          soLuongTon: row.soLuongTon, // Cần cái này để check disable nút nếu hết hàng
        });
        totalStock += row.soLuongTon;
      }
    });
    // --------------------

    // Lấy số lượng đại diện
    product.soLuong =
      result.length > 0 && result[0].soLuongTon ? result[0].soLuongTon : 0;

    res.json({ product });
  });
};

// ... (Giữ nguyên getProductCategories) ...
export const getProductCategories = (req, res) => {
  const { id } = req.params;
  Product.getCategories(id, (err, result) => {
    if (err) return res.status(500).json({ message: "Lỗi server" });
    res.json({ categories: result });
  });
};

// ====================== THÊM SẢN PHẨM (ĐÃ SỬA) ===========================
export const createProduct = async (req, res, next) => {
  try {
    const result = await saveProduct({ ...req.body, image: req.file?.filename }, req.user.id);
    return res.status(201).json({ message: "Thêm sản phẩm thành công", ...result });
  } catch (error) { return next(error); }
};
export const updateProduct = async (req, res, next) => {
  try {
    await saveProduct({ ...req.body, image: req.file?.filename }, req.user.id, req.params.id);
    return res.json({ message: "Cập nhật sản phẩm thành công" });
  } catch (error) { return next(error); }
};

// ... (Giữ nguyên deleteProduct) ...
export const deleteProduct = (req, res) => {
  const { id } = req.params;
  Product.getById(id, (err, result) => {
    if (err) return res.status(500).json({ message: "Lỗi server" });
    if (!result || result.length === 0)
      return res.status(404).json({ message: "Không tìm thấy" });

    const product = result[0];
    Product.delete(id, (err, deleteResult) => {
      if (err) {
        if (err.code === "ER_ROW_IS_REFERENCED_2") {
          return res
            .status(409)
            .json({ message: "Không thể xóa: Sản phẩm đang có đơn hàng." });
        }
        return res.status(500).json({ message: "Lỗi xóa sản phẩm" });
      }
      if (product.anhSP) {
        try {
          const imagePath = path.join(
            process.cwd(),
            "../frontend/Asset",
            product.anhSP,
          );
          if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
        } catch (e) {}
      }
      res.json({ message: "Xóa sản phẩm thành công" });
    });
  });
};
