import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';

dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

try {
  console.log('بدء إضافة نظام الفروع...');
  
  // إنشاء جدول الفروع
  await connection.execute(`
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
    )
  `);
  console.log('✓ تم إنشاء جدول الفروع');
  
  // إضافة الفروع
  await connection.execute(`
    INSERT INTO branches (id, name, code, address, isActive) VALUES
    (1, 'صيدلية جونيا - العامرية', 'ameria', 'العامرية', 1),
    (2, 'صيدلية جونيا - السيدية', 'saidia', 'السيدية', 1)
    ON DUPLICATE KEY UPDATE name=VALUES(name)
  `);
  console.log('✓ تم إضافة الفروع');
  
  // إضافة عمود branchId للجداول
  try {
    await connection.execute('ALTER TABLE users ADD COLUMN branchId INT AFTER id');
    console.log('✓ تم إضافة branchId إلى جدول users');
  } catch (e) {
    if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    console.log('- branchId موجود بالفعل في جدول users');
  }
  
  try {
    await connection.execute('ALTER TABLE orders ADD COLUMN branchId INT NOT NULL DEFAULT 1 AFTER id');
    console.log('✓ تم إضافة branchId إلى جدول orders');
  } catch (e) {
    if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    console.log('- branchId موجود بالفعل في جدول orders');
  }
  
  try {
    await connection.execute('ALTER TABLE customers ADD COLUMN branchId INT NOT NULL DEFAULT 1 AFTER id');
    console.log('✓ تم إضافة branchId إلى جدول customers');
  } catch (e) {
    if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    console.log('- branchId موجود بالفعل في جدول customers');
  }
  
  // إضافة الفهارس
  try {
    await connection.execute('ALTER TABLE users ADD INDEX branch_idx (branchId)');
    console.log('✓ تم إضافة فهرس branchId في users');
  } catch (e) {
    if (e.code !== 'ER_DUP_KEYNAME') throw e;
    console.log('- فهرس branchId موجود بالفعل في users');
  }
  
  try {
    await connection.execute('ALTER TABLE orders ADD INDEX branch_idx (branchId)');
    console.log('✓ تم إضافة فهرس branchId في orders');
  } catch (e) {
    if (e.code !== 'ER_DUP_KEYNAME') throw e;
    console.log('- فهرس branchId موجود بالفعل في orders');
  }
  
  try {
    await connection.execute('ALTER TABLE customers ADD INDEX branch_idx (branchId)');
    console.log('✓ تم إضافة فهرس branchId في customers');
  } catch (e) {
    if (e.code !== 'ER_DUP_KEYNAME') throw e;
    console.log('- فهرس branchId موجود بالفعل في customers');
  }
  
  // تحديث البيانات الموجودة
  await connection.execute('UPDATE users SET branchId = 1 WHERE branchId IS NULL');
  await connection.execute('UPDATE orders SET branchId = 1 WHERE branchId = 0 OR branchId IS NULL');
  await connection.execute('UPDATE customers SET branchId = 1 WHERE branchId = 0 OR branchId IS NULL');
  console.log('✓ تم تحديث البيانات الموجودة لتكون تابعة لفرع العامرية');
  
  console.log('\n✅ تم إضافة نظام الفروع بنجاح!');
  
} catch (error) {
  console.error('❌ خطأ:', error.message);
  process.exit(1);
} finally {
  await connection.end();
}
