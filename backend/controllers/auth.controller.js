import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/users.js";
import { SECRET_KEY, JWT_EXPIRES_IN } from "../config/config.js";

// ====================== REGISTER ===========================
export const register = (req, res) => {
  const { ten, email, matKhau } = req.body;

  if (!ten || !email || !matKhau)
    return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin" });

  User.findByEmail(email, (err, result) => {
    if (err) return res.status(500).json({ message: "Lỗi server" });
    if (result.length > 0)
      return res.status(400).json({ message: "Email đã tồn tại" });

    // MÃ HÓA MẬT KHẨU
    const hashedPassword = bcrypt.hashSync(matKhau, 10);

    // ROLE mặc định là user
    const newUser = {
      ten,
      email,
      matKhau: hashedPassword,
      role: "user",
    };

    User.create(newUser, (err, result) => {
      if (err) return res.status(500).json({ message: "Lỗi server" });
      res.json({ message: "Đăng ký thành công" });
    });
  });
};

// ====================== LOGIN ===========================
export const login = (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin" });

  User.findByEmail(email, (err, result) => {
    if (err) return res.status(500).json({ message: "Lỗi server" });
    if (result.length === 0)
      return res.status(400).json({ message: "Email không tồn tại" });

    const user = result[0];

    // SO SÁNH BẰNG matKhau TRONG DB
    const valid = bcrypt.compareSync(password, user.matKhau);
    if (!valid) return res.status(400).json({ message: "Sai mật khẩu" });

    // TẠO TOKEN
    const token = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, {
      expiresIn: JWT_EXPIRES_IN,
    });

    res.json({
      message: "Đăng nhập thành công",
      token,
      user: {
        id: user.id,
        ten: user.ten,
        email: user.email,
        role: user.role,
      },
    });
  });
};
