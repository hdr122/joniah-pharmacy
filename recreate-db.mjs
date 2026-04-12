import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found');
  process.exit(1);
}

console.log('🔄 Recreating database with correct schema...');

const connection = await mysql.createConnection(DATABASE_URL);

// Drop all tables
const dropTables = [
  'DROP TABLE IF EXISTS activity_logs',
  'DROP TABLE IF EXISTS daily_stats',
  'DROP TABLE IF EXISTS orders',
  'DROP TABLE IF EXISTS customers',
  'DROP TABLE IF EXISTS delivery_locations',
  'DROP TABLE IF EXISTS user'
];

for (const sql of dropTables) {
  try {
    await connection.query(sql);
    console.log(`✅ ${sql}`);
  } catch (error) {
    console.log(`⚠️  ${sql} - ${error.message}`);
  }
}

// Create tables with correct schema matching drizzle/schema.ts
const createStatements = [
  `CREATE TABLE user (
    id VARCHAR(255) PRIMARY KEY,
    openId VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(255) NOT NULL,
    displayName VARCHAR(255),
    role ENUM('admin', 'user', 'delivery') NOT NULL DEFAULT 'user',
    phone VARCHAR(20),
    address TEXT,
    isActive BOOLEAN NOT NULL DEFAULT true,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
  )`,
  
  `CREATE TABLE delivery_locations (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
  )`,
  
  `CREATE TABLE customers (
    id VARCHAR(255) PRIMARY KEY,
    phone VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    address1 TEXT,
    address2 TEXT,
    locationId VARCHAR(255),
    totalOrders INT NOT NULL DEFAULT 0,
    deliveredOrders INT NOT NULL DEFAULT 0,
    returnedOrders INT NOT NULL DEFAULT 0,
    cancelledOrders INT NOT NULL DEFAULT 0,
    postponedOrders INT NOT NULL DEFAULT 0,
    totalSpent DECIMAL(10,2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    FOREIGN KEY (locationId) REFERENCES delivery_locations(id) ON DELETE SET NULL
  )`,
  
  `CREATE TABLE orders (
    id VARCHAR(255) PRIMARY KEY,
    customerId VARCHAR(255),
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    customer_address TEXT,
    customerAddress1 TEXT,
    customerAddress2 TEXT,
    locationId VARCHAR(255),
    prescription_image_url TEXT,
    medication_name TEXT,
    medication_dosage TEXT,
    quantity INT,
    notes TEXT,
    total_price DECIMAL(10,2),
    delivery_method ENUM('delivery', 'pickup') NOT NULL DEFAULT 'delivery',
    payment_method ENUM('cash', 'card', 'online') NOT NULL DEFAULT 'cash',
    payment_status ENUM('pending', 'paid', 'refunded') NOT NULL DEFAULT 'pending',
    status ENUM('pending', 'accepted', 'in_delivery', 'delivered', 'postponed', 'returned', 'cancelled') NOT NULL DEFAULT 'pending',
    estimated_ready_time BIGINT,
    acceptedAt BIGINT,
    delivered_at BIGINT,
    deliveryPersonId VARCHAR(255),
    created_by VARCHAR(255),
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    isDeleted BOOLEAN NOT NULL DEFAULT false,
    deletedAt BIGINT,
    deletedBy VARCHAR(255),
    FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (locationId) REFERENCES delivery_locations(id) ON DELETE SET NULL,
    FOREIGN KEY (deliveryPersonId) REFERENCES user(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES user(id) ON DELETE SET NULL,
    FOREIGN KEY (deletedBy) REFERENCES user(id) ON DELETE SET NULL
  )`,
  
  `CREATE TABLE daily_stats (
    id VARCHAR(255) PRIMARY KEY,
    date VARCHAR(10) NOT NULL UNIQUE,
    totalOrders INT NOT NULL DEFAULT 0,
    deliveredOrders INT NOT NULL DEFAULT 0,
    returnedOrders INT NOT NULL DEFAULT 0,
    cancelledOrders INT NOT NULL DEFAULT 0,
    postponedOrders INT NOT NULL DEFAULT 0,
    totalRevenue DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
  )`,
  
  `CREATE TABLE activity_logs (
    id VARCHAR(255) PRIMARY KEY,
    userId VARCHAR(255),
    username VARCHAR(255),
    action VARCHAR(255) NOT NULL,
    entityType VARCHAR(50),
    entityId VARCHAR(255),
    details TEXT,
    created_at BIGINT NOT NULL,
    FOREIGN KEY (userId) REFERENCES user(id) ON DELETE SET NULL
  )`
];

try {
  for (const statement of createStatements) {
    await connection.query(statement);
    console.log('✅ Table created');
  }
  console.log('🎉 Database recreated successfully!');
} catch (error) {
  console.error('❌ Failed to create schema:', error.message);
  console.error(error);
  process.exit(1);
} finally {
  await connection.end();
}
