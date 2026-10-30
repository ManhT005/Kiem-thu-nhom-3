import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
import { spawnSync } from "node:child_process";

await mkdir(resolve(backendRoot, "../test-results/whitebox"), { recursive: true });
const args = [
  "--test", "--experimental-test-coverage",
  "--test-coverage-include=domain/*.js",
  "--test-coverage-include=services/inventory.service.js",
  "--test-coverage-include=services/momo.service.js",
  "--test-coverage-include=middleware/*.js",
  "--test-coverage-include=jobs/payment-expiration.js",
  "--test-reporter=spec", "--test-reporter-destination=stdout",
  "--test-reporter=junit", "--test-reporter-destination=../test-results/whitebox/junit.xml",
  "tests/whitebox/core-whitebox.test.js",
];
const result = spawnSync(process.execPath, args, {
  env: { ...process.env, NODE_ENV: "test", JWT_SECRET: process.env.JWT_SECRET || "whitebox-local-only-secret" },
  cwd: backendRoot, stdio: "inherit", timeout: 120000,
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
