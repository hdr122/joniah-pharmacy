import mysql from 'mysql2/promise';
import { config } from 'dotenv';

config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);

try {
  console.log('🗑️  حذف الجداول القديمة...');
  
  // حذف جميع الجداول القديمة
  const tables = [
    'activity_logs',
    'customers',
    'daily_stats',
    'delivery_locations',
    'messages',
    'notifications',
    'order_route_tracking',
    'orders',
    'provinces',
    'regions',
    'users'
  ];
  
  // تعطيل فحص المفاتيح الأجنبية مؤقتاً
  await connection.query('SET FOREIGN_KEY_CHECKS = 0');
  
  for (const table of tables) {
    try {
      await connection.query(`DROP TABLE IF EXISTS ${table}`);
      console.log(`✅ تم حذف جدول ${table}`);
    } catch (error) {
      console.log(`⚠️  لم يتم العثور على جدول ${table}`);
    }
  }
  
  // إعادة تفعيل فحص المفاتيح الأجنبية
  await connection.query('SET FOREIGN_KEY_CHECKS = 1');
  
  console.log('✅ تم حذف جميع الجداول القديمة بنجاح!');
  console.log('');
  console.log('الآن قم بتشغيل: pnpm db:push');
  
} catch (error) {
  console.error('❌ خطأ:', error);
} finally {
  await connection.end();
}
