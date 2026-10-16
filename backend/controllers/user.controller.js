import User from "../models/users.js";
import db from "../config/db.js"; // Import DB để dùng cho các query custom
import { changeUserLifecycle, listUsers } from "../services/user-lifecycle.service.js";

// ====================== LẤY DANH SÁCH USERS (ADMIN) ===========================
// (Giữ nguyên code cũ của bạn)
export const getAllUsers = async (req, res, next) => {
  try {
    const result = await listUsers(req.query);
    return res.json({ users: result.items, pagination: result.pagination });
  } catch (error) { return next(error); }
};

// ====================== LẤY PROFILE (SỬA ĐỂ LẤY THÊM CỘT macDinh) ===========================
export const getProfile = (req, res) => {
  const userId = req.user.id;

  // 1. Lấy thông tin User
  const queryUser = "SELECT id, ten AS username, email, sdt AS phone, role FROM users WHERE id = ?";
  
  db.query(queryUser, [userId], (err, userResults) => {
    if (err) return res.status(500).json({ message: "Lỗi server", error: err });
    if (userResults.length === 0) return res.status(404).json({ message: "User not found" });

    const user = userResults[0];

    // 2. Lấy danh sách địa chỉ (SỬA: Thêm cột macDinh vào SELECT)
    const queryAddr = "SELECT maDiaChi, tenDiaChi, macDinh FROM DiaChi WHERE id = ? ORDER BY macDinh DESC, maDiaChi DESC";
    
    db.query(queryAddr, [userId], (err, addrResults) => {
      if (err) return res.status(500).json({ message: "Lỗi lấy địa chỉ", error: err });

      // Gán danh sách địa chỉ vào object user trả về
      user.addresses = addrResults; 
      res.json(user);
    });
  });
};

// ====================== CẬP NHẬT THÔNG TIN CÁ NHÂN (Tên, SĐT) ===========================
export const updateProfile = (req, res) => {
  const userId = req.user.id;
  const { username, phone } = req.body;

  const query = "UPDATE users SET ten = ?, sdt = ? WHERE id = ?";
  
  db.query(query, [username, phone, userId], (err, result) => {
    if (err) return res.status(500).json({ message: "Lỗi cập nhật", error: err });
    res.json({ message: "Cập nhật thông tin cá nhân thành công!" });
  });
};

// ====================== THÊM ĐỊA CHỈ MỚI ===========================
export const addAddress = (req, res) => {
    const userId = req.user.id;
    const { address } = req.body;

    if (!address) return res.status(400).json({ message: "Địa chỉ không được để trống" });

    const query = "INSERT INTO DiaChi (tenDiaChi, id) VALUES (?, ?)";
    
    db.query(query, [address, userId], (err, result) => {
        if (err) return res.status(500).json({ message: "Lỗi thêm địa chỉ", error: err });
        res.json({ message: "Thêm địa chỉ thành công", id: result.insertId });
    });
};

// ====================== XÓA ĐỊA CHỈ ===========================
export const deleteAddress = (req, res) => {
    const userId = req.user.id;
    const { id } = req.params; // id của địa chỉ cần xóa

    const query = "DELETE FROM DiaChi WHERE maDiaChi = ? AND id = ?";
    
    db.query(query, [id, userId], (err, result) => {
        if (err) return res.status(500).json({ message: "Lỗi xóa địa chỉ", error: err });
        res.json({ message: "Đã xóa địa chỉ" });
    });
};

// ================== [MỚI] THÊM API SET DEFAULT ADDRESS ==================
export const setDefaultAddress = (req, res) => {
    const userId = req.user.id; // Lấy ID user từ token
    const addressId = req.params.id; // Lấy ID địa chỉ từ URL

    if (!addressId) return res.status(400).json({ message: "Thiếu ID địa chỉ" });

    User.setDefaultAddress(userId, addressId, (err, result) => {
        if (err) {
            console.error("Lỗi set default address:", err);
            return res.status(500).json({ message: "Lỗi server" });
        }
        
        // Kiểm tra xem có dòng nào được update không (nếu = 0 nghĩa là ID địa chỉ sai hoặc không phải của user này)
        if (result.affectedRows === 0) {
             return res.status(404).json({ message: "Không tìm thấy địa chỉ hoặc bạn không có quyền" });
        }

        res.json({ message: "Đã đặt làm địa chỉ mặc định thành công" });
    });
};

// ====================== XÓA USER (ADMIN) ===========================
// (Giữ nguyên code cũ của bạn)
// Legacy endpoints route through the same lifecycle transaction; no physical account deletion.
export const deleteUser = async (req, res, next) => {
  try {
    const user = await changeUserLifecycle({ userId: req.params.id, actorId: req.user.id, actorVersion: req.user.token_version,
      operation: "LOCK", reason: req.body?.reason || "Disabled through legacy user management" });
    return res.json({ message: "Tài khoản đã được khóa", user });
  } catch (error) { return next(error); }
};
export const updateUserRole = async (req, res, next) => {
  try {
    const user = await changeUserLifecycle({ userId: req.params.id, actorId: req.user.id, actorVersion: req.user.token_version,
      operation: "ROLE", role: req.body.role, reason: req.body.reason || "Role changed through legacy user management" });
    return res.json({ message: "Đã thay đổi quyền và thu hồi token cũ", user });
  } catch (error) { return next(error); }
};
