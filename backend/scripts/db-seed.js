import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "clothes_db",
  multipleStatements: true,
});

try {
  const seed = await fs.readFile(
    path.join(repositoryRoot, "database", "seeds", "001_reference_data.sql"),
    "utf8",
  );
  await connection.query(seed);
  console.log("Reference data seeded successfully.");
} finally {
  await connection.end();
}
