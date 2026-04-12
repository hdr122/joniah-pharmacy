import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { users } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

// Get all delivery users with @ in username
const deliveryUsers = await db.select().from(users).where(eq(users.role, 'delivery'));

console.log(`Found ${deliveryUsers.length} delivery users`);

for (const user of deliveryUsers) {
  if (!user.username || !user.username.includes('@')) continue;
  
  // Simply remove @ from username
  const newUsername = user.username.replace(/@/g, '');
  
  console.log(`Updating user ${user.id} (${user.name}): "${user.username}" -> "${newUsername}"`);
  
  try {
    await db.update(users)
      .set({ username: newUsername })
      .where(eq(users.id, user.id));
    console.log(`✓ Updated successfully`);
  } catch (error) {
    console.log(`✗ Error: ${error.message}`);
  }
}

console.log('Done!');
await connection.end();
