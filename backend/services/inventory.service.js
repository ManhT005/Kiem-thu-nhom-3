import { AppError } from "../utils/app-error.js";
import { inventoryRepository } from "../repositories/inventory.repository.js";
import { integer, MAX_STOCK, reason } from "../domain/inventory.js";

const referenceTypes = { ORDER: "ORDER", CANCEL: "ORDER", RECEIPT: "GOODS_RECEIPT", ADJUSTMENT: "ADJUSTMENT" };
// The caller owns the transaction. All paths lock variants in ascending product/size order.
export async function applyMovement(connection, input, repository = inventoryRepository) {
  const movement = { ...input, maSP: integer(input.maSP, "maSP"), maSize: integer(input.maSize, "maSize"),
    delta: integer(input.delta, "delta", -MAX_STOCK, MAX_STOCK), referenceId: String(input.referenceId) };
  if (movement.delta === 0 || referenceTypes[movement.eventType] !== movement.referenceType ||
      !/^[A-Za-z0-9:_-]{1,64}$/.test(movement.referenceId) ||
      (movement.eventType === "ORDER" && movement.delta > 0) ||
      (["CANCEL", "RECEIPT"].includes(movement.eventType) && movement.delta < 0)) {
    throw new AppError(400, "INVALID_MOVEMENT", "Invalid inventory event");
  }
  movement.reason = reason(input.reason);
  const variant = await repository.lockVariant(connection, movement.maSP, movement.maSize);
  if (!variant) throw new AppError(404, "INVENTORY_VARIANT_NOT_FOUND", "Product variant not found");
  if (!variant.is_active && movement.eventType !== "CANCEL") throw new AppError(409, "VARIANT_INACTIVE", "Variant is inactive");
  const existing = await repository.findMovement(connection, movement);
  if (existing) {
    if (existing.delta !== movement.delta) throw new AppError(409, "MOVEMENT_CONFLICT", "Inventory event has a different quantity");
    return { id: existing.id, quantityAfter: existing.quantity_after, duplicate: true };
  }
  movement.before = Number(variant.soLuongTon);
  movement.after = movement.before + movement.delta;
  if (movement.after < 0) throw new AppError(409, "INSUFFICIENT_STOCK", "Insufficient stock");
  if (movement.after > MAX_STOCK) throw new AppError(422, "STOCK_OVERFLOW", "Stock exceeds supported range");
  await repository.ensureOpening(connection, variant);
  if (await repository.updateStock(connection, movement) !== 1) throw new AppError(409, "STOCK_UPDATE_FAILED", "Unable to update inventory");
  const id = await repository.insertMovement(connection, movement);
  return { id, quantityAfter: movement.after, duplicate: false };
}
