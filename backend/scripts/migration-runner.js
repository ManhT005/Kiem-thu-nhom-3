import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const folder = fileURLToPath(new URL("../../database/migrations/", import.meta.url));
export async function applyMigrations(connection, { statusOnly = false, through = 999 } = {}) {
  const [names] = await connection.query("SELECT DATABASE() AS name");
  const lock = "schema-" + createHash("sha256").update(names[0].name || "").digest("hex").slice(0, 50);
  const [[acquired]] = await connection.execute("SELECT GET_LOCK(?, 10) AS acquired", [lock]);
  if (acquired.acquired !== 1) throw new Error("Another schema migration is running");
  try {
    if (!statusOnly) await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) PRIMARY KEY, checksum CHAR(64) NOT NULL,
      state ENUM('APPLYING','APPLIED') NOT NULL, applied_at DATETIME NULL)`);
    const [metadata] = await connection.query("SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = DATABASE() AND TABLE_NAME = 'schema_migrations'");
    const [records] = metadata.length ? await connection.query("SELECT * FROM schema_migrations") : [[]];
    const registry = new Map(records.map((row) => [row.name, row]));
    const files = (await readdir(folder)).filter((name) => /^\d{3}_.+\.sql$/.test(name) && Number(name.slice(0,3)) <= through).sort();
    if (new Set(files.map((name) => name.slice(0,3))).size !== files.length) throw new Error("Duplicate migration numbers");
    const [tables] = await connection.query("SELECT TABLE_NAME AS name FROM information_schema.tables WHERE table_schema = DATABASE()");
    const existing = new Set(tables.map((row) => row.name));
    const markers = { "001": "users", "002": "LichSuDonHang", "003": "MomoPaymentTransaction", "004": "OrderCheckoutRequest" };
    for (const name of files) {
      const sql = await readFile(folder + "/" + name, "utf8");
      const checksum = createHash("sha256").update(sql.replace(/\r\n/g, "\n")).digest("hex");
      const record = registry.get(name);
      if (record) {
        if (record.state !== "APPLIED") throw new Error(`Migration ${name} was interrupted; inspect partial DDL before retry`);
        if (record.checksum !== checksum) throw new Error(`Applied migration checksum changed: ${name}`);
        console.log("APPLIED " + name);
        continue;
      }
      // Adopt only known legacy baseline migrations using their existing schema markers.
      if (!records.length && markers[name.slice(0,3)] && existing.has(markers[name.slice(0,3)])) {
        if (!statusOnly) await connection.execute("INSERT INTO schema_migrations VALUES (?, ?, 'APPLIED', NOW())", [name, checksum]);
        console.log("BASELINE " + name);
        continue;
      }
      console.log("PENDING " + name);
      if (statusOnly) continue;
      if (name.startsWith("005_")) {
        const [[invalid]] = await connection.query("SELECT COUNT(*) AS count FROM ChiTietSanPham WHERE soLuongTon IS NULL OR soLuongTon < 0");
        if (invalid.count) throw new Error("Inventory migration requires nonnegative, non-null legacy stock; reconcile invalid variants first");
      }
      await connection.execute("INSERT INTO schema_migrations VALUES (?, ?, 'APPLYING', NULL)", [name, checksum]);
      await connection.query(sql);
      await connection.execute("UPDATE schema_migrations SET state = 'APPLIED', applied_at = NOW() WHERE name = ?", [name]);
    }
  } finally { await connection.execute("SELECT RELEASE_LOCK(?)", [lock]); }
}
