import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import db from "../../config/db.js";
import { createReceipt, editReceipt, postReceipt, createAdjustment, reconciliation, lowStock, listMovements } from "../../services/inventory-documents.service.js";
import { createOrder, cancelOrder } from "../../services/order.service.js";
import { saveProduct } from "../../services/product-write.service.js";
import { fixture, integrationEnabled } from "./fixture-helper.js";
const pool = db.promise();
const integration = (name, work) => test(name, { skip: !integrationEnabled }, async () => {
  const f = await fixture(pool); try { await work(f); } finally { await f.cleanup(); }
});
test.after(async () => { await pool.end(); });
integration("DRAFT receipt leaves stock unchanged; concurrent posting is exactly once and POSTED is immutable", async (f) => {
  const request = { actorId: f.users.staff, idempotencyKey: randomUUID(), note: "QA receipt",
    items: [{ ...f.variant(), soLuongNhap: 10, donGiaNhap: "0.01" }, { ...f.variant(1), soLuongNhap: 5, donGiaNhap: 10 }] };
  const receipt = await createReceipt(request);
  assert.equal(receipt.status,"DRAFT"); assert.equal(await f.stock(),10);
  assert.equal((await createReceipt(request)).maPhieuNhap, receipt.maPhieuNhap);
  await assert.rejects(createReceipt({ ...request, note: "Changed" }), { code: "IDEMPOTENCY_CONFLICT" });
  const posted = await Promise.all(Array.from({ length: 10 }, () => postReceipt(receipt.maPhieuNhap, f.users.staff)));
  assert.equal(posted.filter((result) => !result.duplicate).length,1);
  assert.equal(await f.stock(),20); assert.equal(await f.stock(1),15);
  const [rows] = await pool.execute("SELECT * FROM InventoryMovement WHERE maSP = ? AND event_type = 'RECEIPT'", [f.productId]);
  assert.equal(rows.length,2);
  await assert.rejects(editReceipt(receipt.maPhieuNhap, request), { code: "RECEIPT_IMMUTABLE" });
  assert.ok((await reconciliation({ maSP: f.productId })).items.every((row) => row.difference === 0));
});
integration("receipt posting rolls back all variants, ledger and header when a later item overflows", async (f) => {
  await pool.execute("UPDATE ChiTietSanPham SET soLuongTon = 2147483647 WHERE maSP = ? AND maSize = ?", [f.productId, f.variant(1).maSize]);
  const receipt = await createReceipt({ actorId: f.users.staff, items: [0,1].map((index) => ({ ...f.variant(index), soLuongNhap: 1, donGiaNhap: 0 })) });
  await assert.rejects(postReceipt(receipt.maPhieuNhap, f.users.staff), { code: "STOCK_OVERFLOW" });
  assert.equal(await f.stock(),10);
  const [headers] = await pool.execute("SELECT status FROM PhieuNhap WHERE maPhieuNhap = ?", [receipt.maPhieuNhap]);
  assert.equal(headers[0].status,"DRAFT");
  const [movements] = await pool.execute("SELECT * FROM InventoryMovement WHERE maSP = ?", [f.productId]);
  assert.equal(movements.length,0);
});
integration("receipt and order racing the same variant preserve stock and ledger invariants", async (f) => {
  const receipt = await createReceipt({ actorId: f.users.staff, items: [{ ...f.variant(), soLuongNhap: 5, donGiaNhap: 100 }] });
  await Promise.all([postReceipt(receipt.maPhieuNhap, f.users.staff), createOrder(f.order())]);
  assert.equal(await f.stock(),14);
  assert.ok((await reconciliation({ maSP: f.productId })).items.filter((row) => row.maSize === f.variant().maSize).every((row) => row.difference === 0));
});
integration("order and concurrent cancellation record one sale and one restoration with matching ledger", async (f) => {
  const order = await createOrder(f.order());
  const outcomes = await Promise.allSettled(Array.from({ length: 10 }, () => cancelOrder({ orderId: order.maDonHang, actorId: f.users.user })));
  assert.equal(outcomes.filter((result) => result.status === "fulfilled").length,1);
  assert.equal(await f.stock(),10);
  const result = await listMovements({ maSP: f.productId });
  assert.equal(result.items.filter((row) => row.event_type === "ORDER").length,1);
  assert.equal(result.items.filter((row) => row.event_type === "CANCEL").length,1);
  assert.equal((await reconciliation({ maSP: f.productId, maSize: f.variant().maSize })).items[0].difference,0);
});
integration("failed multi-item orders never leave stock or ledger writes", async (f) => {
  await assert.rejects(createOrder(f.order({ items: [{ ...f.variant(), soLuongMua: 1 }, { ...f.variant(1), soLuongMua: 11 }] })), { code: "INSUFFICIENT_STOCK" });
  assert.equal(await f.stock(),10);
  const [rows] = await pool.execute("SELECT * FROM InventoryMovement WHERE maSP = ?", [f.productId]);
  assert.equal(rows.length,0);
});
integration("adjustments require reason, are atomic/idempotent and cannot underflow stock", async (f) => {
  const request = { actorId: f.users.admin, reason: "Stock count", idempotencyKey: randomUUID(), items: [{ ...f.variant(), delta: -2 }] };
  const results = await Promise.all(Array.from({ length: 10 }, () => createAdjustment(request)));
  assert.equal(new Set(results.map((result) => result.adjustmentId)).size,1); assert.equal(await f.stock(),8);
  await assert.rejects(createAdjustment({ ...request, reason: "" }), { code: "VALIDATION_ERROR" });
  await assert.rejects(createAdjustment({ ...request, items: [{ ...f.variant(), delta: -20 }] }), { code: "IDEMPOTENCY_CONFLICT" });
  await assert.rejects(createAdjustment({ ...request, idempotencyKey: randomUUID(), items: [{ ...f.variant(), delta: -20 }] }), { code: "INSUFFICIENT_STOCK" });
  assert.equal(await f.stock(),8);
  assert.equal((await reconciliation({ maSP: f.productId, maSize: f.variant().maSize })).items[0].difference,0);
});
integration("low-stock boundary and history pagination use validated filters", async (f) => {
  assert.equal((await lowStock({ threshold: 9, maSP: f.productId })).items.length,0);
  assert.equal((await lowStock({ threshold: 10, maSP: f.productId })).items.length,2);
  const order = await createOrder(f.order());
  const first = await listMovements({ maSP: f.productId, eventType: "ORDER", limit: 1 });
  assert.equal(first.items.length,1); assert.equal(first.items[0].reference_id,String(order.maDonHang));
  await assert.rejects(listMovements({ eventType: "BOGUS" }), { code: "VALIDATION_ERROR" });
  await assert.rejects(lowStock({ threshold: "1 OR 1=1" }), { code: "VALIDATION_ERROR" });
});
integration("product size edits cannot set inventory; zero-stock variants disable without deleting ledger/history", async (f) => {
  const [sizeRows] = await pool.execute("SELECT maSize, tenSize FROM `Size` WHERE maSize IN (?, ?) ORDER BY maSize", [f.variant().maSize, f.variant(1).maSize]);
  const request = { tenSP: "Renamed QA", gia: 2500, sizes: sizeRows.map((size,index) => ({ tenSize: size.tenSize, soLuongTon: index === 0 ? 999 : 10 })) };
  await assert.rejects(saveProduct(request, f.users.admin, f.productId), { code: "VALIDATION_ERROR" });
  assert.equal(await f.stock(),10);
  await assert.rejects(saveProduct({ tenSP: "QA", gia: 2500, sizes: [] }, f.users.admin, f.productId), { code: "VARIANT_HAS_STOCK" });
  await createAdjustment({ actorId: f.users.admin, reason: "Disable variants", idempotencyKey: randomUUID(), items: [0,1].map((index) => ({ ...f.variant(index), delta: -10 })) });
  await saveProduct({ tenSP: "QA", gia: 2500, sizes: [] }, f.users.admin, f.productId);
  const [variants] = await pool.execute("SELECT * FROM ChiTietSanPham WHERE maSP = ?", [f.productId]);
  assert.equal(variants.length,2); assert.ok(variants.every((variant) => variant.is_active === 0));
  await assert.rejects(createOrder(f.order()), { code: "ORDER_VARIANT_NOT_FOUND" });
});
