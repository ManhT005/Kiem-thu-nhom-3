# Bộ seed data demo đầy đủ — 64 sản phẩm quần áo

Nguồn đối chiếu: <https://github.com/ManhT005/Kiem-thu-nhom-3>, nhánh `develop`, ngày 23/10/2026. Seed tương thích schema MySQL 8 sau khi chạy đủ migration **001–006**. Script được thiết kế cho **máy local / cơ sở dữ liệu demo**, không dành cho production.

## 1. Nội dung được tạo

| Nhóm | Dữ liệu demo |
|---|---:|
| `users` | 16 tài khoản (2 admin, 2 staff, 12 user; có 1 user LOCKED) |
| `danhMuc` | 12 danh mục |
| `Size` | 5 size S, M, L, XL, XXL (tái sử dụng nếu đã tồn tại) |
| `phuongThucThanhToan` | COD, BANK_TRANSFER, MOMO (tái sử dụng nếu đã tồn tại) |
| `SanPham`, `SanPham_DanhMuc`, `HinhAnh` | 64 sản phẩm, liên kết danh mục, ảnh có sẵn trong repo |
| `ChiTietSanPham` | 320 biến thể size, gồm hàng ít / hết hàng / ngừng bán |
| `GioHang`, `ChiTietGioHang` | 8 giỏ hàng, 24 mặt hàng trong giỏ |
| `DiaChi` | 24 địa chỉ, mỗi user 1 địa chỉ mặc định |
| `GiamGia`, `VoucherAudit` | 7 voucher: đang sử dụng, hết hạn, chưa bắt đầu, đã tắt |
| `PhieuNhap`, `ChiTietPhieuNhap` | 6 phiếu nhập / 24 dòng (4 POSTED, 2 DRAFT) |
| `StockAdjustment`, `InventoryMovement` | 4 lần điều chỉnh cùng sổ cái tồn kho, OPENING/RECEIPT/ADJUSTMENT/ORDER/CANCEL |
| `DonHang`, `ChiTietDonHang`, `LichSuDonHang` | 35 đơn + chi tiết + lịch sử đủ 5 trạng thái |
| `OrderCheckoutRequest` | 35 khóa idempotency cho 35 đơn |
| `MomoPaymentTransaction` | Giao dịch MoMo **giả lập**, PAID và EXPIRED; không gọi MoMo thật |
| `VoucherRedemption` | Dữ liệu đặt chỗ / sử dụng / hoàn voucher, `used_count` đồng bộ |
| `UserLifecycleAudit` | 3 bản ghi ví dụ về quản lý trạng thái tài khoản |
| `schema_migrations` | Được công cụ migration của repo quản lý, script không sửa |

**Tính an toàn:** không `DROP`, `TRUNCATE`, hay `DELETE`; thêm dữ liệu trong **một transaction**; dữ liệu mẫu có email, voucher code, receipt code và checkout key phân biệt. Chạy lại không nhân đôi dữ liệu demo đã có. Tuy vậy, đừng dùng seed trên database thật: các dòng dữ liệu sẽ được thêm vào database đã chọn.

## 2. Cài đặt trên Mac — từ thư mục repository

Dùng nhánh `feat/full-demo-seed-64-products` trên GitHub (được tạo từ `develop`), vì script đã nằm sẵn tại `backend/scripts/db-seed-full-demo.js`.

Mở Terminal:

```bash
cd ~/Documents/Kiem_thu_phan_mem/Kiem-thu-nhom-3/backend
npm install
```

Nếu thiếu `.env`:

```bash
cp .env.example .env
nano .env
```

Trong `.env`, cấu hình theo MySQL đang dùng (thay mật khẩu bằng mật khẩu riêng của bạn):

```dotenv
NODE_ENV=development
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=MAT_KHAU_MYSQL_CUA_BAN
DB_NAME=clothes_demo_test
JWT_SECRET=THAY_BANG_CHUOI_BI_MAT_NGAU_NHIEN_TOI_THIEU_32_KY_TU
```

Để tạo chuỗi JWT_SECRET trên macOS, chạy `openssl rand -hex 32` rồi sao chép kết quả vào `.env`.

### A. Nếu muốn **database demo mới, riêng biệt** (khuyên dùng)

Đảm bảo MySQL 8 đang chạy. Với `DB_NAME=clothes_demo_test`, chạy:

```bash
npm run db:reset
npm run db:seed:demo
npm start
```

**CẢNH BÁO:** `db:reset` sẽ xóa và tạo lại toàn bộ database trong biến `DB_NAME`. Chỉ chạy trên database demo/test mới hoặc nơi bạn chủ động chấp nhận mất toàn bộ dữ liệu. Repo chỉ cho reset DB có tên kết thúc `_test`.

Sau đó vào: <http://localhost:3000>

### B. Nếu đã có database chứa dữ liệu cần giữ

**Không chạy `db:reset`.** Backup MySQL trước. Thiết lập `DB_NAME` đúng database của bạn và chạy:

```bash
npm run db:migrate:status
npm run db:migrate
npm run db:seed:demo
npm start
```

`db:migrate` phải chạy trên schema phù hợp; nếu database có migration bị gián đoạn hoặc schema đã được thay đổi thủ công, kiểm tra và sửa trước khi seed. Script tự từ chối chạy nếu không có đủ migration 001–006 ở trạng thái APPLIED.

## 3. Tài khoản đăng nhập mẫu

Mật khẩu **chung cho các tài khoản demo**: `Demo@123456` (lưu trong MySQL dưới dạng bcrypt hash, không phải văn bản thuần).

