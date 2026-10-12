ALTER TABLE ChiTietSanPham
  MODIFY soLuongTon INT NOT NULL DEFAULT 0,
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD CONSTRAINT chk_variant_stock CHECK (soLuongTon >= 0);

CREATE TABLE PhieuNhap (
  maPhieuNhap BIGINT AUTO_INCREMENT PRIMARY KEY,
  maPhieu VARCHAR(64) NOT NULL UNIQUE,
  status ENUM('DRAFT','POSTED') NOT NULL DEFAULT 'DRAFT',
  ghiChu VARCHAR(500) NULL,
  created_by INT NULL,
  posted_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  posted_at DATETIME NULL,
  total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  idempotency_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  request_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  UNIQUE KEY uq_receipt_request (created_by, idempotency_key),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (posted_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_receipt_status_date (status, created_at)
);
CREATE TABLE ChiTietPhieuNhap (
  maPhieuNhap BIGINT NOT NULL,
  maSP INT NOT NULL,
  maSize INT NOT NULL,
  soLuongNhap INT NOT NULL,
  donGiaNhap DECIMAL(14,2) NOT NULL,
  line_total DECIMAL(14,2) NOT NULL,
  PRIMARY KEY (maPhieuNhap, maSP, maSize),
  FOREIGN KEY (maPhieuNhap) REFERENCES PhieuNhap(maPhieuNhap) ON DELETE CASCADE,
  FOREIGN KEY (maSP, maSize) REFERENCES ChiTietSanPham(maSP, maSize),
  CHECK (soLuongNhap > 0 AND donGiaNhap >= 0)
);
CREATE TABLE StockAdjustment (
  adjustment_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  actor_id INT NULL,
  reason VARCHAR(500) NOT NULL,
  idempotency_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  request_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_adjustment_request (actor_id, idempotency_key),
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE InventoryMovement (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  maSP INT NOT NULL,
  maSize INT NOT NULL,
  event_type ENUM('OPENING','RECEIPT','ORDER','CANCEL','ADJUSTMENT') NOT NULL,
  reference_type ENUM('OPENING','GOODS_RECEIPT','ORDER','ADJUSTMENT') NOT NULL,
  reference_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  delta INT NOT NULL,
  quantity_before INT NOT NULL,
  quantity_after INT NOT NULL,
  actor_id INT NULL,
  reason VARCHAR(500) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_movement_event (event_type, reference_type, reference_id, maSP, maSize),
  FOREIGN KEY (maSP, maSize) REFERENCES ChiTietSanPham(maSP, maSize),
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
  CHECK (quantity_before >= 0 AND quantity_after >= 0),
  CHECK (quantity_after = quantity_before + delta),
  CHECK (delta <> 0 OR event_type = 'OPENING'),
  INDEX idx_movement_variant_date (maSP, maSize, created_at),
  INDEX idx_movement_event_date (event_type, created_at)
);
INSERT INTO InventoryMovement
  (maSP, maSize, event_type, reference_type, reference_id, delta, quantity_before, quantity_after, reason)
SELECT maSP, maSize, 'OPENING', 'OPENING', CONCAT(maSP, ':', maSize),
  soLuongTon, 0, soLuongTon, 'MIGRATION_OPENING_BALANCE'
FROM ChiTietSanPham;
