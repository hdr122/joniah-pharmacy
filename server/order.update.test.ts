import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { appRouter } from './routers';
import * as db from './db';

describe('Order Update - Customer Phone', () => {
  let testOrderId: number;
  let testCustomerId: number;
  let testDeliveryPersonId: number;
  let testRegionId: number;
  let adminContext: any;

  beforeAll(async () => {
    // إنشاء مستخدم admin للاختبار
    const adminUser = await db.getUserByUsername('admin');
    if (!adminUser) {
      throw new Error('Admin user not found');
    }

    // إنشاء context للمستخدم admin
    adminContext = {
      user: adminUser,
      req: {},
      res: {},
    };

    // الحصول على مندوب للاختبار
    const deliveryPersons = await db.getDeliveryPersons();
    if (!deliveryPersons || deliveryPersons.length === 0) {
      throw new Error('No delivery persons found');
    }
    testDeliveryPersonId = deliveryPersons[0].id;

    // الحصول على منطقة للاختبار
    const regions = await db.getAllRegions();
    if (!regions || regions.length === 0) {
      throw new Error('No regions found');
    }
    testRegionId = regions[0].id;

    // إنشاء زبون اختباري
    const customer = await db.createCustomer({
      name: 'اختبار الزبون',
      phone: '07701234567',
      address1: 'عنوان اختباري',
    });
    testCustomerId = customer.id;

    // إنشاء طلب اختباري مرتبط بالزبون
    const order = await db.createOrder({
      deliveryPersonId: testDeliveryPersonId,
      price: 10000,
      regionId: testRegionId,
      provinceId: 1,
      customerId: testCustomerId,
      address: 'عنوان اختباري',
      hidePhoneFromDelivery: 0,
      createdBy: adminUser.id,
    });

    testOrderId = order.id;
  });

  it('should update customer phone number', async () => {
    const caller = appRouter.createCaller(adminContext);

    // تحديث رقم الهاتف
    const newPhone = '07709876543';
    await caller.orders.update({
      orderId: testOrderId,
      customerPhone: newPhone,
      deliveryPersonId: testDeliveryPersonId,
      price: 10000,
      regionId: testRegionId,
    });

    // التحقق من التحديث في جدول customers
    const updatedCustomer = await db.getCustomerById(testCustomerId);
    expect(updatedCustomer).toBeDefined();
    expect(updatedCustomer?.phone).toBe(newPhone);
  });

  it('should update customer name', async () => {
    const caller = appRouter.createCaller(adminContext);

    // تحديث اسم الزبون
    const newName = 'اسم جديد للزبون';
    await caller.orders.update({
      orderId: testOrderId,
      customerName: newName,
      deliveryPersonId: testDeliveryPersonId,
      price: 10000,
      regionId: testRegionId,
    });

    // التحقق من التحديث في جدول customers
    const updatedCustomer = await db.getCustomerById(testCustomerId);
    expect(updatedCustomer).toBeDefined();
    expect(updatedCustomer?.name).toBe(newName);
  });

  it('should update location link in order', async () => {
    const caller = appRouter.createCaller(adminContext);

    // تحديث رابط الموقع
    const newLocationLink = 'https://maps.google.com/?q=33.3152,44.3661';
    await caller.orders.update({
      orderId: testOrderId,
      locationLink: newLocationLink,
      deliveryPersonId: testDeliveryPersonId,
      price: 10000,
      regionId: testRegionId,
    });

    // التحقق من التحديث في جدول orders
    const updatedOrder = await db.getOrderById(testOrderId);
    expect(updatedOrder).toBeDefined();
    expect(updatedOrder?.locationLink).toBe(newLocationLink);
  });

  it('should update multiple fields at once', async () => {
    const caller = appRouter.createCaller(adminContext);

    // تحديث عدة حقول معاً
    const updates = {
      orderId: testOrderId,
      customerPhone: '07701111111',
      customerName: 'تحديث شامل',
      address: 'عنوان محدث',
      locationLink: 'https://maps.google.com/?q=33.3333,44.4444',
      deliveryPersonId: testDeliveryPersonId,
      price: 15000,
      regionId: testRegionId,
      customerData: {
        address1: 'عنوان محدث في جدول الزبائن',
      },
    };

    await caller.orders.update(updates);

    // التحقق من تحديث بيانات الزبون
    const updatedCustomer = await db.getCustomerById(testCustomerId);
    expect(updatedCustomer).toBeDefined();
    expect(updatedCustomer?.phone).toBe(updates.customerPhone);
    expect(updatedCustomer?.name).toBe(updates.customerName);
    expect(updatedCustomer?.address1).toBe(updates.customerData.address1);

    // التحقق من تحديث بيانات الطلب
    const updatedOrder = await db.getOrderById(testOrderId);
    expect(updatedOrder).toBeDefined();
    expect(updatedOrder?.locationLink).toBe(updates.locationLink);
    expect(updatedOrder?.price).toBe(updates.price);
    expect(updatedOrder?.address).toBe(updates.address);
  });

  afterAll(async () => {
    // حذف الطلب الاختباري
    if (testOrderId) {
      await db.deleteOrder(testOrderId);
    }
    // لا حاجة لحذف الزبون - سيبقى في قاعدة البيانات
  });
});
