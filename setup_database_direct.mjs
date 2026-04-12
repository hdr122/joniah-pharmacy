import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';
// import * as schema from './drizzle/schema.ts';
import { config } from 'dotenv';

config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);
// const db = drizzle(connection, { mode: 'default' });

try {
  console.log('🗑️  حذف جميع الجداول القديمة...');
  
  await connection.query('SET FOREIGN_KEY_CHECKS = 0');
  
  const [tables] = await connection.query('SHOW TABLES');
  for (const table of tables) {
    const tableName = Object.values(table)[0];
    await connection.query(`DROP TABLE IF EXISTS \`${tableName}\``);
    console.log(`✅ حذف جدول ${tableName}`);
  }
  
  await connection.query('SET FOREIGN_KEY_CHECKS = 1');
  
  console.log('');
  console.log('📋 إنشاء جميع الجداول الجديدة...');
  
  // إنشاء جدول users
  await connection.query(`
    CREATE TABLE users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      openId VARCHAR(64) UNIQUE,
      username VARCHAR(100) UNIQUE,
      passwordHash VARCHAR(255),
      name TEXT,
      email VARCHAR(320),
      loginMethod VARCHAR(64),
      role ENUM('admin', 'delivery') NOT NULL DEFAULT 'delivery',
      permissions TEXT,
      profileImage TEXT,
      phone VARCHAR(20),
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      latitude VARCHAR(50),
      longitude VARCHAR(50),
      lastLocationUpdate TIMESTAMP NULL,
      traccarUsername VARCHAR(100),
      traccarPassword VARCHAR(255),
      fcmToken TEXT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      lastSignedIn TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ تم إنشاء جدول users');
  
  // إنشاء جدول provinces
  await connection.query(`
    CREATE TABLE provinces (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ تم إنشاء جدول provinces');
  
  // إنشاء جدول regions
  await connection.query(`
    CREATE TABLE regions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      provinceId INT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ تم إنشاء جدول regions');
  
  // إنشاء جدول customers
  await connection.query(`
    CREATE TABLE customers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255),
      phone VARCHAR(20),
      email VARCHAR(320),
      address1 TEXT,
      address2 TEXT,
      locationUrl1 TEXT,
      locationUrl2 TEXT,
      notes TEXT,
      regionId INT,
      lastDeliveryLocation TEXT,
      lastDeliveryAt TIMESTAMP NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ تم إنشاء جدول customers');
  
  // إنشاء جدول orders
  await connection.query(`
    CREATE TABLE orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customerId INT,
      deliveryPersonId INT NOT NULL,
      regionId INT NOT NULL,
      provinceId INT NOT NULL,
      price INT NOT NULL,
      note TEXT,
      locationLink TEXT,
      address TEXT,
      status ENUM('pending_approval', 'pending', 'delivered', 'postponed', 'cancelled', 'returned') NOT NULL DEFAULT 'pending_approval',
      postponeReason TEXT,
      returnReason TEXT,
      deliveryImage TEXT,
      deliveryNote TEXT,
      deliveryLocationName TEXT,
      acceptedAt TIMESTAMP NULL,
      deliveredAt TIMESTAMP NULL,
      deliveryDuration INT,
      totalDuration INT,
      isDeleted BOOLEAN NOT NULL DEFAULT FALSE,
      deletedAt TIMESTAMP NULL,
      deletedBy INT,
      hidePhoneFromDelivery INT DEFAULT 0,
      createdBy INT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX delivery_person_idx (deliveryPersonId),
      INDEX status_idx (status),
      INDEX created_at_idx (createdAt),
      INDEX is_deleted_idx (isDeleted)
    )
  `);
  console.log('✅ تم إنشاء جدول orders');
  
  // إنشاء جدول notifications
  await connection.query(`
    CREATE TABLE notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      type ENUM('order_assigned', 'order_accepted', 'order_rejected', 'order_delivered', 'order_postponed', 'order_returned', 'message', 'general') NOT NULL DEFAULT 'general',
      orderId INT,
      isRead BOOLEAN NOT NULL DEFAULT FALSE,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ تم إنشاء جدول notifications');
  
  // إنشاء جدول messages
  await connection.query(`
    CREATE TABLE messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      senderId INT NOT NULL,
      receiverId INT,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      type ENUM('message', 'order_notification', 'system') NOT NULL DEFAULT 'message',
      isRead BOOLEAN NOT NULL DEFAULT FALSE,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ تم إنشاء جدول messages');
  
  // إنشاء جدول delivery_locations
  await connection.query(`
    CREATE TABLE delivery_locations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      deliveryPersonId INT NOT NULL,
      deviceId VARCHAR(100),
      latitude VARCHAR(50) NOT NULL,
      longitude VARCHAR(50) NOT NULL,
      accuracy VARCHAR(50),
      speed VARCHAR(20),
      heading VARCHAR(20),
      battery VARCHAR(10),
      timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ تم إنشاء جدول delivery_locations');
  
  // إنشاء جدول dailyStats
  await connection.query(`
    CREATE TABLE dailyStats (
      id INT AUTO_INCREMENT PRIMARY KEY,
      date VARCHAR(10) NOT NULL UNIQUE,
      totalOrders INT NOT NULL DEFAULT 0,
      deliveredOrders INT NOT NULL DEFAULT 0,
      pendingOrders INT NOT NULL DEFAULT 0,
      postponedOrders INT NOT NULL DEFAULT 0,
      returnedOrders INT NOT NULL DEFAULT 0,
      activeDeliveries INT NOT NULL DEFAULT 0,
      totalRegions INT NOT NULL DEFAULT 0,
      totalProfit INT NOT NULL DEFAULT 0,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ تم إنشاء جدول dailyStats');
  
  // إنشاء جدول order_locations
  await connection.query(`
    CREATE TABLE order_locations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      orderId INT NOT NULL,
      deliveryPersonId INT NOT NULL,
      locationType ENUM('accept', 'deliver') NOT NULL,
      latitude VARCHAR(50) NOT NULL,
      longitude VARCHAR(50) NOT NULL,
      accuracy VARCHAR(50),
      timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ تم إنشاء جدول order_locations');
  
  // إنشاء جدول push_subscriptions
  await connection.query(`
    CREATE TABLE push_subscriptions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ تم إنشاء جدول push_subscriptions');
  
  // إنشاء جدول activity_logs
  await connection.query(`
    CREATE TABLE activity_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      activityType ENUM('login', 'logout', 'page_view', 'order_create', 'order_update', 'order_delete', 'delivery_assign', 'status_change', 'settings_change', 'user_create', 'user_update', 'user_delete', 'customer_create', 'customer_update', 'customer_delete') NOT NULL,
      description TEXT,
      metadata TEXT,
      ipAddress VARCHAR(50),
      userAgent TEXT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ تم إنشاء جدول activity_logs');
  
  // إنشاء جدول order_form_settings
  await connection.query(`
    CREATE TABLE order_form_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      fieldName VARCHAR(50) NOT NULL UNIQUE,
      fieldLabel VARCHAR(100) NOT NULL,
      isVisible BOOLEAN NOT NULL DEFAULT TRUE,
      displayOrder INT NOT NULL DEFAULT 0,
      isRequired BOOLEAN NOT NULL DEFAULT FALSE,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ تم إنشاء جدول order_form_settings');
  
  // إنشاء جدول order_route_tracking
  await connection.query(`
    CREATE TABLE order_route_tracking (
      id INT AUTO_INCREMENT PRIMARY KEY,
      orderId INT NOT NULL,
      deliveryPersonId INT NOT NULL,
      latitude VARCHAR(50) NOT NULL,
      longitude VARCHAR(50) NOT NULL,
      accuracy VARCHAR(50),
      speed VARCHAR(20),
      heading VARCHAR(20),
      deviationFromRoute INT,
      isOffRoute BOOLEAN DEFAULT FALSE,
      timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX order_route_order_idx (orderId),
      INDEX order_route_timestamp_idx (timestamp)
    )
  `);
  console.log('✅ تم إنشاء جدول order_route_tracking');
  
  console.log('');
  console.log('✅ تم إنشاء جميع الجداول بنجاح!');
  console.log('');
  console.log('📊 الجداول المُنشأة:');
  console.log('   - users (المستخدمون)');
  console.log('   - provinces (المحافظات)');
  console.log('   - regions (المناطق)');
  console.log('   - customers (الزبائن)');
  console.log('   - orders (الطلبات)');
  console.log('   - notifications (الإشعارات)');
  console.log('   - messages (الرسائل)');
  console.log('   - delivery_locations (مواقع المندوبين)');
  console.log('   - dailyStats (الإحصائيات اليومية)');
  console.log('   - order_locations (مواقع الطلبات)');
  console.log('   - push_subscriptions (اشتراكات الإشعارات)');
  console.log('   - activity_logs (سجل النشاطات)');
  console.log('   - order_form_settings (إعدادات نموذج الطلبات)');
  console.log('   - order_route_tracking (تتبع مسار التوصيل)');
  
} catch (error) {
  console.error('❌ خطأ:', error);
} finally {
  await connection.end();
}
