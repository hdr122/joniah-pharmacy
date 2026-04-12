import Database from 'better-sqlite3';

const db = new Database(process.env.DATABASE_URL?.replace('mysql://', '').split('?')[0] || './local.db');

console.log('\n=== جميع المندوبين مع فروعهم ===\n');

const deliveryPersons = db.prepare(`
  SELECT id, name, username, branchId, role 
  FROM users 
  WHERE role = 'delivery' 
  ORDER BY branchId, id
`).all();

console.log(`إجمالي المندوبين: ${deliveryPersons.length}\n`);

const branch1 = deliveryPersons.filter(d => d.branchId === 1);
const branch2 = deliveryPersons.filter(d => d.branchId === 2);

console.log(`فرع العامرية (branchId=1): ${branch1.length} مندوب`);
branch1.forEach(d => console.log(`  - ${d.name} (${d.username}) [ID: ${d.id}]`));

console.log(`\nفرع السيدية (branchId=2): ${branch2.length} مندوب`);
branch2.forEach(d => console.log(`  - ${d.name} (${d.username}) [ID: ${d.id}]`));

db.close();
