ALTER TABLE users
  ADD COLUMN status ENUM('ACTIVE','LOCKED') NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN token_version INT UNSIGNED NOT NULL DEFAULT 0,
  ADD INDEX idx_users_role_status (role, status, id);
CREATE TABLE UserLifecycleAudit (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  actor_id INT NULL,
  operation VARCHAR(32) NOT NULL,
  reason VARCHAR(500) NOT NULL,
  before_state JSON NOT NULL,
  after_state JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_audit (user_id, created_at)
);

ALTER TABLE GiamGia
  ADD COLUMN code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL UNIQUE,
  ADD COLUMN discount_type ENUM('PERCENT','FIXED') NOT NULL DEFAULT 'PERCENT',
  ADD COLUMN discount_value DECIMAL(14,2) NOT NULL DEFAULT 1,
  ADD COLUMN minimum_order_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN maximum_discount_amount DECIMAL(14,2) NULL,
  ADD COLUMN start_at DATETIME(3) NULL,
  ADD COLUMN end_at DATETIME(3) NULL,
  ADD COLUMN usage_limit INT UNSIGNED NULL,
  ADD COLUMN used_count INT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN per_user_limit INT UNSIGNED NOT NULL DEFAULT 1,
  ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
UPDATE GiamGia SET code = CONCAT('LEGACY-', maGiamGia),
  discount_value = LEAST(100, GREATEST(1, chietKhau)),
  start_at = CAST(ngayBatDau AS DATETIME),
  end_at = DATE_ADD(CAST(ngayKetThuc AS DATETIME), INTERVAL 1 DAY);
ALTER TABLE GiamGia
  MODIFY code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  MODIFY start_at DATETIME(3) NOT NULL,
  MODIFY end_at DATETIME(3) NOT NULL,
  ADD CONSTRAINT chk_voucher_value CHECK (discount_value > 0 AND (discount_type <> 'PERCENT' OR discount_value <= 100)),
  ADD CONSTRAINT chk_voucher_money CHECK (minimum_order_amount >= 0 AND (maximum_discount_amount IS NULL OR maximum_discount_amount >= 0));

ALTER TABLE DonHang
  MODIFY tongTien BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN subtotal_before_discount BIGINT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN discount_amount BIGINT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN voucher_code_snapshot VARCHAR(64) NULL;
UPDATE DonHang SET subtotal_before_discount = tongTien;
CREATE TABLE VoucherRedemption (
  redemption_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  voucher_id INT NOT NULL,
  order_id INT NOT NULL UNIQUE,
  user_id INT NULL,
  discount_amount BIGINT UNSIGNED NOT NULL,
  status ENUM('RESERVED','COMMITTED','RELEASED') NOT NULL DEFAULT 'RESERVED',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  released_at DATETIME(3) NULL,
  FOREIGN KEY (voucher_id) REFERENCES GiamGia(maGiamGia),
  FOREIGN KEY (order_id) REFERENCES DonHang(maDonHang) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY uq_redemption (voucher_id, order_id),
  INDEX idx_voucher_user_usage (voucher_id, user_id, status)
);
CREATE TABLE VoucherAudit (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  voucher_id INT NOT NULL,
  actor_id INT NULL,
  operation VARCHAR(32) NOT NULL,
  before_state JSON NULL,
  after_state JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (voucher_id) REFERENCES GiamGia(maGiamGia),
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
);
