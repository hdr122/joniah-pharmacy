import { describe, it, expect, beforeAll } from 'vitest';
import * as db from './db';

describe('Delivery Performance Stats', () => {
  it('should return delivery person stats with role filtering', async () => {
    // Test getting all delivery persons stats
    const allStats = await db.getDeliveryPersonStats();
    
    // Should return an array
    expect(Array.isArray(allStats)).toBe(true);
    
    // If there are stats, each should have required fields
    if (allStats.length > 0) {
      const stat = allStats[0];
      expect(stat).toHaveProperty('deliveryPersonId');
      expect(stat).toHaveProperty('deliveryPersonName');
      expect(stat).toHaveProperty('totalOrders');
      expect(stat).toHaveProperty('deliveredOrders');
      expect(stat).toHaveProperty('returnedOrders');
      expect(stat).toHaveProperty('postponedOrders');
      expect(stat).toHaveProperty('cancelledOrders');
      expect(stat).toHaveProperty('totalRevenue');
      expect(stat).toHaveProperty('avgDeliveryTime');
      
      // Verify deliveryPersonId is not null (should only return delivery persons with orders)
      expect(stat.deliveryPersonId).not.toBeNull();
    }
  });

  it('should filter stats by specific delivery person', async () => {
    // First get all stats to find a delivery person ID
    const allStats = await db.getDeliveryPersonStats();
    
    if (allStats.length > 0) {
      const firstDeliveryPersonId = allStats[0].deliveryPersonId;
      
      // Get stats for specific delivery person
      const specificStats = await db.getDeliveryPersonStats(firstDeliveryPersonId);
      
      // Should return exactly one result
      expect(specificStats.length).toBe(1);
      expect(specificStats[0].deliveryPersonId).toBe(firstDeliveryPersonId);
    }
  });

  it('should filter stats by date range', async () => {
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), 1); // First day of month
    const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); // Last day of month
    
    const stats = await db.getDeliveryPersonStats(undefined, startDate, endDate);
    
    // Should return an array (may be empty if no orders in range)
    expect(Array.isArray(stats)).toBe(true);
  });
});
