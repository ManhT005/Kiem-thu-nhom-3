import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

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
    path.resolve("database/seeds/001_reference_data.sql"),
    "utf8",
  );
  await connection.query(seed);
  console.log("Reference data seeded successfully.");
} finally {
  await connection.end();
}
