import db from "../config/db.js";

class User {
  static findByEmail(email, callback) {
    db.query("SELECT * FROM users WHERE email = ?", [email], callback);
  }

  static findById(id, callback) {
    db.query("SELECT * FROM users WHERE id = ?", [id], callback);
  }

  static create({ ten, email, matKhau, role = "user" }, callback) {
    db.query(
      "INSERT INTO users (ten, email, matKhau, role, sdt) VALUES (?, ?, ?, ?, ?)",
      [ten, email, matKhau, role, ""], // sdt để trống hoặc có thể thêm vào params
      callback
    );
  }

  static getAll(callback) {
    db.query("SELECT id, ten, email, role, status FROM users ORDER BY id ASC", callback);
  }


  // ================== [MỚI] THÊM HÀM SET DEFAULT ADDRESS ==================
  static setDefaultAddress(userId, addressId, callback) {
    // Bước 1: Reset tất cả địa chỉ của user này về 0 (không mặc định)
    const sqlReset = "UPDATE DiaChi SET macDinh = 0 WHERE id = ?";
    
    db.query(sqlReset, [userId], (err) => {
        if (err) return callback(err);
        
        // Bước 2: Set địa chỉ được chọn thành 1 (mặc định)
        // Thêm điều kiện AND id = ? để đảm bảo user chỉ set được địa chỉ của chính mình
        const sqlSet = "UPDATE DiaChi SET macDinh = 1 WHERE maDiaChi = ? AND id = ?";
        
        db.query(sqlSet, [addressId, userId], callback);
    });
  }
}

export default User;
