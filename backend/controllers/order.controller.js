import db from "../config/db.js";
import { createOrder as createOrderService } from "../services/order.service.js";
import { success } from "../utils/api-response.js";

// ====================== TẠO ĐƠN HÀNG ===========================
export const createOrder = async (req, res, next) => {
    try {
        const order = await createOrderService({ ...req.body, userId: req.user.id });
        return success(res, {
            status: 201,
            code: "ORDER_CREATED",
            message: "Order created successfully",
            data: order,
        });
    } catch (error) {
        return next(error);
    }
};

// ====================== LẤY ĐƠN HÀNG CỦA TÔI  ===========================
export const getMyOrders = (req, res) => {
    const userId = req.user.id; 

    const query = `
        SELECT 
            d.maDonHang, d.ngayDat, d.trangThai, d.tongTien, d.tenNguoiNhan, d.sdt, d.diaChiGiaoHang, d.ghiChu,
            c.maSP, c.soLuongMua, c.giaMua,
            s.tenSP, s.anhSP,
            sz.tenSize
        FROM DonHang d
        LEFT JOIN ChiTietDonHang c ON d.maDonHang = c.maDonHang
        LEFT JOIN SanPham s ON c.maSP = s.maSP
        LEFT JOIN \`Size\` sz ON c.maSize = sz.maSize
        WHERE d.id = ? 
        ORDER BY d.ngayDat DESC
    `;

    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error("❌ Lỗi SQL getMyOrders:", err); 
            return res.status(500).json({ message: "Lỗi Server khi lấy đơn hàng", error: err.message });
        }

        const ordersMap = {};

        results.forEach(row => {
            if (!ordersMap[row.maDonHang]) {
                ordersMap[row.maDonHang] = {
                    maDonHang: row.maDonHang,
                    ngayDat: row.ngayDat,
                    trangThai: row.trangThai,
                    tongTien: row.tongTien,
                    tenNguoiNhan: row.tenNguoiNhan,
                    sdt: row.sdt,
                    diaChiGiaoHang: row.diaChiGiaoHang,
                    items: []
                };
            }
            if (row.maSP) {
                ordersMap[row.maDonHang].items.push({
                    tenSP: row.tenSP,
                    anhSP: row.anhSP,
                    tenSize: row.tenSize,
                    soLuongMua: row.soLuongMua,
                    giaMua: row.giaMua
                });
            }
        });

        res.status(200).json(Object.values(ordersMap));
    });
};
export const getAllOrders = (req, res) => {
    // Truy vấn lấy đơn hàng kèm thông tin sản phẩm
    const query = `
        SELECT 
            d.maDonHang, d.ngayDat, d.trangThai, d.tongTien, d.tenNguoiNhan, d.sdt, d.diaChiGiaoHang,
            c.maSP, c.soLuongMua, c.maSize,
            s.tenSP, s.anhSP,
            sz.tenSize
        FROM DonHang d
        LEFT JOIN ChiTietDonHang c ON d.maDonHang = c.maDonHang
        LEFT JOIN SanPham s ON c.maSP = s.maSP
        LEFT JOIN \`Size\` sz ON c.maSize = sz.maSize
        ORDER BY d.ngayDat DESC
    `;

    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ message: "Lỗi lấy đơn hàng: " + err.message });

        // Gom nhóm sản phẩm theo đơn hàng
        const ordersMap = {};
        results.forEach(row => {
            if (!ordersMap[row.maDonHang]) {
                ordersMap[row.maDonHang] = {
                    maDonHang: row.maDonHang,
                    ngayDat: row.ngayDat,
                    trangThai: row.trangThai,
                    tongTien: row.tongTien,
                    tenNguoiNhan: row.tenNguoiNhan,
                    sdt: row.sdt,
                    diaChiGiaoHang: row.diaChiGiaoHang,
                    items: []
                };
            }
            if (row.maSP) {
                ordersMap[row.maDonHang].items.push({
                    tenSP: row.tenSP,
                    anhSP: row.anhSP,
                    tenSize: row.tenSize,
                    soLuongMua: row.soLuongMua
                });
            }
        });

        res.status(200).json(Object.values(ordersMap));
    });
};

// ====================== STAFF/ADMIN: CẬP NHẬT TRẠNG THÁI ===========================
export const updateOrderStatus = (req, res) => {
    const { id } = req.params; // Lấy mã đơn hàng từ URL
    const { trangThai } = req.body; // Lấy trạng thái mới từ body

    // 1. Kiểm tra đơn hàng cũ
    db.query("SELECT trangThai FROM DonHang WHERE maDonHang = ?", [id], (err, rows) => {
        if (err || rows.length === 0) return res.status(500).json({ message: "Lỗi tìm đơn hàng" });
        
        // 2. Cập nhật trạng thái
        db.query("UPDATE DonHang SET trangThai = ? WHERE maDonHang = ?", [trangThai, id], (updateErr) => {
            if (updateErr) return res.status(500).json({ message: "Lỗi cập nhật" });

            // 3. LOGIC HOÀN KHO (Nếu hủy đơn -> cộng lại số lượng)
            if (trangThai === 'Đã hủy') {
                const qDetail = "SELECT maSP, maSize, soLuongMua FROM ChiTietDonHang WHERE maDonHang = ?";
                db.query(qDetail, [id], (dErr, items) => {
                    if (!dErr && items) {
                        items.forEach(item => {
                            const qRestore = "UPDATE ChiTietSanPham SET soLuongTon = soLuongTon + ? WHERE maSP = ? AND maSize = ?";
                            db.query(qRestore, [item.soLuongMua, item.maSP, item.maSize]);
                        });
                    }
                });
            }

            res.status(200).json({ message: "Cập nhật thành công!" });
        });
    });
};