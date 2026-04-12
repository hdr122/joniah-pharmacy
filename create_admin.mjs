import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function createAdmin() {
  const connection = await mysql.createConnection(DATABASE_URL);

  try {
    console.log('🔐 Creating admin user...');
    
    // Hash the password
    const passwordHash = await bcrypt.hash('admin51', 10);
    
    // Check if admin user already exists
    const [existingUsers] = await connection.execute(
      'SELECT * FROM users WHERE username = ?',
      ['admin']
    );

    if (existingUsers.length > 0) {
      console.log('⚠️  Admin user already exists, updating password and role...');
      
      await connection.execute(
        'UPDATE users SET passwordHash = ?, role = ?, isActive = 1 WHERE username = ?',
        [passwordHash, 'admin', 'admin']
      );
      
      console.log('✅ Admin password and role updated successfully!');
    } else {
      // Insert admin user
      await connection.execute(
        `INSERT INTO users (username, passwordHash, name, loginMethod, role, isActive, createdAt, updatedAt, lastSignedIn)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
        ['admin', passwordHash, 'المدير', 'custom', 'admin', 1]
      );

      console.log('✅ Admin user created successfully!');
    }
    
    console.log('');
    console.log('📋 Login credentials:');
    console.log('   Username: admin');
    console.log('   Password: admin51');
    console.log('   Role: admin');
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

createAdmin().catch(console.error);
