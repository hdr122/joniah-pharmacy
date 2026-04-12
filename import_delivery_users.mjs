import mysql from 'mysql2/promise';
import { hash } from 'bcryptjs';
import { config } from 'dotenv';
import { readFileSync } from 'fs';

config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);

try {
  console.log('📥 بدء استيراد المندوبين...');
  console.log('');
  
  // قراءة بيانات المندوبين
  const deliveryUsers = JSON.parse(readFileSync('./delivery_users_data.json', 'utf-8'));
  
  // كلمة المرور الموحدة
  const password = '112233';
  const passwordHash = await hash(password, 10);
  
  let addedCount = 0;
  let skippedCount = 0;
  
  for (const user of deliveryUsers) {
    try {
      // التحقق من وجود المستخدم
      const [existing] = await connection.query(
        'SELECT id FROM users WHERE username = ? OR phone = ?',
        [user.username, user.phone]
      );
      
      if (existing.length > 0) {
        console.log(`⏭️  تخطي ${user.name} - موجود مسبقاً`);
        skippedCount++;
        continue;
      }
      
      // إضافة المستخدم
      await connection.query(`
        INSERT INTO users (
          username, 
          passwordHash, 
          name, 
          phone, 
          role, 
          loginMethod, 
          isActive,
          createdAt,
          updatedAt,
          lastSignedIn
        ) VALUES (?, ?, ?, ?, 'delivery', 'custom', ?, NOW(), NOW(), NOW())
      `, [
        user.username,
        passwordHash,
        user.name,
        user.phone,
        user.isActive
      ]);
      
      console.log(`✅ تمت إضافة: ${user.name} (${user.username})`);
      addedCount++;
      
    } catch (error) {
      console.error(`❌ خطأ في إضافة ${user.name}:`, error.message);
    }
  }
  
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log(`✅ تمت إضافة ${addedCount} مندوب بنجاح`);
  console.log(`⏭️  تم تخطي ${skippedCount} مندوب (موجودين مسبقاً)`);
  console.log(`📊 إجمالي المندوبين: ${deliveryUsers.length}`);
  console.log('═══════════════════════════════════════');
  console.log('');
  console.log('🔐 معلومات تسجيل الدخول:');
  console.log(`   اليوزر: اسم المستخدم من القائمة`);
  console.log(`   كلمة المرور: ${password}`);
  console.log('');
  
} catch (error) {
  console.error('❌ خطأ:', error);
} finally {
  await connection.end();
}
