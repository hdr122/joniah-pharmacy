-- إنشاء جدول الفروع
CREATE TABLE IF NOT EXISTS branches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  address TEXT,
  phone VARCHAR(20),
  isActive TINYINT DEFAULT 1 NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  INDEX code_idx (code)
);

-- إضافة الفروع
INSERT INTO branches (id, name, code, address, phone, isActive) VALUES
(1, 'صيدلية جونيا - العامرية', 'ameria', 'العامرية', NULL, 1),
(2, 'صيدلية جونيا - السيدية', 'saidia', 'السيدية', NULL, 1)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- إضافة عمود branchId للجداول الموجودة
ALTER TABLE users ADD COLUMN IF NOT EXISTS branchId INT AFTER id;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS branchId INT NOT NULL DEFAULT 1 AFTER id;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS branchId INT NOT NULL DEFAULT 1 AFTER id;

-- إضافة الفهارس
ALTER TABLE users ADD INDEX IF NOT EXISTS branch_idx (branchId);
ALTER TABLE orders ADD INDEX IF NOT EXISTS branch_idx (branchId);
ALTER TABLE customers ADD INDEX IF NOT EXISTS branch_idx (branchId);

-- تحديث البيانات الموجودة لتكون تابعة لفرع العامرية (الافتراضي)
UPDATE users SET branchId = 1 WHERE branchId IS NULL;
UPDATE orders SET branchId = 1 WHERE branchId = 0 OR branchId IS NULL;
UPDATE customers SET branchId = 1 WHERE branchId = 0 OR branchId IS NULL;

-- إضافة مستخدم admin2 لفرع السيدية
INSERT INTO users (branchId, username, passwordHash, name, role, isActive, loginMethod, createdAt, updatedAt, lastSignedIn)
VALUES (2, 'admin2', '$2a$10$YourHashedPasswordHere', 'مدير فرع السيدية', 'admin', 1, 'local', NOW(), NOW(), NOW())
ON DUPLICATE KEY UPDATE branchId=VALUES(branchId), name=VALUES(name);
