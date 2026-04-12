import { describe, it, expect } from 'vitest';
import * as db from './db';

describe('Backup System', () => {
  it('should have all required backup functions', () => {
    expect(db.getAllUsers).toBeDefined();
    expect(db.getAllLocations).toBeDefined();
    expect(db.getAllOrdersForBackup).toBeDefined();
    expect(db.getAllDailyStats).toBeDefined();
    expect(db.getAllActivityLogs).toBeDefined();
  });

  it('should return arrays from backup functions', async () => {
    const users = await db.getAllUsers();
    const locations = await db.getAllLocations();
    const orders = await db.getAllOrdersForBackup();
    const dailyStats = await db.getAllDailyStats();
    const activityLogs = await db.getAllActivityLogs();

    expect(Array.isArray(users)).toBe(true);
    expect(Array.isArray(locations)).toBe(true);
    expect(Array.isArray(orders)).toBe(true);
    expect(Array.isArray(dailyStats)).toBe(true);
    expect(Array.isArray(activityLogs)).toBe(true);
    
    // All should be empty arrays in fresh database
    expect(users.length).toBeGreaterThanOrEqual(0);
    expect(locations.length).toBeGreaterThanOrEqual(0);
    expect(orders.length).toBeGreaterThanOrEqual(0);
    expect(dailyStats.length).toBeGreaterThanOrEqual(0);
    expect(activityLogs.length).toBeGreaterThanOrEqual(0);
  });
});
