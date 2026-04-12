import { describe, it, expect, beforeAll } from "vitest";
import { db } from "./db";

describe("Orders Delivery Operations", () => {
  let testOrderId: number;
  let testDeliveryId: number;

  beforeAll(async () => {
    // Create test delivery person
    const delivery = await db.createUser({
      username: "test_delivery_ops",
      password: "test123",
      name: "Test Delivery Ops",
      role: "delivery",
    });
    testDeliveryId = delivery.id;

    // Create test order
    const order = await db.createOrder({
      customerId: 1,
      deliveryPersonId: testDeliveryId,
      regionId: 1,
      provinceId: 1,
      price: 5000,
      address1: "Test Address",
      note: "Test Order",
    });
    testOrderId = order.id;
  });

  it("should update order to postponed with reason", async () => {
    const result = await db.updateOrderStatus(testOrderId, "postponed", {
      postponeReason: "العميل غير موجود",
    });
    
    expect(result).toBeDefined();
    
    const order = await db.getOrderById(testOrderId);
    expect(order?.status).toBe("postponed");
    expect(order?.postponeReason).toBe("العميل غير موجود");
  });

  it("should update order to returned with reason", async () => {
    const result = await db.updateOrderStatus(testOrderId, "returned", {
      returnReason: "العميل رفض الاستلام",
    });
    
    expect(result).toBeDefined();
    
    const order = await db.getOrderById(testOrderId);
    expect(order?.status).toBe("returned");
    expect(order?.returnReason).toBe("العميل رفض الاستلام");
  });

  it("should update order to delivered with image", async () => {
    const testImageUrl = "https://example.com/delivery-image.jpg";
    
    const result = await db.updateOrderStatus(testOrderId, "delivered", {
      deliveryImage: testImageUrl,
      deliveredAt: new Date(),
    });
    
    expect(result).toBeDefined();
    
    const order = await db.getOrderById(testOrderId);
    expect(order?.status).toBe("delivered");
    expect(order?.deliveryImage).toBe(testImageUrl);
    expect(order?.deliveredAt).toBeDefined();
  });
});
