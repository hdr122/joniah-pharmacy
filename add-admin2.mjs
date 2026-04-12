import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);

try {
  console.log('إضافة مستخدم admin2 لفرع السيدية...');
  
  // تشفير كلمة المرور
  const passwordHash = await bcrypt.hash('admin51', 10);
  
  // إضافة المستخدم
  await connection.execute(`
    INSERT INTO users (branchId, username, passwordHash, name, role, isActive, loginMethod, createdAt, updatedAt, lastSignedIn)
    VALUES (2, 'admin2', ?, 'مدير فرع السيدية', 'admin', 1, 'local', NOW(), NOW(), NOW())
    ON DUPLICATE KEY UPDATE branchId=2, passwordHash=?, name='مدير فرع السيدية'
  `, [passwordHash, passwordHash]);
  
  console.log('✅ تم إضافة مستخدم admin2 بنجاح!');
  console.log('اسم المستخدم: admin2');
  console.log('كلمة المرور: admin51');
  console.log('الفرع: صيدلية جونيا - السيدية');
  
} catch (error) {
  console.error('❌ خطأ:', error.message);
  process.exit(1);
} finally {
  await connection.end();
}
