import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");
const fileFromRepository = (...parts) => path.join(repositoryRoot, ...parts);

const databaseName = process.env.DB_NAME || "clothes_db";
const connection = await mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
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