| Vai trò | Email | Mật khẩu | Trạng thái |
|---|---|---|---|
| Admin | `demo-admin@example.test` | `Demo@123456` | ACTIVE |
| Admin 2 | `demo-admin2@example.test` | `Demo@123456` | ACTIVE |
| Staff | `demo-staff@example.test` | `Demo@123456` | ACTIVE |
| Staff 2 | `demo-staff2@example.test` | `Demo@123456` | ACTIVE |
| User | `demo-customer01@example.test` | `Demo@123456` | ACTIVE |
| User 2–11 | `demo-customer02@example.test` ... `demo-customer11@example.test` | `Demo@123456` | ACTIVE |
| User bị khóa | `demo-customer12@example.test` | `Demo@123456` | LOCKED (đăng nhập bị từ chối) |

Vì đây là tài khoản test có mật khẩu công khai trong tài liệu, **không triển khai trên hệ thống public/production**.

## 4. Voucher demo

- `DEMO10`: giảm 10%, tối đa 50.000đ, đơn từ 100.000đ.
- `DEMO30K`: giảm 30.000đ, đơn từ 200.000đ.
- `DEMOVIP15`: giảm 15%, tối đa 150.000đ, đơn từ 500.000đ.
- `DEMOFREESHIP`: giảm cố định 25.000đ, đơn từ 150.000đ (minh họa ưu đãi, không tự tắt phí vận chuyển).
- `DEMOEXPIRED`: voucher đã hết hạn.
- `DEMOFUTURE`: voucher chưa đến ngày áp dụng.
- `DEMODISABLED`: voucher bị vô hiệu hóa.

Các voucher dùng ngày tương đối theo thời điểm chạy lần đầu; ngày kết thúc tự động trong tương lai đối với các mã hoạt động. Nếu chạy lại sau rất lâu, seed **không tự sửa** hạn voucher hay đơn cũ.

## 5. Kiểm tra dữ liệu sau khi chạy

Mở MySQL và chọn database demo:

```sql
USE clothes_demo_test;

SELECT COUNT(*) AS users FROM users WHERE email LIKE 'demo-%@example.test';
SELECT COUNT(*) AS products FROM SanPham WHERE moTa LIKE '[FULL_DEMO_SEED_V1:%';
SELECT trangThai, COUNT(*) AS soDon FROM DonHang
  WHERE ghiChu LIKE '[FULL_DEMO_SEED_V1]%' GROUP BY trangThai;
SELECT status, COUNT(*) AS soPhieu FROM PhieuNhap
  WHERE maPhieu LIKE 'DEMO-GR-%' GROUP BY status;
SELECT code, enabled, used_count FROM GiamGia WHERE code LIKE 'DEMO%';

-- Sai lệch kho bằng 0 là trạng thái mong muốn:
SELECT ct.maSP,ct.maSize,ct.soLuongTon,
       COALESCE(SUM(m.delta),0) AS luongTheoSoCai,
       ct.soLuongTon - COALESCE(SUM(m.delta),0) AS saiLech
FROM ChiTietSanPham ct JOIN SanPham sp ON sp.maSP=ct.maSP
LEFT JOIN InventoryMovement m ON m.maSP=ct.maSP AND m.maSize=ct.maSize
WHERE sp.moTa LIKE '[FULL_DEMO_SEED_V1:%'
GROUP BY ct.maSP,ct.maSize,ct.soLuongTon
HAVING saiLech <> 0;
```

Có thể thử đăng nhập, xem sản phẩm/size, giỏ hàng, đơn của khách, màn hình quản trị, phiếu nhập, điều chỉnh kho, voucher, dashboard và màn hình đối soát MoMo. Giao dịch MoMo chỉ là dữ liệu lịch sử **giả lập**; không đại diện thanh toán thực.

## 6. Lưu ý về kiểm thử và việc chạy lại

- Dữ liệu demo không thay thế các fixture cố định dành riêng cho test suite Phase 2 (`npm run db:seed:phase2`). Các bộ kiểm thử tích hợp có thể reset/viết database test của chính chúng.
- Khi chạy lại, script nhận diện user bằng email, sản phẩm bằng marker trong mô tả, phiếu nhập bằng `maPhieu`, voucher bằng code, đơn hàng bằng khóa `OrderCheckoutRequest`. **Không tự khôi phục dữ liệu bị bạn sửa thủ công**.
- Một database đã chứa dữ liệu thật có thể có các nhóm dữ liệu không khớp sổ cái; script sẽ kiểm tra ledger các biến thể demo sau khi xử lý.
- Đã kiểm tra cú pháp JavaScript bằng Node.js 22. **Chưa chạy thử kết nối MySQL trên máy của bạn**, do vậy cần chạy lệnh và theo dõi lỗi cấu hình / quyền DB trong môi trường local.

## 7. Vị trí file

Nếu tải ZIP, giải nén ZIP **vào thư mục gốc repository** sao cho file có đường dẫn:

```
Kiem-thu-nhom-3/
  backend/
    scripts/
      db-seed-full-demo.js
```

Từ `backend/` chạy `npm run db:seed:demo`; không phải chạy `npm run db:seed` vì lệnh có sẵn của repo chỉ tạo reference data.
## 8. Nhánh GitHub

`feat/full-demo-seed-64-products` tách từ `develop`, dữ liệu demo chứa **64 sản phẩm × 5 size = 320 biến thể**, dùng ảnh hiện có của repo (một số ảnh được sử dụng cho nhiều sản phẩm). Chạy seed trên database test riêng. Seed chạy nhiều lần không tự nhân đôi bản ghi của nó, không đảm bảo cơ sở dữ liệu chỉ có đúng 64 sản phẩm nếu đã tồn tại dữ liệu khác.
