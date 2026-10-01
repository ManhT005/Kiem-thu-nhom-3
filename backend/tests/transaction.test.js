import test from "node:test";
import assert from "node:assert/strict";
import { withTransaction } from "../utils/transaction.js";

const makePool = (events) => ({
  promise: () => ({
    async getConnection() {
      return {
        async beginTransaction() {
          events.push("begin");
        },
        async commit() {
          events.push("commit");
        },
        async rollback() {
          events.push("rollback");
        },
        release() {
          events.push("release");
        },
      };
    },
  }),
});

test("commits and releases a successful transaction", async () => {
  const events = [];
  const result = await withTransaction(async () => "done", makePool(events));
  assert.equal(result, "done");
  assert.deepEqual(events, ["begin", "commit", "release"]);
});

test("rolls back, releases, and preserves the original failure", async () => {
  const events = [];
  const failure = new Error("operation failed");
  await assert.rejects(
    withTransaction(async () => {
      throw failure;
    }, makePool(events)),
    (error) => error === failure,
  );
  assert.deepEqual(events, ["begin", "rollback", "release"]);
});