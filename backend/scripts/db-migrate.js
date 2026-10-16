import "dotenv/config";
import mysql from "mysql2/promise";
import { applyMigrations } from "./migration-runner.js";

if (!process.env.DB_NAME) throw new Error("Set DB_NAME explicitly for db:migrate");
const connection = await mysql.createConnection({
  host: process.env.DB_HOST || "127.0.0.1", port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root", password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME, multipleStatements: true, timezone: "Z",
});
try {
  await connection.query("SET time_zone = '+00:00'");
  await applyMigrations(connection, { statusOnly: process.argv.includes("--status") });
} finally { await connection.end(); }
