# TÀI LIỆU KẾ HOẠCH PHÁT TRIỂN & MỞ RỘNG DỰ ÁN (PROJECT SCALING PLAN)
**Dự án:** Website Bán Quần Áo (Clothes Shop API)  
**Mục tiêu:** Mở rộng tính năng nghiệp vụ, đặc biệt là Hệ thống Quản trị (Admin/Staff), phục vụ thực hành và đánh giá môn học Kiểm thử phần mềm.  
**Công nghệ nền tảng:** Node.js (Express), MySQL, Postman / Newman.

---

## 1. TỔNG QUAN VÀ MỤC TIÊU MỞ RỘNG

### 1.1. Hiện trạng hệ thống
Hệ thống hiện tại đã xây dựng được khung chức năng cơ bản:
- Xác thực tài khoản (JWT, Bcrypt) với phân quyền sơ khai (`user`, `staff`, `admin`).
- Xem, thêm, sửa, xóa sản phẩm và danh mục (Upload ảnh qua Multer).
- Giỏ hàng và tạo đơn hàng cơ bản 
- Tích hợp cổng thanh toán MoMo Sandbox.

### 1.2. Khoảng trống nghiệp vụ cần mở rộng (Gaps Analysis)
Để phục vụ việc kiểm thử phần mềm đạt điểm tối đa, hệ thống cần nâng cấp các mảng còn yếu:
1. **Phần Quản trị (Admin / Staff) còn sơ sài:** Đơn hàng chỉ cập nhật trạng thái đơn giản; Kho hàng sửa đè số lượng tồn chứ không có chứng từ nhập/xuất; Chưa có cơ chế khóa tài khoản; Chưa có báo cáo thống kê doanh thu.
2. **Thiếu cơ chế ràng buộc nghiệp vụ phức tạp:** Chưa có module Mã giảm giá (Voucher) với các điều kiện biên logic; Chưa có máy trạng thái (State Machine) quản lý vòng đời đơn hàng.
3. **Thiếu tính toàn vẹn dữ liệu (Data Integrity):** Quy trình đặt hàng chưa áp dụng Database Transaction (ACID). Nếu trừ tồn kho lỗi thì đơn vẫn được tạo.
4. **Chuẩn hóa API Response & Error Handling:** Cần chuẩn hóa format JSON trả về để thuận tiện viết Test Script Assertions tự động trên Postman.

---

## 2. ĐẶC TẢ CHI TIẾT CÁC MODULE MỞ RỘNG

### MODULE 1: QUẢN LÝ ĐƠN HÀNG THEO MÁY TRẠNG THÁI (ORDER STATE MACHINE & AUDIT)
* **Mục tiêu:** Kiểm soát vòng đời đơn hàng chặt chẽ, ghi nhận lịch sử thay đổi và cung cấp bộ lọc nâng cao cho Admin.
* **Quy tắc chuyển trạng thái (State Transition Rules):**
  - Trạng thái hợp lệ: `Chờ xác nhận` (Pending) $\to$ `Đã xác nhận` (Confirmed) $\to$ `Đang giao` (Shipping) $\to$ `Hoàn thành` (Completed).
  - Trạng thái `Đã hủy` (Cancelled): Chỉ được phép chuyển từ `Chờ xác nhận` hoặc `Đã xác nhận`. Không được phép hủy khi đơn `Đang giao` hoặc đã `Hoàn thành`.
  - Không cho phép chuyển ngược trạng thái (Ví dụ: từ `Hoàn thành` quay về `Đang giao`, hoặc từ `Đã hủy` sang `Hoàn thành`).
* **Lưu vết lịch sử đơn hàng (Audit Trail):**
  - Tự động ghi lại bảng `LichSuDonHang`: Ai thay đổi (ID nhân viên/admin), trạng thái cũ, trạng thái mới, thời gian, lý do thay đổi.
* **Bộ lọc nâng cao (`GET /api/orders/admin/filter`):**
  - Tham số: `trangThai`, `fromDate`, `toDate`, `minTotal`, `maxTotal`, `keyword` (tìm theo mã đơn, SĐT, tên khách), `page`, `limit`.

### MODULE 2: QUẢN LÝ NHẬP KHO & LỊCH SỬ BIẾN ĐỘNG (INVENTORY & GOODS RECEIPT)
* **Mục tiêu:** Thay thế việc chỉnh sửa trực tiếp `soLuongTon` bằng quy trình tạo phiếu nhập kho chuẩn mực.
* **Chức năng nghiệp vụ:**
  1. **Tạo Phiếu Nhập Kho (`POST /api/kho/nhap-kho`):**
     - Đầu vào: Nhà cung cấp, ghi chú, danh sách sản phẩm cần nhập `[{ maSP, maSize, soLuongNhap, giaNhap }]`.
     - Ràng buộc: `soLuongNhap > 0`, `giaNhap > 0`.
     - Logic xử lý: Sử dụng Transaction để tạo bản ghi trong `PhieuNhap`, `ChiTietPhieuNhap` và tự động cộng dồn số lượng vào bảng `ChiTietSanPham`.
  2. **Cảnh báo Tồn kho thấp (`GET /api/kho/canh-bao-ton`):**
     - Lọc ra các sản phẩm có `soLuongTon <= threshold` (mặc định ngưỡng cảnh báo là 5 sản phẩm).
  3. **Lịch sử biến động kho (`GET /api/kho/lich-su/:maSP`):**
     - Theo dõi vết: Ngày nào nhập hàng (+N), ngày nào bán qua đơn hàng (-N), ngày nào được hoàn kho do khách hủy đơn (+N).

