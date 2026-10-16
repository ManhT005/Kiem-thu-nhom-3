import { AppError } from "../utils/app-error.js";

export const MAX_STOCK = 2147483647;
export const MAX_MONEY_CENTS = 99999999999999;
export const invalid = (message) => { throw new AppError(400, "VALIDATION_ERROR", message); };
export function integer(value, name, min = 1, max = MAX_STOCK) {
  if (typeof value !== "number" && typeof value !== "string") invalid(`${name} must be an integer`);
  if (typeof value === "string" && !/^-?\d+$/.test(value)) invalid(`${name} must be an integer`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) invalid(`${name} is out of range`);
  return number;
}
export function moneyCents(value, name = "amount") {
  if (typeof value !== "number" && typeof value !== "string") invalid(`${name} must be a decimal`);
  const text = String(value);
  if (!/^\d+(\.\d{1,2})?$/.test(text)) invalid(`${name} must have at most two decimal places`);
  const [whole, fraction = ""] = text.split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (cents > BigInt(MAX_MONEY_CENTS)) invalid(`${name} is too large`);
  return Number(cents);
}
export const decimal = (cents) => `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
export function requestKey(value, required = false) {
  if (value === undefined && !required) return null;
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{8,64}$/.test(value)) invalid("Invalid idempotencyKey");
  return value;
}
export function reason(value, required = true) {
  if (value === undefined && !required) return null;
  if (typeof value !== "string" || (required && !value.trim()) || value.length > 500) invalid("A reason of 1-500 characters is required");
  return value.trim();
}
export function uniqueVariants(items, normalize) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 100) invalid("items must contain 1-100 variants");
  const normalized = items.map(normalize).sort((a, b) => a.maSP - b.maSP || a.maSize - b.maSize);
  if (new Set(normalized.map((item) => `${item.maSP}:${item.maSize}`)).size !== items.length) invalid("Duplicate product/size");
  return normalized;
}
export function receiptItems(items) {
  let total = 0n;
  const normalized = uniqueVariants(items, (item) => {
    if (!item || typeof item !== "object") invalid("Invalid receipt item");
    const quantity = integer(item.soLuongNhap, "soLuongNhap");
    const cents = moneyCents(item.donGiaNhap, "donGiaNhap");
    const line = BigInt(quantity) * BigInt(cents);
    total += line;
    if (total > BigInt(MAX_MONEY_CENTS)) invalid("Receipt total is too large");
    return { maSP: integer(item.maSP, "maSP"), maSize: integer(item.maSize, "maSize"),
      soLuongNhap: quantity, donGiaNhap: decimal(cents), line_total: decimal(Number(line)) };
  });
  return { items: normalized, total: decimal(Number(total)) };
}
export function listFilters(query = {}) {
  const page = integer(query.page ?? 1, "page", 1, 1000000);
  const limit = integer(query.limit ?? 20, "limit", 1, 100);
  const result = { page, limit, offset: (page - 1) * limit };
  for (const key of ["maSP", "maSize"]) if (query[key] !== undefined) result[key] = integer(query[key], key);
  for (const key of ["fromDate", "toDate"]) {
    if (query[key] !== undefined) {
      if (typeof query[key] !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(query[key]) ||
          !Number.isFinite(Date.parse(query[key])) || new Date(query[key]).toISOString().slice(0,10) !== query[key]) invalid("Invalid date");
      result[key] = query[key];
    }
  }
  if (result.fromDate && result.toDate && result.fromDate > result.toDate) invalid("Invalid date interval");
  return result;
}
