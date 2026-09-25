import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

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
    path.resolve("database/migrations/001_initial_schema.sql"),
    "utf8",
  );
  const seed = await fs.readFile(
    path.resolve("database/seeds/001_reference_data.sql"),
    "utf8",
  );
  await connection.query(`${migration}\n${seed}`);
  console.log(`Database ${databaseName} reset successfully.`);
} finally {
  await connection.end();
}
