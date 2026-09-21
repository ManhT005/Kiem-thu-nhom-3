import mysql from "mysql2";

// Sử dụng process.env để lấy thông tin từ cấu hình của Render
const db = mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "clothes_db",
    port: process.env.DB_PORT || 3306
});

db.connect((err) => {
    if (err) {
        console.error("❌ Kết nối MySQL thất bại:", err.message);
        return;
    }
    console.log("✅ Kết nối MySQL thành công!");
});

export default db;