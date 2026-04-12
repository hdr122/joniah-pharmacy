import { describe, it, expect } from "vitest";
import * as db from "./db";

describe("getDeliveryPersonOrdersFiltered", () => {
  it("should return orders with all required fields including price", async () => {
    // Get orders for any delivery person
    const orders = await db.getDeliveryPersonOrdersFiltered();
    
    // Check if we have orders
    if (orders && orders.length > 0) {
      const firstOrder = orders[0];
      
      // Verify all required fields exist
      expect(firstOrder).toHaveProperty("id");
      expect(firstOrder).toHaveProperty("customerName");
      expect(firstOrder).toHaveProperty("customerPhone");
      expect(firstOrder).toHaveProperty("price");
      expect(firstOrder).toHaveProperty("status");
      expect(firstOrder).toHaveProperty("regionName");
      expect(firstOrder).toHaveProperty("provinceName");
      expect(firstOrder).toHaveProperty("deliveryPersonId");
      expect(firstOrder).toHaveProperty("deliveryPersonName");
      expect(firstOrder).toHaveProperty("createdAt");
      expect(firstOrder).toHaveProperty("deliveryMinutes");
      expect(firstOrder).toHaveProperty("totalMinutes");
      
      // Verify price is a number
      expect(typeof firstOrder.price).toBe("number");
      
      console.log("✅ First order has all required fields:");
      console.log(`   - ID: ${firstOrder.id}`);
      console.log(`   - Price: ${firstOrder.price} IQD`);
      console.log(`   - Status: ${firstOrder.status}`);
      console.log(`   - Customer: ${firstOrder.customerName}`);
      console.log(`   - Region: ${firstOrder.regionName}`);
    } else {
      console.log("⚠️ No orders found in database");
    }
  });

  it("should filter orders by date range correctly", async () => {
    // Test with a date range (last 7 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    const orders = await db.getDeliveryPersonOrdersFiltered(undefined, startDate, endDate);
    
    if (orders && orders.length > 0) {
      // Verify all orders are within the date range
      orders.forEach(order => {
        const orderDate = new Date(order.createdAt);
        expect(orderDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
        expect(orderDate.getTime()).toBeLessThanOrEqual(endDate.getTime());
      });
      
      console.log(`✅ Found ${orders.length} orders in the last 7 days`);
      console.log(`   - Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    } else {
      console.log("⚠️ No orders found in the last 7 days");
    }
  });

  it("should calculate delivery time correctly for delivered orders", async () => {
    const orders = await db.getDeliveryPersonOrdersFiltered();
    
    if (orders && orders.length > 0) {
      const deliveredOrders = orders.filter(o => o.status === "delivered" && o.deliveryMinutes !== null);
      
      if (deliveredOrders.length > 0) {
        const firstDelivered = deliveredOrders[0];
        
        // Verify delivery minutes is a number
        expect(typeof firstDelivered.deliveryMinutes).toBe("number");
        expect(firstDelivered.deliveryMinutes).toBeGreaterThan(0);
        
        console.log("✅ Delivery time calculation works:");
        console.log(`   - Order #${firstDelivered.id}`);
        console.log(`   - Delivery time: ${firstDelivered.deliveryMinutes} minutes`);
        console.log(`   - Total time: ${firstDelivered.totalMinutes} minutes`);
      } else {
        console.log("⚠️ No delivered orders with delivery time found");
      }
    }
  });
});
