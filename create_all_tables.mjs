import mysql from 'mysql2/promise';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);

try {
  console.log('📋 إنشاء ملف SQL من Schema...');
  
  // استخدام drizzle-kit لإنشاء ملف SQL
  execSync('pnpm drizzle-kit generate', { cwd: '/home/ubuntu/joniah_pharmacy', stdio: 'inherit' });
  
  console.log('✅ تم إنشاء ملف SQL بنجاح');
  console.log('');
  console.log('🔄 تطبيق التغييرات على قاعدة البيانات...');
  
  // تطبيق Migration
  execSync('pnpm drizzle-kit migrate', { cwd: '/home/ubuntu/joniah_pharmacy', stdio: 'inherit' });
  
  console.log('✅ تم تطبيق جميع التغييرات بنجاح!');
  
} catch (error) {
  console.error('❌ خطأ:', error.message);
} finally {
  await connection.end();
}
