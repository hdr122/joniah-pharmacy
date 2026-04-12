import { createPool } from 'mysql2/promise';
import { config } from 'dotenv';

// تحميل متغيرات البيئة
config();

async function fixAdminPermissions() {
  const pool = createPool(process.env.DATABASE_URL);
  
  try {
    // جلب جميع المستخدمين Admin الذين ليس لديهم صلاحيات
    const [admins] = await pool.execute(
      `SELECT id, username, name, permissions 
       FROM users 
       WHERE role = 'admin' 
       AND (permissions IS NULL OR permissions = '[]' OR permissions = '')`
    );
    
    if (admins.length === 0) {
      console.log('✅ No admins found without permissions');
      return;
    }
    
    console.log(`Found ${admins.length} admin(s) without permissions:`);
    
    // تحديث صلاحيات كل admin
    for (const admin of admins) {
      await pool.execute(
        'UPDATE users SET permissions = ? WHERE id = ?',
        [JSON.stringify(['all']), admin.id]
      );
      console.log(`✅ Updated permissions for: ${admin.username} (${admin.name})`);
    }
    
    console.log(`\n✅ Successfully updated ${admins.length} admin(s)`);
  } catch (error) {
    console.error('❌ Error fixing admin permissions:', error);
  } finally {
    await pool.end();
  }
}

fixAdminPermissions();
