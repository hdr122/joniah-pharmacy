import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './drizzle/schema.ts';
import { config } from 'dotenv';
import { writeFileSync } from 'fs';

config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection, { schema, mode: 'default' });

try {
  // استخراج بيانات الزبائن
  const customers = await db.select().from(schema.customers);
  console.log(`Found ${customers.length} customers`);
  
  // استخراج بيانات المناطق
  const regions = await db.select().from(schema.regions);
  console.log(`Found ${regions.length} regions`);
  
  // استخراج بيانات المحافظات
  const provinces = await db.select().from(schema.provinces);
  console.log(`Found ${provinces.length} provinces`);
  
  // حفظ البيانات في ملف JSON
  const data = {
    customers,
    regions,
    provinces
  };
  
  writeFileSync('backup_data.json', JSON.stringify(data, null, 2));
  console.log('Data saved to backup_data.json');
} catch (error) {
  console.error('Error:', error);
} finally {
  await connection.end();
}
