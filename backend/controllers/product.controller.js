import Product from "../models/Product.js";
import path from "path";
import fs from "fs";

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
export const createProduct = (req, res) => {
  // Lấy thêm biến sizes từ body
  const { tenSP, gia, moTa, categories, soLuong, sizes } = req.body;

  if (!tenSP || !gia) {
    return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin" });
  }

  let anhSP = null;
  if (req.file) anhSP = req.file.filename;

  const newProduct = { tenSP, gia: parseInt(gia), moTa: moTa || "", anhSP };

  Product.create(newProduct, (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Lỗi khi thêm sản phẩm" });
    }

    const productId = result.insertId;
    const stockQty = parseInt(soLuong) || 0;

    const saveCategoriesAndRespond = () => {
      if (categories) {
        let categoryIds = [];
        try {
          categoryIds = JSON.parse(categories);
        } catch (e) {
          categoryIds = [];
        }
        if (Array.isArray(categoryIds)) {
          categoryIds.forEach((catId) =>
            Product.addCategory(productId, catId, () => {}),
          );
        }
      }
      res.json({ message: "Thêm sản phẩm thành công", productId });
    };

    // --- PHẦN SỬA ĐỔI QUAN TRỌNG: XỬ LÝ SIZE ---
    // Thay vì fix cứng [1,2,3,4,5], ta lấy từ biến sizes frontend gửi lên
    if (sizes) {
      let sizeArray = [];
      try {
        sizeArray = JSON.parse(sizes); // Chuyển chuỗi '["S", "M"]' thành mảng
      } catch (e) {
        sizeArray = [];
      }

      if (Array.isArray(sizeArray) && sizeArray.length > 0) {
        // Gọi hàm Model mới để lưu vào ChiTietSanPham
        Product.addSizeByName(productId, sizeArray, stockQty, (err) => {
          if (err) {
            console.error("Lỗi tạo kho size:", err);
            return res
              .status(500)
              .json({ message: "Không thể lưu size và tồn kho" });
          }
          saveCategoriesAndRespond();
        });
        return;
      }
    }
    // ---------------------------------------------
    saveCategoriesAndRespond();
  });
};

// ====================== CẬP NHẬT SẢN PHẨM (ĐÃ SỬA LỖI) ===========================
export const updateProduct = (req, res) => {
  const { id } = req.params;
  const { tenSP, gia, moTa, categories, oldImage, soLuong, sizes } = req.body;

  // 1. Validation cơ bản
  if (!tenSP || !gia) {
    return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin" });
  }

  // 2. --- KHAI BÁO BIẾN anhSP (QUAN TRỌNG: SỬA LỖI TẠI ĐÂY) ---
  let anhSP = oldImage; // Mặc định lấy ảnh cũ

  // 3. Nếu có file ảnh mới được upload lên
  if (req.file) {
    anhSP = req.file.filename; // Cập nhật tên ảnh mới

    // Xóa ảnh cũ (nếu có và không phải là null/undefined)
    if (oldImage && oldImage !== "null" && oldImage !== "undefined") {
      try {
        const oldPath = path.join(process.cwd(), "../frontend/Asset", oldImage);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      } catch (err) {
        console.error("Không xóa được ảnh cũ:", err.message);
      }
    }
  }

  // 4. Tạo đối tượng update (Lúc này biến anhSP đã tồn tại nên không bị lỗi nữa)
  const updatedProduct = { tenSP, gia: parseInt(gia), moTa: moTa || "", anhSP };

  Product.update(id, updatedProduct, (err, result) => {
    if (err) {
      console.error("Lỗi update SP:", err);
      return res.status(500).json({ message: "Lỗi khi cập nhật sản phẩm" });
    }

    const stockQty = parseInt(soLuong) || 0;

    // --- XỬ LÝ SYNC SIZES (Giữ nguyên logic bạn đã sửa trước đó) ---
    if (sizes) {
      let sizeArray = [];
      try {
        sizeArray = JSON.parse(sizes);
      } catch (e) {}

      if (Array.isArray(sizeArray)) {
        Product.syncSizes(id, sizeArray, stockQty, (err) => {
          if (err) console.error("Lỗi đồng bộ size:", err);
        });
      }
    }
    // -----------------------------------------------

    if (categories) {
      let categoryIds = [];
      try {
        categoryIds = JSON.parse(categories);
      } catch (e) {}
      Product.removeAllCategories(id, (err) => {
        if (!err && Array.isArray(categoryIds)) {
          categoryIds.forEach((catId) =>
            Product.addCategory(id, catId, () => {}),
          );
        }
      });
    }

    res.json({ message: "Cập nhật sản phẩm thành công" });
  });
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
            .status(400)
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
