import { AppError } from "../utils/app-error.js";
import { invalid, moneyCents, decimal, integer } from "./inventory.js";

export function voucherCode(value, optional = false) {
  if (optional && (value === undefined || value === null || value === "")) return "";
  if (typeof value !== "string") invalid("Voucher code must be a string");
  const code = value.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,64}$/.test(code)) invalid("Voucher code must contain 3-64 letters, digits, underscores or hyphens");
  return code;
}
function utcDate(value, name) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.test(value) ||
      !Number.isFinite(Date.parse(value))) invalid(`${name} must be an ISO timestamp with timezone`);
  const [year, month, day] = value.slice(0,10).split("-").map(Number);
  if (year < 1000) invalid(`Invalid ${name}`);
  const check = new Date(Date.UTC(year,month-1,day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month-1 || check.getUTCDate() !== day ||
      Number(value.slice(11,13)) > 23) invalid(`Invalid ${name}`);
  return new Date(value);
}
export function voucherInput(input) {
  const code = voucherCode(input.code), type = input.discountType;
  if (!["PERCENT","FIXED"].includes(type)) invalid("discountType must be PERCENT or FIXED");
  const value = moneyCents(input.discountValue, "discountValue");
  if (value <= 0 || (type === "PERCENT" && value > 10000)) invalid("Invalid discount value");
  const minimum = moneyCents(input.minimumOrderAmount ?? 0, "minimumOrderAmount");
  const cap = input.maximumDiscountAmount === undefined || input.maximumDiscountAmount === null ? null : moneyCents(input.maximumDiscountAmount,"maximumDiscountAmount");
  const start = utcDate(input.startAt, "startAt"), end = utcDate(input.endAt, "endAt");
  if (start >= end) invalid("startAt must precede endAt");
  if (input.enabled !== undefined && typeof input.enabled !== "boolean") invalid("enabled must be boolean");
  if (input.description !== undefined && (typeof input.description !== "string" || input.description.length > 500)) invalid("Description must be at most 500 characters");
  return { code, discount_type: type, discount_value: decimal(value), minimum_order_amount: decimal(minimum),
    maximum_discount_amount: cap === null ? null : decimal(cap), start_at: start, end_at: end,
    usage_limit: input.usageLimit === undefined || input.usageLimit === null ? null : integer(input.usageLimit,"usageLimit",0),
    per_user_limit: integer(input.perUserLimit ?? 1,"perUserLimit",0), enabled: input.enabled ?? true, moTa: input.description || "" };
}
export function calculateVoucher(voucher, subtotal, userUses, now = new Date()) {
  const fail = (code, message) => { throw new AppError(409, code, message); };
  if (!Number.isSafeInteger(subtotal) || subtotal < 0) invalid("Invalid server subtotal");
  if (!voucher.enabled) fail("VOUCHER_DISABLED","Voucher is disabled");
  if (now.getTime() < new Date(voucher.start_at).getTime()) fail("VOUCHER_NOT_STARTED","Voucher has not started");
  if (now.getTime() >= new Date(voucher.end_at).getTime()) fail("VOUCHER_EXPIRED","Voucher has expired");
  const subtotalCents = BigInt(subtotal) * 100n;
  if (subtotalCents < BigInt(moneyCents(voucher.minimum_order_amount))) fail("MIN_ORDER_NOT_MET","Minimum order amount is not met");
  if (voucher.usage_limit !== null && voucher.used_count >= voucher.usage_limit) fail("VOUCHER_USAGE_LIMIT","Voucher usage limit reached");
  if (userUses >= voucher.per_user_limit) fail("VOUCHER_USER_LIMIT","Voucher per-user limit reached");
  const value = BigInt(moneyCents(voucher.discount_value));
  let discount = voucher.discount_type === "PERCENT" ? BigInt(subtotal) * value / 10000n : value / 100n;
  if (voucher.discount_type === "PERCENT" && voucher.maximum_discount_amount !== null) {
    const cap = BigInt(moneyCents(voucher.maximum_discount_amount)) / 100n;
    if (discount > cap) discount = cap;
  }
  if (discount > BigInt(subtotal)) discount = BigInt(subtotal);
  return Number(discount); // VND floor, no floating-point percentage arithmetic.
}
