import { randomUUID, createHash } from "node:crypto";
import db from "../config/db.js";
import { withTransaction } from "../utils/transaction.js";
import { AppError } from "../utils/app-error.js";
import { receiptItems, integer, reason, requestKey, uniqueVariants, MAX_STOCK, listFilters, invalid } from "../domain/inventory.js";
import { inventoryRepository } from "../repositories/inventory.repository.js";
import { inventoryDocumentsRepository as documents } from "../repositories/inventory-documents.repository.js";
import { applyMovement } from "./inventory.service.js";

const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const receiptInput = (input) => ({ ...receiptItems(input.items), note: reason(input.note, false) });
async function verifyVariants(connection, items) {
  for (const item of items) {
    const variant = await inventoryRepository.lockVariant(connection, item.maSP, item.maSize);
    if (!variant) throw new AppError(404, "INVENTORY_VARIANT_NOT_FOUND", "Product variant not found");
    if (!variant.is_active) throw new AppError(409, "VARIANT_INACTIVE", "Variant is inactive");
  }
}
export async function createReceipt(input, transaction = withTransaction) {
  const normalized = receiptInput(input);
  const key = requestKey(input.idempotencyKey);
  const fingerprint = hash(normalized);
  return transaction(async (connection) => {
    if (!await documents.lockActor(connection, input.actorId)) throw new AppError(401, "UNAUTHENTICATED", "Actor not found");
    if (key) {
      const existing = await documents.findReceiptRequest(connection, input.actorId, key);
      if (existing) {
        if (existing.request_hash !== fingerprint) throw new AppError(409, "IDEMPOTENCY_CONFLICT", "Receipt key has a different payload");
        return { ...existing, items: await documents.receiptItems(connection, existing.maPhieuNhap), duplicate: true };
      }
    }
    await verifyVariants(connection, normalized.items);
    const id = await documents.insertReceipt(connection, { ...normalized, actorId: input.actorId, code: `GR-${randomUUID()}`, key, hash: fingerprint });
    await documents.replaceReceiptItems(connection, id, normalized.items);
    return { ...await documents.lockReceipt(connection, id), items: normalized.items, duplicate: false };
  });
}
export async function editReceipt(id, input, transaction = withTransaction) {
  id = integer(id, "receipt id");
  const normalized = receiptInput(input);
  return transaction(async (connection) => {
    const header = await documents.lockReceipt(connection, id);
    if (!header) throw new AppError(404, "RECEIPT_NOT_FOUND", "Receipt not found");
    if (header.status !== "DRAFT") throw new AppError(409, "RECEIPT_IMMUTABLE", "Posted receipts cannot be changed");
    await verifyVariants(connection, normalized.items);
    await documents.editReceipt(connection, id, normalized);
    await documents.replaceReceiptItems(connection, id, normalized.items);
    return { ...header, ghiChu: normalized.note, total_amount: normalized.total, items: normalized.items };
  });
}
export async function postReceipt(id, actorId, transaction = withTransaction) {
  id = integer(id, "receipt id");
  return transaction(async (connection) => {
    const header = await documents.lockReceipt(connection, id);
    if (!header) throw new AppError(404, "RECEIPT_NOT_FOUND", "Receipt not found");
    const items = await documents.receiptItems(connection, id);
    if (header.status === "POSTED") return { ...header, items, duplicate: true };
    if (!items.length) throw new AppError(409, "RECEIPT_EMPTY", "Receipt has no items");
    for (const item of items) await applyMovement(connection, { maSP: item.maSP, maSize: item.maSize,
      delta: item.soLuongNhap, eventType: "RECEIPT", referenceType: "GOODS_RECEIPT", referenceId: id,
      actorId, reason: header.ghiChu || "GOODS_RECEIPT_POSTED" });
    if (await documents.postReceipt(connection, id, actorId) !== 1) throw new AppError(409, "RECEIPT_CONFLICT", "Unable to post receipt");
    return { ...await documents.lockReceipt(connection, id), items, duplicate: false };
  });
}
export async function getReceipt(id) {
  return withTransaction(async (connection) => {
    const header = await documents.lockReceipt(connection, integer(id, "receipt id"));
    if (!header) throw new AppError(404, "RECEIPT_NOT_FOUND", "Receipt not found");
    return { ...header, items: await documents.receiptItems(connection, header.maPhieuNhap) };
  });
}
export async function createAdjustment(input, transaction = withTransaction) {
  const key = requestKey(input.idempotencyKey, true);
  const note = reason(input.reason);
  const items = uniqueVariants(input.items, (item) => {
    if (!item || typeof item !== "object") invalid("Invalid adjustment item");
    const delta = integer(item.delta, "delta", -MAX_STOCK, MAX_STOCK);
    if (!delta) invalid("Adjustment delta must be nonzero");
    return { maSP: integer(item.maSP, "maSP"), maSize: integer(item.maSize, "maSize"), delta };
  });
  const fingerprint = hash({ reason: note, items });
  return transaction(async (connection) => {
    if (!await documents.lockActor(connection, input.actorId)) throw new AppError(401, "UNAUTHENTICATED", "Actor not found");
    const existing = await documents.findAdjustmentRequest(connection, input.actorId, key);
    if (existing) {
      if (existing.request_hash !== fingerprint) throw new AppError(409, "IDEMPOTENCY_CONFLICT", "Adjustment key has a different payload");
      return { adjustmentId: existing.adjustment_id, duplicate: true };
    }
    const id = await documents.insertAdjustment(connection, { actorId: input.actorId, reason: note, key, hash: fingerprint });
    for (const item of items) await applyMovement(connection, { ...item, eventType: "ADJUSTMENT", referenceType: "ADJUSTMENT",
      referenceId: id, actorId: input.actorId, reason: note });
    return { adjustmentId: id, duplicate: false };
  });
}

