const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { mkdirSync, openSync, closeSync } = require("node:fs");

(async () => {
  mkdirSync("test-results", { recursive: true });
  const log = openSync("test-results/server.log", "w");
  const api = spawn(process.execPath, ["backend/server.js"], {
    stdio: ["ignore", log, log, "ipc"], env: { ...process.env, PORT: "0" },
  });
  const exited = once(api, "exit");
  try {
    const port = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("API startup timed out")), 30_000);
      api.once("message", (message) => {
        clearTimeout(timer);
        if (message.type === "ready") resolve(message.port);
        else reject(new Error("Unexpected API readiness message"));
      });
      api.once("exit", () => { clearTimeout(timer); reject(new Error("API exited before health check")); });
      api.once("error", (error) => { clearTimeout(timer); reject(error); });
    });
    const baseUrl = `http://127.0.0.1:${port}`;
    const health = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(1000) });
    if (!health.ok) throw new Error("API failed health check");
    const { existsSync } = require("node:fs");
    const suites = [
      ["ClothesShop", "newman"], ["Phase3", "newman-phase3"], ["Phase4", "newman-phase4"],
    ].filter(([name]) => existsSync(`tests/postman/${name}.postman_collection.json`));
    for (const [name, artifact] of suites) {
      const runner = spawn(process.execPath, ["node_modules/newman/bin/newman.js", "run",
        `tests/postman/${name}.postman_collection.json`, "-e", "tests/postman/local.postman_environment.json",
        "--env-var", `baseUrl=${baseUrl}`,
        "--reporters", "cli,json,htmlextra", "--reporter-json-export", `test-results/${artifact}.json`,
        "--reporter-htmlextra-export", `test-results/${artifact}.html`, "--timeout", "120000"], { stdio: "inherit" });
      const [code] = await once(runner, "exit");
      if (code !== 0) { process.exitCode = code ?? 1; break; }
    }
  } finally {
    api.kill("SIGTERM");
    const timer = setTimeout(() => api.kill("SIGKILL"), 10_000);
    await exited;
    clearTimeout(timer);
    closeSync(log);
  }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
