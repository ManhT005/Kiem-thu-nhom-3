import test from "node:test";
import assert from "node:assert/strict";
import { paymentRepository } from "../repositories/payment.repository.js";

test("expiration rejects unsafe limits before executing SQL", async () => {
  const executor = { execute() { assert.fail("Invalid limit must never reach MySQL"); } };
  for (const limit of [-1, 0, 501, 1.5, "100", "1 OR 1=1", null, NaN, Infinity]) {
    await assert.rejects(paymentRepository.findExpiredTransactions(executor, limit), RangeError);
  }
});
