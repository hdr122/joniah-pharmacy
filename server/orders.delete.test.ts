import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";

describe("Orders Delete System", () => {
  let adminContext: any;
  let testOrderId: number;

  beforeAll(async () => {
    // Create admin context for testing
    const adminUser = await db.getUserByUsername("admin");
    if (!adminUser) {
      throw new Error("Admin user not found. Please ensure admin user exists.");
    }

    adminContext = {
      user: adminUser,
      req: {} as any,
      res: {} as any,
    };

    // Create a test order
    await db.createOrder({
      deliveryPersonId: adminUser.id,
      regionId: 1,
      provinceId: 1,
      price: 10000,
      note: "Test order for deletion",
    });

    // Get the test order
    const orders = await db.getAllOrders();
    const testOrder = orders.find((o: any) => o.note === "Test order for deletion");
    if (!testOrder) {
      throw new Error("Failed to create test order");
    }
    testOrderId = testOrder.id;
  });

  it("should delete order (soft delete)", async () => {
    const caller = appRouter.createCaller(adminContext);
    
    // Delete the order
    const result = await caller.orders.deleteOrder({ orderId: testOrderId });
    expect(result.success).toBe(true);

    // Verify order is not in active orders list
    const activeOrders = await db.getAllOrders();
    const deletedOrderInActive = activeOrders.find((o: any) => o.id === testOrderId);
    expect(deletedOrderInActive).toBeUndefined();
  });

  it("should list deleted orders", async () => {
    const caller = appRouter.createCaller(adminContext);
    
    // Get deleted orders
    const deletedOrders = await caller.orders.listDeleted();
    
    // Verify our test order is in deleted list
    const ourDeletedOrder = deletedOrders.find((o: any) => o.id === testOrderId);
    expect(ourDeletedOrder).toBeDefined();
    expect(ourDeletedOrder?.isDeleted).toBe(true);
    expect(ourDeletedOrder?.deletedBy).toBe(adminContext.user.id);
  });

  it("should restore deleted order", async () => {
    const caller = appRouter.createCaller(adminContext);
    
    // Restore the order
    const result = await caller.orders.restoreOrder({ orderId: testOrderId });
    expect(result.success).toBe(true);

    // Verify order is back in active orders list
    const activeOrders = await db.getAllOrders();
    const restoredOrder = activeOrders.find((o: any) => o.id === testOrderId);
    expect(restoredOrder).toBeDefined();
    expect(restoredOrder?.isDeleted).toBe(false);
  });

  it("should exclude deleted orders from statistics", async () => {
    const caller = appRouter.createCaller(adminContext);
    
    // Delete the order again
    await caller.orders.deleteOrder({ orderId: testOrderId });

    // Get dashboard stats
    const stats = await caller.stats.dashboard();
    
    // Get all orders including deleted
    const allOrdersIncludingDeleted = await db.getDb().then(async (database) => {
      if (!database) return [];
      const { orders } = await import("../drizzle/schema");
      return await database.select().from(orders);
    });

    // Verify stats don't include deleted orders
    expect(stats.totalOrders).toBeLessThan(allOrdersIncludingDeleted.length);
  });
});
