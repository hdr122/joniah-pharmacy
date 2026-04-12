import { hash } from 'bcrypt';
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

async function createSuperAdmin() {
  const connection = await mysql.createConnection(DATABASE_URL);
  
  try {
    // التحقق من وجود المستخدم
    const [existing] = await connection.execute(
      'SELECT id FROM users WHERE username = ?',
      ['HarthHDR']
    );
    
    if (existing.length > 0) {
      console.log('المستخدم HarthHDR موجود بالفعل، جاري تحديث الصلاحيات...');
      
      const passwordHash = await hash('Harth12', 10);
      const permissions = JSON.stringify(['full_access', 'manage_users', 'reset_data', 'view_dashboard', 'view_statistics', 'manage_orders', 'manage_deliveries', 'manage_regions', 'manage_customers', 'view_reports', 'view_notifications', 'manage_settings']);
      
      await connection.execute(
        'UPDATE users SET passwordHash = ?, permissions = ?, role = ? WHERE username = ?',
        [passwordHash, permissions, 'admin', 'HarthHDR']
      );
      
      console.log('تم تحديث المستخدم HarthHDR بنجاح');
    } else {
      console.log('جاري إنشاء المستخدم HarthHDR...');
      
      const passwordHash = await hash('Harth12', 10);
      const permissions = JSON.stringify(['full_access', 'manage_users', 'reset_data', 'view_dashboard', 'view_statistics', 'manage_orders', 'manage_deliveries', 'manage_regions', 'manage_customers', 'view_reports', 'view_notifications', 'manage_settings']);
      
      await connection.execute(
        'INSERT INTO users (name, username, passwordHash, role, permissions, loginMethod, isActive) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ['المدير الأعلى', 'HarthHDR', passwordHash, 'admin', permissions, 'custom', true]
      );
      
      console.log('تم إنشاء المستخدم HarthHDR بنجاح');
    }
    
    // عرض بيانات المستخدم
    const [user] = await connection.execute(
      'SELECT id, username, name, role, permissions FROM users WHERE username = ?',
      ['HarthHDR']
    );
    
    console.log('بيانات المستخدم:', user[0]);
    
  } catch (error) {
    console.error('خطأ:', error);
  } finally {
    await connection.end();
  }
}

createSuperAdmin();
