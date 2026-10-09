CREATE TABLE IF NOT EXISTS LichSuDonHang (
    maLichSu BIGINT AUTO_INCREMENT PRIMARY KEY,
    maDonHang INT NOT NULL,
    trangThaiCu VARCHAR(50),
    trangThaiMoi VARCHAR(50) NOT NULL,
    nguoiThayDoi INT NULL,
    lyDo VARCHAR(500) NULL,
    thoiGian DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (maDonHang)
        REFERENCES DonHang(maDonHang)
        ON DELETE CASCADE,
    FOREIGN KEY (nguoiThayDoi)
        REFERENCES users(id)
        ON DELETE SET NULL,
    INDEX idx_lichsu_donhang (maDonHang, thoiGian)
);

CREATE INDEX idx_donhang_user_date ON DonHang(id, ngayDat);
CREATE INDEX idx_donhang_status_date ON DonHang(trangThai, ngayDat);

INSERT INTO LichSuDonHang
    (maDonHang, trangThaiCu, trangThaiMoi, nguoiThayDoi, lyDo)
SELECT
    maDonHang,
    trangThai,
    CASE
        WHEN trangThai IN ('Pending', 'pending') THEN 'Chờ xác nhận'
        WHEN trangThai = 'Đang xử lý' THEN 'Đã xác nhận'
        WHEN trangThai = 'shipping' THEN 'Đang giao'
        WHEN trangThai IN ('Đã giao', 'completed') THEN 'Hoàn thành'
        WHEN trangThai IN ('cancelled', 'canceled') THEN 'Đã hủy'
    END,
    NULL,
    'LEGACY_STATUS_NORMALIZED'
FROM DonHang
WHERE trangThai IN (
    'Pending', 'pending', 'Đang xử lý', 'shipping',
    'Đã giao', 'completed', 'cancelled', 'canceled'
);

UPDATE DonHang
SET trangThai = CASE
    WHEN trangThai IN ('Pending', 'pending') THEN 'Chờ xác nhận'
    WHEN trangThai = 'Đang xử lý' THEN 'Đã xác nhận'
    WHEN trangThai = 'shipping' THEN 'Đang giao'
    WHEN trangThai IN ('Đã giao', 'completed') THEN 'Hoàn thành'
    WHEN trangThai IN ('cancelled', 'canceled') THEN 'Đã hủy'
END
WHERE trangThai IN (
    'Pending', 'pending', 'Đang xử lý', 'shipping',
    'Đã giao', 'completed', 'cancelled', 'canceled'
);