import db from "../config/db.js";
import { withTransaction } from "../utils/transaction.js";
import { AppError } from "../utils/app-error.js";
import { voucherCode, voucherInput, calculateVoucher } from "../domain/voucher.js";
import { integer, invalid, listFilters, uniqueVariants } from "../domain/inventory.js";
import { voucherRepository as repository } from "../repositories/voucher.repository.js";
import { orderRepository } from "../repositories/order.repository.js";

export async function quoteVoucher(connection, code, userId, subtotal, now = new Date()) {
  code = voucherCode(code, true);
  if (!code) return { voucherId: null, code: null, discountAmount: 0 };
  const voucher = await repository.lockByCode(connection, code);
  if (!voucher) throw new AppError(404, "VOUCHER_NOT_FOUND", "Voucher not found");
  const uses = await repository.userUses(connection, voucher.maGiamGia, userId);
  const discountAmount = calculateVoucher(voucher, subtotal, uses, now);
  return { voucherId: voucher.maGiamGia, code, discountAmount };
}
export async function reserveVoucher(connection, quote, orderId, userId) {
  if (quote.voucherId === null) return;
  if (await repository.insertRedemption(connection, { ...quote, orderId, userId }) !== 1) {
    throw new AppError(409, "VOUCHER_USAGE_LIMIT", "Voucher usage limit reached");
  }
}
async function redemptionState(connection, orderId, status) {
  const reference = await repository.redemption(connection, orderId);
  if (!reference) return false;
  await repository.lockById(connection, reference.voucher_id);
  const redemption = await repository.redemption(connection, orderId, true);
  if (redemption.status !== "RESERVED") {
    if (status === "COMMITTED" && redemption.status === "RELEASED") throw new AppError(422, "VOUCHER_STATE_CONFLICT", "Released voucher cannot be committed");
    return false;
  }
  if (await repository.changeRedemption(connection, orderId, status) !== 1) throw new AppError(409, "VOUCHER_STATE_CONFLICT", "Unable to update voucher redemption");
  if (status === "RELEASED" && await repository.releaseUsage(connection, reference.voucher_id) !== 1) {
    throw new AppError(422, "VOUCHER_USAGE_INVARIANT", "Voucher usage is inconsistent");
  }
  return true;
}
export const releaseVoucher = (connection, orderId) => redemptionState(connection, orderId, "RELEASED");
export const commitVoucher = (connection, orderId) => redemptionState(connection, orderId, "COMMITTED");

export async function previewVoucher(input) {
  const code = voucherCode(input.voucherCode);
  const items = uniqueVariants(input.items, (item) => {
    if (!item || typeof item !== "object") invalid("Invalid preview item");
    return { maSP: integer(item.maSP,"maSP"), maSize: integer(item.maSize,"maSize"), soLuongMua: integer(item.soLuongMua,"soLuongMua") };
  });
  return withTransaction(async (connection) => {
    let subtotal = 0;
    for (const item of items) {
      const variant = await orderRepository.lockVariant(connection,item.maSP,item.maSize);
      if (!variant) throw new AppError(404,"ORDER_VARIANT_NOT_FOUND","Product variant not found");
      subtotal += Number(variant.gia) * item.soLuongMua;
    }
    if (!Number.isSafeInteger(subtotal)) invalid("Order total is too large");
    const quote = await quoteVoucher(connection,code,input.userId,subtotal);
    return { voucherCode: code, subtotalBeforeDiscount: subtotal, discountAmount: quote.discountAmount, totalAfterDiscount: subtotal - quote.discountAmount };
  });
}
export async function saveVoucher(input, actorId, id = null) {
  const voucher = voucherInput(input);
  if (id !== null) id = integer(id,"voucher id");
  try {
    return await withTransaction(async (connection) => {
      let before = null;
      if (id !== null) {
        before = await repository.lockById(connection,id);
        if (!before) throw new AppError(404,"VOUCHER_NOT_FOUND","Voucher not found");
        if (voucher.usage_limit !== null && voucher.usage_limit < before.used_count) throw new AppError(409,"VOUCHER_LIMIT_BELOW_USAGE","Usage limit is below active usage");
      }
      const voucherId = await repository.save(connection,voucher,id);
      const after = await repository.lockById(connection,voucherId);
      await repository.audit(connection,voucherId,actorId,id === null ? "CREATE" : "UPDATE",before,after);
      return after;
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") throw new AppError(409,"VOUCHER_CODE_EXISTS","Voucher code already exists");
    throw error;
  }
}
export async function setVoucherStatus(id, enabled, actorId) {
  if (typeof enabled !== "boolean") invalid("enabled must be boolean");
  return withTransaction(async (connection) => {
    id = integer(id,"voucher id");
    const before = await repository.lockById(connection,id);
    if (!before) throw new AppError(404,"VOUCHER_NOT_FOUND","Voucher not found");
    if (enabled && new Date(before.start_at) >= new Date(before.end_at)) invalid("Voucher dates must be corrected before enabling");
    const [result] = await connection.execute("UPDATE GiamGia SET enabled = ? WHERE maGiamGia = ?",[enabled ? 1 : 0,id]);
    if (result.affectedRows !== 1) throw new AppError(409,"VOUCHER_CONFLICT","Unable to change voucher");
    const after = await repository.lockById(connection,id);
    await repository.audit(connection,id,actorId,"STATUS",before,after);
    return after;
  });
}
export async function listVouchers(query = {}) {
  const filters = listFilters(query), conditions = [], values = [];
  if (query.enabled !== undefined) { if (!["true","false"].includes(query.enabled)) invalid("Invalid enabled filter"); conditions.push("enabled = ?"); values.push(query.enabled === "true" ? 1 : 0); }
  if (query.code !== undefined) { conditions.push("code = ?"); values.push(voucherCode(query.code)); }
  const where = conditions.length ? " WHERE " + conditions.join(" AND ") : "";
  const [[count]] = await db.promise().execute("SELECT COUNT(*) AS total FROM GiamGia" + where,values);
  const [items] = await db.promise().execute("SELECT * FROM GiamGia" + where + ` ORDER BY maGiamGia DESC LIMIT ${filters.limit} OFFSET ${filters.offset}`,values);
  return { items, pagination: { page: filters.page, limit: filters.limit, total: Number(count.total), totalPages: Math.ceil(Number(count.total)/filters.limit) } };
}
