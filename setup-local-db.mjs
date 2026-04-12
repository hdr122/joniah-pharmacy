import mysql from 'mysql2/promise';

const DB_URL = 'mysql://joniah:joniah123@localhost:3306/joniah_pharmacy';

const connection = await mysql.createConnection(DB_URL);

const tables = [
  // order_locations
  `CREATE TABLE IF NOT EXISTS \`order_locations\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`branchId\` int NOT NULL,
    \`orderId\` int NOT NULL,
    \`deliveryPersonId\` int NOT NULL,
    \`locationType\` enum('accept','deliver') NOT NULL,
    \`latitude\` varchar(50) NOT NULL,
    \`longitude\` varchar(50) NOT NULL,
    \`accuracy\` varchar(50),
    \`timestamp\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT \`order_locations_id\` PRIMARY KEY(\`id\`)
  )`,
  // order_route_tracking
  `CREATE TABLE IF NOT EXISTS \`order_route_tracking\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`branchId\` int NOT NULL,
    \`orderId\` int NOT NULL,
    \`deliveryPersonId\` int NOT NULL,
    \`latitude\` varchar(50) NOT NULL,
    \`longitude\` varchar(50) NOT NULL,
    \`accuracy\` varchar(50),
    \`speed\` varchar(20),
    \`heading\` varchar(20),
    \`timestamp\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT \`order_route_tracking_id\` PRIMARY KEY(\`id\`)
  )`,
  // orders
  `CREATE TABLE IF NOT EXISTS \`orders\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`branchId\` int NOT NULL,
    \`customerId\` int,
    \`customerName\` varchar(255) NOT NULL,
    \`customerPhone\` varchar(20),
    \`address\` text NOT NULL,
    \`locationUrl\` text,
    \`notes\` text,
    \`price\` int DEFAULT 0 NOT NULL,
    \`status\` enum('pending','in_progress','delivered','postponed','returned','cancelled') DEFAULT 'pending' NOT NULL,
    \`regionId\` int,
    \`deliveryPersonId\` int,
    \`deliveryNotes\` text,
    \`completedAt\` timestamp,
    \`isDeleted\` tinyint DEFAULT 0 NOT NULL,
    \`deletedAt\` timestamp,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`orders_id\` PRIMARY KEY(\`id\`)
  )`,
  // push_subscriptions
  `CREATE TABLE IF NOT EXISTS \`push_subscriptions\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`branchId\` int NOT NULL,
    \`userId\` int NOT NULL,
    \`endpoint\` text NOT NULL,
    \`p256dh\` text NOT NULL,
    \`auth\` text NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT \`push_subscriptions_id\` PRIMARY KEY(\`id\`)
  )`,
  // regions
  `CREATE TABLE IF NOT EXISTS \`regions\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`branchId\` int NOT NULL,
    \`name\` varchar(255) NOT NULL,
    \`description\` text,
    \`isActive\` tinyint DEFAULT 1 NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT \`regions_id\` PRIMARY KEY(\`id\`)
  )`,
  // provinces
  `CREATE TABLE IF NOT EXISTS \`provinces\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`branchId\` int NOT NULL,
    \`name\` varchar(255) NOT NULL,
    \`isActive\` tinyint DEFAULT 1 NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT \`provinces_id\` PRIMARY KEY(\`id\`)
  )`,
  // users
  `CREATE TABLE IF NOT EXISTS \`users\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`branchId\` int NOT NULL,
    \`openId\` varchar(255),
    \`name\` varchar(255),
    \`username\` varchar(100),
    \`password\` varchar(255),
    \`email\` varchar(320),
    \`phone\` varchar(20),
    \`role\` enum('admin','delivery','superadmin') DEFAULT 'delivery' NOT NULL,
    \`isActive\` tinyint DEFAULT 1 NOT NULL,
    \`loginMethod\` varchar(50),
    \`lastSignedIn\` timestamp,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`users_id\` PRIMARY KEY(\`id\`)
  )`,
  // daily_stats
  `CREATE TABLE IF NOT EXISTS \`dailyStats\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`branchId\` int NOT NULL,
    \`date\` varchar(10) NOT NULL,
    \`totalOrders\` int DEFAULT 0 NOT NULL,
    \`deliveredOrders\` int DEFAULT 0 NOT NULL,
    \`pendingOrders\` int DEFAULT 0 NOT NULL,
    \`postponedOrders\` int DEFAULT 0 NOT NULL,
    \`returnedOrders\` int DEFAULT 0 NOT NULL,
    \`activeDeliveries\` int DEFAULT 0 NOT NULL,
    \`totalRegions\` int DEFAULT 0 NOT NULL,
    \`totalProfit\` int DEFAULT 0 NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT \`dailyStats_id\` PRIMARY KEY(\`id\`)
  )`,
  // settings
  `CREATE TABLE IF NOT EXISTS \`settings\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`branchId\` int NOT NULL,
    \`key\` varchar(255) NOT NULL,
    \`value\` text,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`settings_id\` PRIMARY KEY(\`id\`)
  )`,
  // subscription_codes
  `CREATE TABLE IF NOT EXISTS \`subscription_codes\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`code\` varchar(50) NOT NULL,
    \`branchId\` int,
    \`usedAt\` timestamp,
    \`expiresAt\` timestamp,
    \`isUsed\` tinyint DEFAULT 0 NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT \`subscription_codes_id\` PRIMARY KEY(\`id\`)
  )`,
  // store_products
  `CREATE TABLE IF NOT EXISTS \`store_products\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`name\` varchar(255) NOT NULL,
    \`description\` text,
    \`price\` int NOT NULL,
    \`imageUrl\` text,
    \`isActive\` tinyint DEFAULT 1 NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`store_products_id\` PRIMARY KEY(\`id\`)
  )`,
  // store_purchases
  `CREATE TABLE IF NOT EXISTS \`store_purchases\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`branchId\` int NOT NULL,
    \`productId\` int NOT NULL,
    \`quantity\` int DEFAULT 1 NOT NULL,
    \`totalPrice\` int NOT NULL,
    \`purchasedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT \`store_purchases_id\` PRIMARY KEY(\`id\`)
  )`,
  // subscription_activations
  `CREATE TABLE IF NOT EXISTS \`subscription_activations\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`branchId\` int NOT NULL,
    \`activatedBy\` int,
    \`startDate\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`endDate\` timestamp,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT \`subscription_activations_id\` PRIMARY KEY(\`id\`)
  )`,
  // updates
  `CREATE TABLE IF NOT EXISTS \`updates\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`title\` varchar(255) NOT NULL,
    \`content\` text NOT NULL,
    \`version\` varchar(50),
    \`isActive\` tinyint DEFAULT 1 NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT \`updates_id\` PRIMARY KEY(\`id\`)
  )`,
  // site_settings
  `CREATE TABLE IF NOT EXISTS \`site_settings\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`settingKey\` varchar(255) NOT NULL,
    \`settingValue\` text,
    \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`site_settings_id\` PRIMARY KEY(\`id\`),
    CONSTRAINT \`site_settings_settingKey_unique\` UNIQUE(\`settingKey\`)
  )`,
];

