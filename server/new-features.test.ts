import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";

describe("New Features Tests", () => {
  let testCustomerId: number;
  
  describe("Customers Management", () => {
    it("should create a customer", async () => {
      const caller = appRouter.createCaller({
        user: { id: 1, role: "admin" } as any,
      });
      
      const result = await caller.customers.create({
        name: "Test Customer",
        phone: "07701234567",
        email: "test@example.com",
        address1: "Baghdad, Iraq",
      });
      
      expect(result.success).toBe(true);
    });
    
    it("should search for customer by phone", async () => {
      const caller = appRouter.createCaller({
        user: { id: 1, role: "admin" } as any,
      });
      
      const result = await caller.customers.getByPhone({
        phone: "07701234567",
      });
      
      expect(result).toBeDefined();
      if (result) {
        expect(result.phone).toBe("07701234567");
        testCustomerId = result.id;
      }
    });
    
    it("should get customer stats", async () => {
      const caller = appRouter.createCaller({
        user: { id: 1, role: "admin" } as any,
      });
      
      if (testCustomerId) {
        const stats = await caller.customers.getStats({
          customerId: testCustomerId,
        });
        
        expect(stats).toBeDefined();
        expect(stats).toHaveProperty("totalOrders");
        expect(stats).toHaveProperty("deliveredOrders");
        expect(stats).toHaveProperty("totalSpent");
      }
    });
  });
  
  describe("Advanced Reports", () => {
    it("should get incomplete orders report", async () => {
      const caller = appRouter.createCaller({
        user: { id: 1, role: "admin" } as any,
      });
      
      const report = await caller.reports.incompleteOrders();
      
      expect(report).toBeDefined();
      expect(report).toHaveProperty("total");
      expect(report).toHaveProperty("postponed");
      expect(report).toHaveProperty("cancelled");
      expect(report).toHaveProperty("returned");
    });
    
    it("should get monthly performance", async () => {
      const caller = appRouter.createCaller({
        user: { id: 1, role: "admin" } as any,
      });
      
      const performance = await caller.reports.monthlyPerformance({
        year: 2025,
      });
      
      expect(performance).toBeDefined();
      expect(Array.isArray(performance)).toBe(true);
      expect(performance.length).toBe(12);
    });
    
    it("should get delivery speed stats", async () => {
      const caller = appRouter.createCaller({
        user: { id: 1, role: "admin" } as any,
      });
      
      const stats = await caller.reports.deliverySpeed({});
      
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty("avgDeliveryTime");
      expect(stats).toHaveProperty("fastestDelivery");
      expect(stats).toHaveProperty("slowestDelivery");
    });
  });
  
  describe("Order Timestamps", () => {
    it("should have acceptedAt and deliveredAt fields", async () => {
      const orders = await db.getAllOrders();
      
      if (orders && orders.length > 0) {
        const order = orders[0];
        expect(order).toHaveProperty("acceptedAt");
        expect(order).toHaveProperty("deliveredAt");
      }
    });
  });
});