### MODULE 3: QUẢN LÝ TÀI KHOẢN & PHÂN QUYỀN RBAC (USER LIFECYCLE & ACCESS CONTROL)
* **Mục tiêu:** Thiết lập ranh giới quyền lực rõ ràng giữa 3 vai trò: `user`, `staff`, `admin`.
* **Chức năng nghiệp vụ:**
  1. **Khóa / Mở khóa tài khoản (`PUT /api/users/:id/status`):**
     - Admin có thể chuyển trạng thái tài khoản: `ACTIVE` hoặc `LOCKED`.
     - Nếu tài khoản bị `LOCKED`: Chặn đăng nhập (`403 Account is locked`). Nếu người dùng đang cầm Token hợp lệ gọi API, middleware phải kiểm tra trạng thái trong DB và chặn ngay lập tức.
  2. **Ma trận phân quyền (RBAC Matrix):**
     - **User:** Quản lý profile, địa chỉ, giỏ hàng, đặt hàng, xem và hủy đơn của chính mình.
     - **Staff:** Quản lý danh mục, xem kho, tạo phiếu nhập kho, duyệt đơn hàng. **Không có quyền:** Xóa người dùng, đổi role, xóa sản phẩm, xem thống kê doanh thu.
     - **Admin:** Toàn quyền trên mọi API.

### MODULE 4: QUẢN LÝ VOUCHER & KHUYẾN MÃI (VOUCHER & PROMOTIONS)
* **Mục tiêu:** Tạo module có nhiều điều kiện logic phụ thuộc phục vụ kỹ thuật Bảng quyết định (Decision Table) và Phân tích giá trị biên (BVA).
* **Chức năng nghiệp vụ:**
  1. **CRUD Voucher (`/api/admin/vouchers`):**
     - `maCode`: Mã viết hoa, không khoảng trắng, duy nhất (VD: `SALE50K`, `DISCOUNT10`).
     - `loaiGiam`: `PERCENT` (% giảm) hoặc `FIXED` (tiền cố định).
     - `giaTriGiam`: Nếu là `PERCENT` thì $1 \le giaTriGiam \le 100$.
     - `giamToiDa`: Số tiền tối đa được giảm (nếu là %).
     - `giaTriDonToiThieu`: Giá trị đơn hàng tối thiểu để được áp mã.
     - `soLuongPhatHanh`: Tổng số lượt sử dụng tối đa.
     - `ngayBatDau`, `ngayKetThuc`, `trangThai` (Bật/Tắt).
  2. **API Áp dụng Voucher (`POST /api/vouchers/apply`):**
     - Kiểm tra: Mã có tồn tại không? Đang bật không? Trong thời gian hiệu lực không? Đã hết lượt dùng chưa? Giá trị đơn hàng có đạt mức tối thiểu không?
     - Trả về: Số tiền được giảm chính xác và tổng tiền sau giảm.

### MODULE 5: API BÁO CÁO & THỐNG KÊ DOANH THU (ANALYTICS & DASHBOARD)
* **Mục tiêu:** Phục vụ kiểm thử độ chính xác tính toán và kiểm thử hiệu năng API.
* **Chức năng nghiệp vụ:**
  1. `GET /api/admin/dashboard/summary`: Thống kê tổng doanh thu (chỉ tính đơn `Hoàn thành`), tổng số đơn theo từng trạng thái, tổng số người dùng, tổng số sản phẩm.
  2. `GET /api/admin/dashboard/top-products?limit=5`: Top 5 sản phẩm bán chạy nhất kèm số lượng đã bán.
  3. `GET /api/admin/dashboard/revenue-chart?year=2026`: Thống kê doanh thu theo từng tháng trong năm.

### MODULE 6: CHUẨN HÓA KIẾN TRÚC & VALIDATION
* **Format Response chuẩn RESTful:**
  ```json
  {
    "success": true,
    "code": "SUCCESS",
    "message": "Mô tả kết quả",
    "data": { ... }
  }
  ```
* **Format Error chuẩn:**
  ```json
  {
    "success": false,
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu đầu vào không hợp lệ",
    "errors": [
      { "field": "email", "message": "Email không đúng định dạng" }
    ]
  }
  ```
