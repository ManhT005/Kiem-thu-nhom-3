ALTER TABLE DonHang
    ADD COLUMN payment_status VARCHAR(24) NOT NULL DEFAULT 'NOT_REQUIRED',
    ADD COLUMN payment_expires_at DATETIME NULL,
    ADD INDEX idx_donhang_payment_expiry (payment_status, payment_expires_at);

CREATE TABLE MomoPaymentTransaction (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    maDonHang INT NOT NULL,
    provider_order_id VARCHAR(64) NOT NULL UNIQUE,
    request_id VARCHAR(64) NOT NULL UNIQUE,
    amount BIGINT UNSIGNED NOT NULL,
    status ENUM('PENDING', 'PAID', 'FAILED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    trans_id VARCHAR(64) NULL UNIQUE,
    pay_url TEXT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_momo_payment_order
        FOREIGN KEY (maDonHang) REFERENCES DonHang(maDonHang) ON DELETE CASCADE,
    INDEX idx_momo_payment_order_status (maDonHang, status),
    INDEX idx_momo_payment_expiry (status, expires_at)
);
