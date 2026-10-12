import test from "node:test";
import assert from "node:assert/strict";
import { startPaymentExpiration } from "../jobs/payment-expiration.js";

test("worker avoids overlap, waits for in-flight work and never restarts after stop", async () => {
  let calls = 0;
  let release;
  const worker = startPaymentExpiration({ enabled: true, intervalMs: 100000,
    expire: async () => { calls++; await new Promise((resolve) => { release = resolve; }); } });
  await Promise.resolve();
  const first = worker.run();
  assert.equal(worker.run(), first);
  assert.equal(calls, 1);
  let stopped = false;
  const stop = worker.stop().then(() => { stopped = true; });
  await Promise.resolve();
  assert.equal(stopped, false);
  release();
  await stop;
  await worker.run();
  assert.equal(calls, 1);
});

test("worker recovers after errors and logs each consecutive error code once", async () => {
  let failing = true;
  const errors = [];
  const worker = startPaymentExpiration({ enabled: true, intervalMs: 100000,
    logger: { error(message) { errors.push(message); } },
    expire: async () => { if (failing) throw Object.assign(new Error("private details"), { code: "ER_TEST" }); } });
  await worker.run();
  await worker.run();
  assert.deepEqual(errors, ["MoMo expiration failed: ER_TEST"]);
  failing = false;
  await worker.run();
  failing = true;
  await worker.run();
  assert.equal(errors.length, 2);
  await worker.stop();
});

test("test environment disables worker by default", async () => {
  const worker = startPaymentExpiration({ expire: () => assert.fail("Disabled worker ran") });
  await worker.run();
  await worker.stop();
});
