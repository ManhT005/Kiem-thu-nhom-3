import { withTransaction } from "../utils/transaction.js";
import { AppError } from "../utils/app-error.js";
import { integer, invalid } from "../domain/inventory.js";
import { inventoryRepository } from "../repositories/inventory.repository.js";

function jsonList(value, name) {
  if (value === undefined) return undefined;
  let parsed = value;
  if (typeof value === "string") { try { parsed = JSON.parse(value); } catch { invalid(`Invalid ${name}`); } }
  if (!Array.isArray(parsed) || parsed.length > 100) invalid(`Invalid ${name}`);
  return parsed;
}
export async function saveProduct(input, actorId, id = null) {
  if (typeof input.tenSP !== "string" || !input.tenSP.trim() || input.tenSP.length > 150) invalid("Invalid product name");
  const price = integer(input.gia, "gia", 1);
  const sizes = jsonList(input.sizes, "sizes");
  const categories = jsonList(input.categories, "categories")?.map((value) => integer(value, "category"));
  if (categories && new Set(categories).size !== categories.length) invalid("Duplicate categories");
  if (input.soLuong !== undefined && integer(input.soLuong, "soLuong", 0) !== 0) invalid("Use a goods receipt to add stock");
  return withTransaction(async (connection) => {
    if (id) {
      id = integer(id, "product id");
      const [rows] = await connection.execute("SELECT * FROM SanPham WHERE maSP = ? FOR UPDATE", [id]);
      if (!rows.length) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
      await connection.execute("UPDATE SanPham SET tenSP = ?, gia = ?, moTa = ?, anhSP = ? WHERE maSP = ?",
        [input.tenSP.trim(), price, input.moTa || "", input.image ?? rows[0].anhSP, id]);
    } else {
      const [result] = await connection.execute("INSERT INTO SanPham (tenSP, gia, moTa, anhSP) VALUES (?, ?, ?, ?)",
        [input.tenSP.trim(), price, input.moTa || "", input.image ?? null]);
      id = result.insertId;
    }
    if (sizes) {
      const names = sizes.map((size) => typeof size === "string" ? size : size?.tenSize);
      if (names.some((name) => typeof name !== "string" || !name) || new Set(names).size !== names.length) invalid("Invalid or duplicate sizes");
      const [allSizes] = await connection.execute("SELECT maSize, tenSize FROM `Size` ORDER BY maSize");
      const selected = allSizes.filter((size) => names.includes(size.tenSize));
      if (selected.length !== names.length) invalid("Unknown size name");
      const [variants] = await connection.execute("SELECT * FROM ChiTietSanPham WHERE maSP = ? ORDER BY maSize FOR UPDATE", [id]);
      for (const variant of variants) {
        const active = selected.some((size) => size.maSize === variant.maSize);
        if (!active && variant.soLuongTon !== 0) throw new AppError(409, "VARIANT_HAS_STOCK", "Receive/adjust stock to zero before disabling a variant");
        await connection.execute("UPDATE ChiTietSanPham SET is_active = ? WHERE maSP = ? AND maSize = ?", [active ? 1 : 0, id, variant.maSize]);
      }
      for (const size of selected) {
        const requested = sizes.find((item) => (typeof item === "string" ? item : item.tenSize) === size.tenSize);
        const existing = variants.find((item) => item.maSize === size.maSize);
        if (typeof requested === "object" && requested.soLuongTon !== undefined &&
            integer(requested.soLuongTon, "soLuongTon", 0) !== (existing?.soLuongTon ?? 0)) {
          invalid("Product editing cannot change inventory; use receipts or adjustments");
        }
        if (!existing) {
          await connection.execute("INSERT INTO ChiTietSanPham (maSP, maSize, soLuongTon) VALUES (?, ?, 0)", [id, size.maSize]);
          await inventoryRepository.ensureOpening(connection, { maSP: id, maSize: size.maSize, soLuongTon: 0 });
        }
      }
    }
    if (categories) {
      await connection.execute("DELETE FROM SanPham_DanhMuc WHERE maSP = ?", [id]);
      for (const category of categories) await connection.execute("INSERT INTO SanPham_DanhMuc VALUES (?, ?)", [id, category]);
    }
    return { productId: id };
  });
}
