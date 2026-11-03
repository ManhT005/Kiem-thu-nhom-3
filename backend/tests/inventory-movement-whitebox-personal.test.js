import test from "node:test";
import assert from "node:assert/strict";
import { applyMovement } from "../services/inventory.service.js";
import { MAX_STOCK } from "../domain/inventory.js";

const baseInput = (overrides = {}) => ({
  maSP: 7,
  maSize: 2,
  delta: -2,
  eventType: "ORDER",
  referenceType: "ORDER",
  referenceId: "ORDER:WB-001",
  reason: " White-box test ",
  ...overrides,
});

function fakeRepository({
  variant = { soLuongTon: 5, is_active: 1 },
  existing = null,
  updatedRows = 1,
  insertedId = 91,
} = {}) {
  const calls = [];
  return {
    calls,
    async lockVariant(connection, maSP, maSize) {
      calls.push({ method: "lockVariant", maSP, maSize });
      return variant;
    },
    async findMovement(connection, movement) {
      calls.push({ method: "findMovement", eventType: movement.eventType, delta: movement.delta });
      return existing;
    },
    async ensureOpening(connection, lockedVariant) {
      calls.push({ method: "ensureOpening", lockedVariant });
    },
    async updateStock(connection, movement) {
      calls.push({ method: "updateStock", before: movement.before, after: movement.after });
      return updatedRows;
    },
    async insertMovement(connection, movement) {
      calls.push({ method: "insertMovement", after: movement.after, reason: movement.reason });
      return insertedId;
    },
  };
}

async function expectCode(promise, code, status) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, code);
    if (status !== undefined) assert.equal(error.status, status);
    return true;
  });
}

test("WB-INV-01: ORDER movement decreases stock and persists the ledger row", async () => {
  const repository = fakeRepository();
  const result = await applyMovement({}, baseInput(), repository);

  assert.deepEqual(result, { id: 91, quantityAfter: 3, duplicate: false });
  assert.deepEqual(repository.calls.map((call) => call.method), [
    "lockVariant", "findMovement", "ensureOpening", "updateStock", "insertMovement",
  ]);
  assert.equal(repository.calls[3].before, 5);
  assert.equal(repository.calls[3].after, 3);
  assert.equal(repository.calls[4].reason, "White-box test");
});

test("WB-INV-02: RECEIPT movement increases stock with its GOODS_RECEIPT reference", async () => {
  const repository = fakeRepository();
  const result = await applyMovement({}, baseInput({
    delta: 4, eventType: "RECEIPT", referenceType: "GOODS_RECEIPT",
  }), repository);

  assert.deepEqual(result, { id: 91, quantityAfter: 9, duplicate: false });
  assert.equal(repository.calls.at(-1).method, "insertMovement");
});

test("WB-INV-03: CANCEL can restore stock even when the variant is inactive", async () => {
  const repository = fakeRepository({ variant: { soLuongTon: 2, is_active: 0 } });
  const result = await applyMovement({}, baseInput({
    delta: 1, eventType: "CANCEL", referenceType: "ORDER",
  }), repository);

  assert.deepEqual(result, { id: 91, quantityAfter: 3, duplicate: false });
  assert.equal(repository.calls.at(-1).method, "insertMovement");
});

test("WB-INV-04: ADJUSTMENT accepts its matching reference type", async () => {
  const repository = fakeRepository();
  const result = await applyMovement({}, baseInput({
    delta: 1, eventType: "ADJUSTMENT", referenceType: "ADJUSTMENT",
  }), repository);

  assert.equal(result.quantityAfter, 6);
  assert.equal(result.duplicate, false);
});

test("WB-INV-05: zero delta is rejected before repository access", async () => {
  const repository = fakeRepository();
  await expectCode(applyMovement({}, baseInput({ delta: 0 }), repository), "INVALID_MOVEMENT", 400);
  assert.deepEqual(repository.calls, []);
});

test("WB-INV-06: mismatched event and reference types are rejected", async () => {
  const repository = fakeRepository();
  await expectCode(applyMovement({}, baseInput({ referenceType: "GOODS_RECEIPT" }), repository),
    "INVALID_MOVEMENT", 400);
  assert.deepEqual(repository.calls, []);
});

test("WB-INV-07: reference IDs outside the allowed character set are rejected", async () => {
  const repository = fakeRepository();
  await expectCode(applyMovement({}, baseInput({ referenceId: "bad reference!" }), repository),
    "INVALID_MOVEMENT", 400);
  assert.deepEqual(repository.calls, []);
});

