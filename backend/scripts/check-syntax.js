import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

async function check(folder) {
  for (const item of await readdir(folder, { withFileTypes: true })) {
    if (item.name === "node_modules") continue;
    const file = path.join(folder, item.name);
    if (item.isDirectory()) await check(file);
    else if (file.endsWith(".js")) {
      const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
      if (result.status !== 0) process.exitCode = 1;
    }
  }
}
await check(".");
await check("../frontend/js");
