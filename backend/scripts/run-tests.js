import { readdir, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const suite = process.argv[2] || "unit";
if (!["unit", "routes", "integration"].includes(suite)) throw new Error("Unknown test suite");
if (suite === "integration" && (process.env.ORDER_CONCURRENCY_TEST !== "1" ||
    !/_test$/i.test(process.env.DB_NAME || ""))) {
  throw new Error("Integration requires ORDER_CONCURRENCY_TEST=1 and an explicit *_test database");
}
const folder = suite === "integration" ? "tests/integration" : "tests";
const files = suite === "routes" ? ["page-routes.test.js", "frontend-asset-url.test.js"] :
  (await readdir(folder)).filter((name) => name.endsWith(".test.js")).sort();
await mkdir("../test-results", { recursive: true });
const result = spawnSync(process.execPath, ["--test", "--test-timeout=60000",
  ...(suite === "integration" ? ["--test-concurrency=1"] : []),
  "--test-reporter=tap", "--test-reporter-destination=stdout",
  "--test-reporter=junit", `--test-reporter-destination=../test-results/${suite}.xml`,
  ...files.map((file) => `${folder}/${file}`)], {
  stdio: "inherit", env: { ...process.env, NODE_ENV: "test", JWT_SECRET: process.env.JWT_SECRET || "unit-test-only-secret" },
  timeout: suite === "integration" ? 300_000 : 120_000,
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
