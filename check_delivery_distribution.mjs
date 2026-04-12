import { db } from './server/db.js';
import { users } from './drizzle/schema.js';
import { eq } from 'drizzle-orm';

console.log('\n=== جميع المندوبين مع فروعهم ===\n');

const deliveryPersons = await db.select({
  id: users.id,
  name: users.name,
  username: users.username,
  branchId: users.branchId,
  role: users.role
}).from(users).where(eq(users.role, 'delivery'));

console.log(`إجمالي المندوبين: ${deliveryPersons.length}\n`);

const branch1 = deliveryPersons.filter(d => d.branchId === 1);
const branch2 = deliveryPersons.filter(d => d.branchId === 2);

console.log(`فرع العامرية (branchId=1): ${branch1.length} مندوب`);
branch1.forEach(d => console.log(`  - ${d.name} (${d.username}) [ID: ${d.id}]`));

console.log(`\nفرع السيدية (branchId=2): ${branch2.length} مندوب`);
branch2.forEach(d => console.log(`  - ${d.name} (${d.username}) [ID: ${d.id}]`));

console.log('\n=== المندوبون الذين يجب نقلهم ===\n');

// المندوبون الأصليون لفرع السيدية (10 مندوبين)
const saidiyaOriginal = ['محمد علي', 'أحمد حسن', 'علي محمود', 'حسين كريم', 'كريم عباس', 
                         'عمر فاضل', 'يوسف جاسم', 'خالد نوري', 'سعد طارق', 'طارق سالم'];

console.log('المندوبون الذين يجب أن يبقوا في السيدية:');
const shouldStayInSaidiya = deliveryPersons.filter(d => saidiyaOriginal.includes(d.name));
shouldStayInSaidiya.forEach(d => console.log(`  - ${d.name} (${d.username}) [ID: ${d.id}] - حالياً في فرع ${d.branchId}`));

console.log('\nالمندوبون الذين يجب نقلهم إلى العامرية:');
const shouldMoveToAmiriya = deliveryPersons.filter(d => !saidiyaOriginal.includes(d.name) && d.branchId === 2);
shouldMoveToAmiriya.forEach(d => console.log(`  - ${d.name} (${d.username}) [ID: ${d.id}]`));

process.exit(0);
