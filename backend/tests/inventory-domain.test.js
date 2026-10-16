import test from "node:test";
import assert from "node:assert/strict";
import { receiptItems, integer, moneyCents, MAX_STOCK, listFilters } from "../domain/inventory.js";
import { applyMovement } from "../services/inventory.service.js";

test("receipt validation handles quantity/money boundaries, sorting, duplicates and total overflow", () => {
  const item = { maSP: 2, maSize: 1, soLuongNhap: 1, donGiaNhap: "0.01" };
  assert.equal(receiptItems([item]).total, "0.01");
  assert.equal(receiptItems([{ ...item, soLuongNhap: MAX_STOCK, donGiaNhap: 0 }]).items[0].soLuongNhap, MAX_STOCK);
  for (const value of [0,-1,MAX_STOCK+1,null,true,1.5]) assert.throws(() => receiptItems([{ ...item, soLuongNhap: value }]));
  for (const value of [-1,"0.001","1e8",null,"1000000000000"]) assert.throws(() => moneyCents(value));
  assert.throws(() => receiptItems([item,item]));
  assert.throws(() => receiptItems([]));
  assert.throws(() => receiptItems([{ ...item, soLuongNhap: MAX_STOCK, donGiaNhap: "999999999999.99" }]));
  assert.throws(() => integer("1 OR 1=1", "quantity"));
  assert.throws(() => listFilters({ fromDate: "2026-02-30" }));
  assert.throws(() => listFilters({ fromDate: "2026-02-01", toDate: "2026-01-01" }));
});
test("movement prevents negative stock, overflow and inactive sales before any writes", async () => {
  let writes = 0;
  const repository = {
    lockVariant: async () => ({ soLuongTon: 1, is_active: 1 }),
    findMovement: async () => null,
    ensureOpening: async () => { writes++; },
  };
  const input = { maSP: 1, maSize: 1, delta: -2, eventType: "ORDER", referenceType: "ORDER", referenceId: 1, reason: "Order" };
  await assert.rejects(applyMovement({}, input, repository), { code: "INSUFFICIENT_STOCK" });
  repository.lockVariant = async () => ({ soLuongTon: MAX_STOCK, is_active: 1 });
  await assert.rejects(applyMovement({}, { ...input, delta: 1, eventType: "RECEIPT", referenceType: "GOODS_RECEIPT" }, repository), { code: "STOCK_OVERFLOW" });
  repository.lockVariant = async () => ({ soLuongTon: 5, is_active: 0 });
  await assert.rejects(applyMovement({}, input, repository), { code: "VARIANT_INACTIVE" });
  assert.equal(writes,0);
});
test("movement duplicate events are idempotent but conflicting quantities are rejected", async () => {
  const input = { maSP: 1, maSize: 1, delta: -1, eventType: "ORDER", referenceType: "ORDER", referenceId: 1, reason: "Order" };
  const repository = { lockVariant: async () => ({ is_active: 1 }), findMovement: async () => ({ id: 1, delta: -1, quantity_after: 2 }) };
  assert.equal((await applyMovement({}, input, repository)).duplicate, true);
  await assert.rejects(applyMovement({}, { ...input, delta: -2 }, repository), { code: "MOVEMENT_CONFLICT" });
});
