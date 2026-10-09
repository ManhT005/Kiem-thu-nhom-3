import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");
const fileFromRepository = (...parts) => path.join(repositoryRoot, ...parts);

const databaseName = process.env.DB_NAME || "clothes_db";
if (!databaseName || databaseName === "mysql") {
  throw new Error("Unsafe DB_NAME for db:reset");
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

  const migration = await fs.readFile(
    fileFromRepository("database", "migrations", "001_initial_schema.sql"),
    "utf8",
  );
  const orderMigration = await fs.readFile(
    fileFromRepository("database", "migrations", "002_order_integrity.sql"),
    "utf8",
  );
  const seed = await fs.readFile(
    fileFromRepository("database", "seeds", "001_reference_data.sql"),
    "utf8",
  );
  await connection.query(`${migration}\n${orderMigration}\n${seed}`);
  console.log(`Database ${databaseName} reset successfully.`);
} finally {
  await connection.end();
}
