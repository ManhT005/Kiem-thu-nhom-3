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