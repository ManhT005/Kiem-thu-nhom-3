import { AppError } from "../utils/app-error.js";

const DAY = 86_400_000;
const invalid = (message) => { throw new AppError(400, "INVALID_REPORT_FILTER", message); };
export function parseReportDate(value) {
  if (typeof value !== "string") return invalid("from and to must be dates or ISO timestamps with timezone");
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.exec(value);
  if (!match) return invalid("Use YYYY-MM-DD (UTC) or ISO-8601 with timezone");
  if (value.length > 10) {
    const [hour,minute,second] = value.slice(11,19).split(":").map(Number);
    if (hour > 23 || minute > 59 || second > 59) return invalid("Invalid clock time");
  }
  const [, year, month, day] = match.map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (year < 1000 || year > 9998 || calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) {
    return invalid("Invalid calendar date");
  }
  const date = new Date(value.length === 10 ? value + "T00:00:00Z" : value);
  if (!Number.isFinite(date.getTime())) return invalid("Invalid timestamp");
  return date;
}
export function integerFilter(value, fallback, maximum, name) {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > maximum) {
    return invalid(`${name} must be an integer between 1 and ${maximum}`);
  }
  return Number(value);
}
export function reportFilters(query = {}, kind = "summary", now = new Date()) {
  const allowed = new Set(["from", "to", ...(kind === "top" ? ["limit", "sort"] : []),
    ...(kind === "chart" ? ["groupBy"] : []), ...(kind === "reconciliation" ? ["status", "page", "limit"] : [])]);
  if (Object.keys(query).some(key => !allowed.has(key))) return invalid("Unknown report filter");
  if ((query.from === undefined) !== (query.to === undefined)) return invalid("Supply both from and to");
  const to = query.to === undefined ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)) : parseReportDate(query.to);
  const from = query.from === undefined ? new Date(to.getTime() - 14 * DAY) : parseReportDate(query.from);
  if (from >= to || to - from > 732 * DAY) return invalid("Period must be positive and at most 732 days");
  const result = { from, to };
  if (kind === "top") {
    result.limit = integerFilter(query.limit, 5, 20, "limit");
    result.sort = query.sort ?? "quantity";
    if (!["quantity", "grossSales"].includes(result.sort)) return invalid("Invalid product sort");
  }
  if (kind === "chart") {
    result.groupBy = query.groupBy ?? "day";
    if (!["day", "week", "month"].includes(result.groupBy)) return invalid("Invalid chart groupBy");
    result.buckets = reportBuckets(from, to, result.groupBy);
    if (result.buckets.length > 24) return invalid("Chart supports at most 24 buckets; use a coarser groupBy");
  }
  if (kind === "reconciliation") {
    result.page = integerFilter(query.page, 1, 10000, "page");
    result.limit = integerFilter(query.limit, 20, 100, "limit");
    result.status = query.status ?? "ALL";
    if (!["ALL", "REFUND_REQUIRED", "PAYMENT_MISMATCH", "AMOUNT_MISMATCH", "MULTIPLE_PAID", "VOUCHER_MISMATCH"].includes(result.status)) return invalid("Invalid reconciliation status");
  }
  return result;
}
export function bucketStart(value, groupBy) {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  if (groupBy === "week") date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  if (groupBy === "month") date.setUTCDate(1);
  return date;
}
export function reportBuckets(from, to, groupBy) {
  const result = [], cursor = bucketStart(from, groupBy);
  while (cursor < to && result.length <= 24) {
    result.push(cursor.toISOString());
    if (groupBy === "month") cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    else cursor.setUTCDate(cursor.getUTCDate() + (groupBy === "week" ? 7 : 1));
  }
  return result;
}
export function exactInteger(value = 0) {
  // MySQL SUM(DECIMAL/BIGINT) returns decimal text. Never coerce through float.
  const raw = String(value ?? 0);
  if (!/^-?\d+(?:\.0+)?$/.test(raw)) throw new AppError(500, "INVALID_REPORT_DATA", "Expected whole VND amount");
  const integer = BigInt(raw.split(".")[0]);
  return integer <= BigInt(Number.MAX_SAFE_INTEGER) && integer >= BigInt(Number.MIN_SAFE_INTEGER) ? Number(integer) : integer.toString();
}
export const reportPeriod = ({ from, to }) => ({ from: from.toISOString(), to: to.toISOString(), timezone: "UTC" });