* **Áp dụng Database Transaction:** Bắt buộc cho luồng Đặt hàng (`createOrder`) và Nhập kho (`createGoodsReceipt`).

---

## 3. THIẾT KẾ CƠ SỞ DỮ LIỆU CẬP NHẬT (SCHEMA EVOLUTION)

```sql
-- 1. Bổ sung trạng thái khóa tài khoản
ALTER TABLE users ADD COLUMN trangThai ENUM('ACTIVE', 'LOCKED') DEFAULT 'ACTIVE';

-- 2. Bảng Phiếu Nhập Kho
CREATE TABLE IF NOT EXISTS PhieuNhap (
    maPhieuNhap INT AUTO_INCREMENT PRIMARY KEY,
    ngayNhap DATETIME DEFAULT CURRENT_TIMESTAMP,
    nhaCungCap VARCHAR(150) NOT NULL,
    tongTienNhap INT DEFAULT 0,
    nguoiTao INT,
    ghiChu TEXT,
    FOREIGN KEY (nguoiTao) REFERENCES users(id) ON DELETE SET NULL
);

-- 3. Bảng Chi Tiết Phiếu Nhập
CREATE TABLE IF NOT EXISTS ChiTietPhieuNhap (
    maPhieuNhap INT,
    maSP INT,
    maSize INT,
    soLuongNhap INT NOT NULL,
    giaNhap INT NOT NULL,
    PRIMARY KEY (maPhieuNhap, maSP, maSize),
    FOREIGN KEY (maPhieuNhap) REFERENCES PhieuNhap(maPhieuNhap) ON DELETE CASCADE,
    FOREIGN KEY (maSP) REFERENCES SanPham(maSP) ON DELETE CASCADE,
    FOREIGN KEY (maSize) REFERENCES Size(maSize) ON DELETE CASCADE
);

-- 4. Bảng Lịch Sử Trạng Thái Đơn Hàng (Audit Log)
CREATE TABLE IF NOT EXISTS LichSuDonHang (
    maLichSu INT AUTO_INCREMENT PRIMARY KEY,
    maDonHang INT NOT NULL,
    trangThaiCu VARCHAR(50),
    trangThaiMoi VARCHAR(50) NOT NULL,
    thoiGian DATETIME DEFAULT CURRENT_TIMESTAMP,
    nguoiThayDoi INT,
    lyDo TEXT,
    FOREIGN KEY (maDonHang) REFERENCES DonHang(maDonHang) ON DELETE CASCADE,
    FOREIGN KEY (nguoiThayDoi) REFERENCES users(id) ON DELETE SET NULL
);

-- 5. Nâng cấp Bảng Giảm Giá (Voucher)
ALTER TABLE GiamGia 
ADD COLUMN maCode VARCHAR(50) UNIQUE AFTER maGiamGia,
ADD COLUMN loaiGiam ENUM('PERCENT', 'FIXED') DEFAULT 'PERCENT',
ADD COLUMN giamToiDa INT DEFAULT 0,
ADD COLUMN giaTriDonToiThieu INT DEFAULT 0,
ADD COLUMN soLuongPhatHanh INT DEFAULT 100,
ADD COLUMN soLuongDaDung INT DEFAULT 0,
ADD COLUMN trangThai TINYINT(1) DEFAULT 1;
```

---

## 4. LỘ TRÌNH TRIỂN KHAI THEO GIAI ĐOẠN (IMPLEMENTATION ROADMAP)

| Giai đoạn | Mục tiêu chính | Đầu ra (Deliverables) | Đối tượng hưởng lợi |
| :--- | :--- | :--- | :--- |
| **Giai đoạn 1** | Chuẩn hóa Response & Ràng buộc Validation đầu vào | Middleware validate cho Auth, User, Cart. Chuẩn hóa format JSON. | Tester viết assertions và Negative tests. |
| **Giai đoạn 2** | Nâng cấp Quản lý Đơn hàng (State Machine) & Transaction | API đổi trạng thái chuẩn, API hủy đơn, Bảng `LichSuDonHang`, Bộ lọc đơn hàng. | Tester kiểm thử State Transition & Filter. |
| **Giai đoạn 3** | Xây dựng Module Nhập kho & Tồn kho thực tế | API Phiếu nhập, API Cảnh báo hết hàng, Bảng `PhieuNhap`, `ChiTietPhieuNhap`. | Tester kiểm thử tính toán tồn kho, giá vốn. |
| **Giai đoạn 4** | Xây dựng Module Voucher & Phân quyền RBAC nâng cao | CRUD Voucher, API áp dụng voucher, API Khóa/Mở khóa User, Phân quyền Staff. | Tester kiểm thử Decision Table & RBAC. |
| **Giai đoạn 5** | Xây dựng API Thống kê Dashboard & Seed dữ liệu | API Summary, Top sản phẩm, Doanh thu. Script SQL tạo data test tự động. | Tester kiểm thử Performance & Data Integrity. |
