import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("app and bootstrap imports exit without a listener, database query or timer in development", () => {
  const result = spawnSync(process.execPath, ["--input-type=module", "-e",
    'await import("./app.js"); await import("./server.js"); console.log("IMPORT_OK");'], {
    cwd: process.cwd(), env: { ...process.env, NODE_ENV: "development", DB_PORT: "1" },
    timeout: 15000, encoding: "utf8",
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /IMPORT_OK/);
  assert.doesNotMatch(result.stdout + result.stderr, /Server is running|expiration failed/);
});
