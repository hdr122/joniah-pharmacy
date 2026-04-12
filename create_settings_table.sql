CREATE TABLE IF NOT EXISTS settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  `key` VARCHAR(100) NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX key_idx(`key`)
);

-- إضافة إعداد وقت بدء اليوم الجديد (الافتراضي 5 صباحاً)
INSERT INTO settings (`key`, value, description) 
VALUES ('day_start_hour', '5', 'ساعة بدء اليوم الجديد (0-23)')
ON DUPLICATE KEY UPDATE value = value;
