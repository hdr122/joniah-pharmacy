import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { users } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

// Get all delivery users
const deliveryUsers = await db.select().from(users).where(eq(users.role, 'delivery'));

console.log(`Found ${deliveryUsers.length} delivery users`);

// Track used usernames
const usedUsernames = new Set();

for (const user of deliveryUsers) {
  if (!user.username) continue;
  
  // Remove @ from username
  let newUsername = user.username.replace(/@/g, '');
  
  // If username is taken, add number suffix
  let counter = 1;
  let finalUsername = newUsername;
  while (usedUsernames.has(finalUsername)) {
    finalUsername = `${newUsername}${counter}`;
    counter++;
  }
  
  usedUsernames.add(finalUsername);
  
  if (user.username !== finalUsername) {
    console.log(`Updating user ${user.id}: "${user.username}" -> "${finalUsername}"`);
    await db.update(users)
      .set({ username: finalUsername })
      .where(eq(users.id, user.id));
  }
}

console.log('Done!');
await connection.end();