console.log('Creating missing tables...');
for (const sql of tables) {
  try {
    const tableName = sql.match(/CREATE TABLE IF NOT EXISTS `([^`]+)`/)[1];
    await connection.execute(sql);
    console.log(`✅ ${tableName}`);
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
  }
}

// Create a super admin user
console.log('\nCreating admin user...');
try {
  const bcrypt = await import('bcryptjs');
  const hashedPassword = await bcrypt.hash('admin123', 10);

  // First create a branch
  await connection.execute(`
    INSERT IGNORE INTO branches (id, name, code, address, phone, isActive, createdAt, updatedAt)
    VALUES (1, 'صيدلية جونيا', 'JONIAH', 'بغداد', '07700000000', 1, NOW(), NOW())
  `);
  console.log('✅ Branch created');

  // Create admin user
  await connection.execute(`
    INSERT IGNORE INTO users (id, branchId, name, username, password, role, isActive, createdAt, updatedAt)
    VALUES (1, 1, 'مدير النظام', 'admin', ?, 'admin', 1, NOW(), NOW())
  `, [hashedPassword]);
  console.log('✅ Admin user created (username: admin, password: admin123)');

  // Create superadmin
  await connection.execute(`
    INSERT IGNORE INTO users (id, branchId, name, username, password, role, isActive, createdAt, updatedAt)
    VALUES (2, 1, 'سوبر أدمن', 'superadmin', ?, 'superadmin', 1, NOW(), NOW())
  `, [hashedPassword]);
  console.log('✅ Superadmin user created (username: superadmin, password: admin123)');

} catch (err) {
  console.error('Error creating users:', err.message);
}

console.log('\n✅ Database setup complete!');
await connection.end();
