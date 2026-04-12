import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

console.log('🧪 Testing data integrity...\n');

const connection = await mysql.createConnection(DATABASE_URL);

try {
  // Test 1: Insert a test location
  console.log('1️⃣ Testing delivery_locations table...');
  const locationId = `test-loc-${Date.now()}`;
  await connection.query(
    'INSERT INTO delivery_locations (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
    [locationId, 'منطقة تجريبية', Date.now(), Date.now()]
  );
  console.log('   ✅ Location inserted successfully');
  
  // Verify insertion
  const [locations] = await connection.query('SELECT * FROM delivery_locations WHERE id = ?', [locationId]);
  console.log(`   ✅ Location retrieved: ${locations[0].name}`);
  
  // Test 2: Insert a test customer
  console.log('\n2️⃣ Testing customers table...');
  const customerId = `test-cust-${Date.now()}`;
  await connection.query(
    'INSERT INTO customers (id, phone, name, address1, locationId, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [customerId, '07701234567', 'زبون تجريبي', 'عنوان تجريبي', locationId, Date.now(), Date.now()]
  );
  console.log('   ✅ Customer inserted successfully');
  
  const [customers] = await connection.query('SELECT * FROM customers WHERE id = ?', [customerId]);
  console.log(`   ✅ Customer retrieved: ${customers[0].name}`);
  
  // Test 3: Insert a test order
  console.log('\n3️⃣ Testing orders table...');
  const orderId = `test-order-${Date.now()}`;
  await connection.query(
    `INSERT INTO orders (id, customerId, customer_name, customer_phone, customer_address, locationId, 
     total_price, delivery_method, payment_method, payment_status, status, created_at, updated_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [orderId, customerId, 'زبون تجريبي', '07701234567', 'عنوان تجريبي', locationId, 
     50000, 'delivery', 'cash', 'pending', 'pending', Date.now(), Date.now()]
  );
  console.log('   ✅ Order inserted successfully');
  
  const [orders] = await connection.query('SELECT * FROM orders WHERE id = ?', [orderId]);
  console.log(`   ✅ Order retrieved: ${orders[0].customer_name} - ${orders[0].total_price} IQD`);
  
  // Test 4: Insert daily stats
  console.log('\n4️⃣ Testing daily_stats table...');
  const statsId = `test-stats-${Date.now()}`;
  const today = new Date().toISOString().split('T')[0];
  await connection.query(
    'INSERT INTO daily_stats (id, date, totalOrders, deliveredOrders, totalRevenue, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [statsId, today, 1, 0, 50000, Date.now(), Date.now()]
  );
  console.log('   ✅ Daily stats inserted successfully');
  
  // Test 5: Insert activity log
  console.log('\n5️⃣ Testing activity_logs table...');
  const logId = `test-log-${Date.now()}`;
  await connection.query(
    'INSERT INTO activity_logs (id, username, action, entityType, entityId, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [logId, 'test-user', 'test_action', 'order', orderId, Date.now()]
  );
  console.log('   ✅ Activity log inserted successfully');
  
  // Cleanup test data
  console.log('\n🧹 Cleaning up test data...');
  await connection.query('DELETE FROM activity_logs WHERE id = ?', [logId]);
  await connection.query('DELETE FROM daily_stats WHERE id = ?', [statsId]);
  await connection.query('DELETE FROM orders WHERE id = ?', [orderId]);
  await connection.query('DELETE FROM customers WHERE id = ?', [customerId]);
  await connection.query('DELETE FROM delivery_locations WHERE id = ?', [locationId]);
  console.log('   ✅ Test data cleaned up');
  
  console.log('\n✅ ✅ ✅ ALL TESTS PASSED! Data integrity is confirmed.');
  console.log('📊 All tables are working correctly and data is being saved safely.');
  
} catch (error) {
  console.error('\n❌ TEST FAILED:', error.message);
  process.exit(1);
} finally {
  await connection.end();
}