test("WB-INV-08: a positive ORDER delta is rejected", async () => {
  const repository = fakeRepository();
  await expectCode(applyMovement({}, baseInput({ delta: 1 }), repository), "INVALID_MOVEMENT", 400);
  assert.deepEqual(repository.calls, []);
});

test("WB-INV-09: a negative CANCEL delta is rejected", async () => {
  const repository = fakeRepository();
  await expectCode(applyMovement({}, baseInput({
    delta: -1, eventType: "CANCEL", referenceType: "ORDER",
  }), repository), "INVALID_MOVEMENT", 400);
  assert.deepEqual(repository.calls, []);
});

test("WB-INV-10: a negative RECEIPT delta is rejected", async () => {
  const repository = fakeRepository();
  await expectCode(applyMovement({}, baseInput({
    delta: -1, eventType: "RECEIPT", referenceType: "GOODS_RECEIPT",
  }), repository), "INVALID_MOVEMENT", 400);
  assert.deepEqual(repository.calls, []);
});

test("WB-INV-11: a blank reason is rejected before the variant is locked", async () => {
  const repository = fakeRepository();
  await expectCode(applyMovement({}, baseInput({ reason: "   " }), repository),
    "VALIDATION_ERROR", 400);
  assert.deepEqual(repository.calls, []);
});

test("WB-INV-12: a non-existent product-size variant returns 404", async () => {
  const repository = fakeRepository({ variant: null });
  await expectCode(applyMovement({}, baseInput(), repository), "INVENTORY_VARIANT_NOT_FOUND", 404);
  assert.deepEqual(repository.calls.map((call) => call.method), ["lockVariant"]);
});

test("WB-INV-13: inactive variants cannot be used for an ORDER movement", async () => {
  const repository = fakeRepository({ variant: { soLuongTon: 5, is_active: 0 } });
  await expectCode(applyMovement({}, baseInput(), repository), "VARIANT_INACTIVE", 409);
  assert.deepEqual(repository.calls.map((call) => call.method), ["lockVariant"]);
});

test("WB-INV-14: an identical ledger event is idempotent and performs no writes", async () => {
  const repository = fakeRepository({
    existing: { id: 18, delta: -2, quantity_after: 3 },
  });
  const result = await applyMovement({}, baseInput(), repository);

  assert.deepEqual(result, { id: 18, quantityAfter: 3, duplicate: true });
  assert.deepEqual(repository.calls.map((call) => call.method), ["lockVariant", "findMovement"]);
});

test("WB-INV-15: a repeated event with a different quantity is rejected as a conflict", async () => {
  const repository = fakeRepository({
    existing: { id: 18, delta: -1, quantity_after: 4 },
  });
  await expectCode(applyMovement({}, baseInput(), repository), "MOVEMENT_CONFLICT", 409);
  assert.deepEqual(repository.calls.map((call) => call.method), ["lockVariant", "findMovement"]);
});

test("WB-INV-16: a movement that would make stock negative is rejected without writes", async () => {
  const repository = fakeRepository({ variant: { soLuongTon: 1, is_active: 1 } });
  await expectCode(applyMovement({}, baseInput({ delta: -2 }), repository), "INSUFFICIENT_STOCK", 409);
  assert.deepEqual(repository.calls.map((call) => call.method), ["lockVariant", "findMovement"]);
});

test("WB-INV-17: a movement above MAX_STOCK is rejected without writes", async () => {
  const repository = fakeRepository({ variant: { soLuongTon: MAX_STOCK, is_active: 1 } });
  await expectCode(applyMovement({}, baseInput({
    delta: 1, eventType: "ADJUSTMENT", referenceType: "ADJUSTMENT",
  }), repository), "STOCK_OVERFLOW", 422);
  assert.deepEqual(repository.calls.map((call) => call.method), ["lockVariant", "findMovement"]);
});

test("WB-INV-18: a failed stock update prevents ledger insertion", async () => {
  const repository = fakeRepository({ updatedRows: 0 });
  await expectCode(applyMovement({}, baseInput(), repository), "STOCK_UPDATE_FAILED", 409);
  assert.deepEqual(repository.calls.map((call) => call.method), [
    "lockVariant", "findMovement", "ensureOpening", "updateStock",
  ]);
});

test("WB-INV-19: inventory identifiers and delta are normalized before processing", async () => {
  const repository = fakeRepository();
  const result = await applyMovement({}, baseInput({
    maSP: "7", maSize: "2", delta: "-2", referenceId: 123,
  }), repository);

  assert.equal(result.quantityAfter, 3);
  assert.equal(repository.calls[0].maSP, 7);
  assert.equal(repository.calls[0].maSize, 2);
});
