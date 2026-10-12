import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { applyMigrations } from "./migration-runner.js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");
const fileFromRepository = (...parts) => path.join(repositoryRoot, ...parts);

const databaseName = process.env.DB_NAME || "clothes_db";
if (!/_test$/i.test(databaseName)) {
  throw new Error("db:reset requires an explicit DB_NAME ending in _test");
}

if (
  process.env.NODE_ENV === "production" ||
  process.env.APP_ENV === "production"
) {
  throw new Error("db:reset is disabled in production");
}

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  multipleStatements: true,
});

try {
  await connection.query(
    `DROP DATABASE IF EXISTS \`${databaseName.replaceAll("`", "``")}\``,
  );
  await connection.query(
    `CREATE DATABASE \`${databaseName.replaceAll("`", "``")}\``,
  );
  await connection.query(`USE \`${databaseName.replaceAll("`", "``")}\``);

  await connection.query("SET time_zone = '+00:00'");
  await applyMigrations(connection);
  const seed = await fs.readFile(
    fileFromRepository("database", "seeds", "001_reference_data.sql"),
    "utf8",
  );
  await connection.query(seed);
  console.log(`Database ${databaseName} reset successfully.`);
} finally {
  await connection.end();
}