async function pageQuery(select, count, conditions, values, filters) {
  const clause = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
  return withTransaction(async (connection) => {
    const [counts] = await connection.execute(count + clause, values);
    const [items] = await connection.execute(select + clause + ` ORDER BY 1 DESC LIMIT ${filters.limit} OFFSET ${filters.offset}`, values);
    const total = Number(counts[0].total);
    return { items, pagination: { page: filters.page, limit: filters.limit, total, totalPages: Math.ceil(total / filters.limit) } };
  });
}
function dates(filters, field, conditions, values) {
  if (filters.fromDate) { conditions.push(`${field} >= ?`); values.push(filters.fromDate); }
  if (filters.toDate) { conditions.push(`${field} < DATE_ADD(?, INTERVAL 1 DAY)`); values.push(filters.toDate); }
}
export async function listReceipts(query) {
  const filters = listFilters(query), conditions = [], values = [];
  if (query.status !== undefined) {
    if (!["DRAFT","POSTED"].includes(query.status)) invalid("Invalid receipt status");
    conditions.push("status = ?"); values.push(query.status);
  }
  dates(filters, "created_at", conditions, values);
  return pageQuery("SELECT * FROM PhieuNhap", "SELECT COUNT(*) AS total FROM PhieuNhap", conditions, values, filters);
}
export async function listMovements(query) {
  const filters = listFilters(query), conditions = [], values = [];
  for (const field of ["maSP","maSize"]) if (filters[field]) { conditions.push(`${field} = ?`); values.push(filters[field]); }
  if (query.eventType !== undefined) {
    if (!["OPENING","ORDER","CANCEL","RECEIPT","ADJUSTMENT"].includes(query.eventType)) invalid("Invalid event type");
    conditions.push("event_type = ?"); values.push(query.eventType);
  }
  dates(filters, "created_at", conditions, values);
  return pageQuery("SELECT * FROM InventoryMovement", "SELECT COUNT(*) AS total FROM InventoryMovement", conditions, values, filters);
}
export async function lowStock(query) {
  const filters = listFilters(query);
  const threshold = integer(query.threshold ?? 5, "threshold", 0);
  const conditions = ["ct.is_active = 1", "ct.soLuongTon <= ?"], values = [threshold];
  for (const field of ["maSP","maSize"]) if (filters[field]) { conditions.push(`ct.${field} = ?`); values.push(filters[field]); }
  const from = " FROM ChiTietSanPham ct JOIN SanPham p ON p.maSP = ct.maSP JOIN `Size` s ON s.maSize = ct.maSize";
  return pageQuery("SELECT ct.maSP, ct.maSize, ct.soLuongTon, p.tenSP, s.tenSize" + from,
    "SELECT COUNT(*) AS total" + from, conditions, values, filters);
}
export async function reconciliation(query) {
  const filters = listFilters(query), values = [], conditions = [];
  for (const field of ["maSP","maSize"]) if (filters[field]) { conditions.push(`ct.${field} = ?`); values.push(filters[field]); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const [rows] = await db.promise().execute(
    `SELECT ct.maSP, ct.maSize, ct.soLuongTon AS snapshotQuantity,
       COALESCE(SUM(m.delta), 0) AS ledgerQuantity, ct.soLuongTon - COALESCE(SUM(m.delta), 0) AS difference
     FROM ChiTietSanPham ct LEFT JOIN InventoryMovement m ON m.maSP = ct.maSP AND m.maSize = ct.maSize
     ${where} GROUP BY ct.maSP, ct.maSize, ct.soLuongTon
     ORDER BY ct.maSP, ct.maSize LIMIT ${filters.limit} OFFSET ${filters.offset}`, values);
  return { items: rows.map((row) => ({ ...row, ledgerQuantity: Number(row.ledgerQuantity), difference: Number(row.difference) })),
    page: filters.page, limit: filters.limit };
}
