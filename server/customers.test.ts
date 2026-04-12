import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mysql from 'mysql2/promise';
import { config } from 'dotenv';

config();

describe('Customers and Regions Database Tests', () => {
  let connection: mysql.Connection;

  beforeAll(async () => {
    connection = await mysql.createConnection(process.env.DATABASE_URL!);
  });

  afterAll(async () => {
    await connection.end();
  });

  it('should have customers table with correct structure', async () => {
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'customers' 
      AND TABLE_SCHEMA = DATABASE()
    `);
    
    const columnNames = (columns as any[]).map(col => col.COLUMN_NAME);
    
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('name');
    expect(columnNames).toContain('phone');
    expect(columnNames).toContain('email');
    expect(columnNames).toContain('address1');
    expect(columnNames).toContain('address2');
    expect(columnNames).toContain('locationUrl1');
    expect(columnNames).toContain('locationUrl2');
    expect(columnNames).toContain('notes');
    expect(columnNames).toContain('regionId');
    expect(columnNames).toContain('lastDeliveryLocation');
    expect(columnNames).toContain('lastDeliveryAt');
    expect(columnNames).toContain('createdAt');
    expect(columnNames).toContain('updatedAt');
  });

  it('should have regions table with correct structure', async () => {
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'regions' 
      AND TABLE_SCHEMA = DATABASE()
    `);
    
    const columnNames = (columns as any[]).map(col => col.COLUMN_NAME);
    
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('name');
    expect(columnNames).toContain('provinceId');
    expect(columnNames).toContain('createdAt');
    expect(columnNames).toContain('updatedAt');
  });

  it('should have provinces table with correct structure', async () => {
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'provinces' 
      AND TABLE_SCHEMA = DATABASE()
    `);
    
    const columnNames = (columns as any[]).map(col => col.COLUMN_NAME);
    
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('name');
    expect(columnNames).toContain('createdAt');
    expect(columnNames).toContain('updatedAt');
  });

  it('should be able to insert a province', async () => {
    const [result] = await connection.query(`
      INSERT INTO provinces (name) VALUES ('بغداد')
    `);
    
    expect((result as any).affectedRows).toBe(1);
    
    // تنظيف البيانات
    await connection.query(`DELETE FROM provinces WHERE name = 'بغداد'`);
  });

  it('should be able to insert a region', async () => {
    // إدخال محافظة أولاً
    const [provinceResult] = await connection.query(`
      INSERT INTO provinces (name) VALUES ('بغداد')
    `);
    const provinceId = (provinceResult as any).insertId;
    
    // إدخال منطقة
    const [regionResult] = await connection.query(`
      INSERT INTO regions (name, provinceId) VALUES ('الكرادة', ?)
    `, [provinceId]);
    
    expect((regionResult as any).affectedRows).toBe(1);
    
    // تنظيف البيانات
    await connection.query(`DELETE FROM regions WHERE name = 'الكرادة'`);
    await connection.query(`DELETE FROM provinces WHERE id = ?`, [provinceId]);
  });

  it('should be able to insert a customer', async () => {
    const [result] = await connection.query(`
      INSERT INTO customers (name, phone, email, address1, notes) 
      VALUES ('أحمد محمد', '07901234567', 'ahmed@example.com', 'شارع الرشيد', 'زبون مميز')
    `);
    
    expect((result as any).affectedRows).toBe(1);
    
    // التحقق من البيانات المدخلة
    const [customers] = await connection.query(`
      SELECT * FROM customers WHERE phone = '07901234567'
    `);
    
    expect((customers as any[]).length).toBe(1);
    expect((customers as any[])[0].name).toBe('أحمد محمد');
    
    // تنظيف البيانات
    await connection.query(`DELETE FROM customers WHERE phone = '07901234567'`);
  });

  it('should be able to link customer with region', async () => {
    // إدخال محافظة ومنطقة
    const [provinceResult] = await connection.query(`
      INSERT INTO provinces (name) VALUES ('بغداد')
    `);
    const provinceId = (provinceResult as any).insertId;
    
    const [regionResult] = await connection.query(`
      INSERT INTO regions (name, provinceId) VALUES ('الكرادة', ?)
    `, [provinceId]);
    const regionId = (regionResult as any).insertId;
    
    // إدخال زبون مرتبط بالمنطقة
    const [customerResult] = await connection.query(`
      INSERT INTO customers (name, phone, regionId) 
      VALUES ('علي حسن', '07907654321', ?)
    `, [regionId]);
    
    expect((customerResult as any).affectedRows).toBe(1);
    
    // التحقق من الربط
    const [customers] = await connection.query(`
      SELECT c.*, r.name as regionName, p.name as provinceName
      FROM customers c
      LEFT JOIN regions r ON c.regionId = r.id
      LEFT JOIN provinces p ON r.provinceId = p.id
      WHERE c.phone = '07907654321'
    `);
    
    expect((customers as any[]).length).toBe(1);
    expect((customers as any[])[0].regionName).toBe('الكرادة');
    expect((customers as any[])[0].provinceName).toBe('بغداد');
    
    // تنظيف البيانات
    await connection.query(`DELETE FROM customers WHERE phone = '07907654321'`);
    await connection.query(`DELETE FROM regions WHERE id = ?`, [regionId]);
    await connection.query(`DELETE FROM provinces WHERE id = ?`, [provinceId]);
  });

  it('should have all required tables', async () => {
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE()
    `);
    
    const tableNames = (tables as any[]).map(t => t.TABLE_NAME);
    
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('provinces');
    expect(tableNames).toContain('regions');
    expect(tableNames).toContain('customers');
    expect(tableNames).toContain('orders');
    expect(tableNames).toContain('notifications');
    expect(tableNames).toContain('messages');
    expect(tableNames).toContain('delivery_locations');
    expect(tableNames).toContain('dailyStats');
    expect(tableNames).toContain('order_locations');
    expect(tableNames).toContain('push_subscriptions');
    expect(tableNames).toContain('activity_logs');
    expect(tableNames).toContain('order_form_settings');
    expect(tableNames).toContain('order_route_tracking');
  });
});
