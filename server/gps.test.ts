import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";

describe("GPS Tracking APIs", () => {
  let deliveryPersonId: number;
  let adminUserId: number;

  beforeAll(async () => {
    // Get or create test delivery person
    let deliveryUser = await db.getUserByUsername("test_delivery_gps");
    
    if (!deliveryUser) {
      await db.createUser({
        name: "Test Delivery Person",
        username: "test_delivery_gps",
        password: "test123",
        role: "delivery",
        phone: "1234567890",
      });
      deliveryUser = await db.getUserByUsername("test_delivery_gps");
    }
    
    if (deliveryUser) {
      deliveryPersonId = deliveryUser.id;
    }

    // Get admin user
    const admin = await db.getUserByUsername("admin");
    if (admin) {
      adminUserId = admin.id;
    }
  });

  it("should save delivery person location", async () => {
    const caller = appRouter.createCaller({
      user: { id: deliveryPersonId, role: "delivery" } as any,
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.gps.saveLocation({
      latitude: "33.3152",
      longitude: "44.3661",
      accuracy: "10",
    });

    expect(result.success).toBe(true);
  });

  it("should get active delivery locations (admin only)", async () => {
    // First save a location
    const deliveryCaller = appRouter.createCaller({
      user: { id: deliveryPersonId, role: "delivery" } as any,
      req: {} as any,
      res: {} as any,
    });

    await deliveryCaller.gps.saveLocation({
      latitude: "33.3152",
      longitude: "44.3661",
      accuracy: "10",
    });

    // Then get active locations as admin
    const adminCaller = appRouter.createCaller({
      user: { id: adminUserId, role: "admin" } as any,
      req: {} as any,
      res: {} as any,
    });

    const locations = await adminCaller.gps.getActiveLocations();
    
    expect(Array.isArray(locations)).toBe(true);
    // Check if our test delivery person is in the list
    const hasTestPerson = locations.some((loc: any) => 
      loc.deliveryPersonId === deliveryPersonId
    );
    expect(hasTestPerson).toBe(true);
  });

  it("should get location history for delivery person", async () => {
    const caller = appRouter.createCaller({
      user: { id: deliveryPersonId, role: "delivery" } as any,
      req: {} as any,
      res: {} as any,
    });

    const history = await caller.gps.getLocationHistory({
      deliveryPersonId: deliveryPersonId,
      hours: 24,
    });

    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThan(0);
  });

  it("should prevent non-delivery users from saving location", async () => {
    const caller = appRouter.createCaller({
      user: { id: adminUserId, role: "admin" } as any,
      req: {} as any,
      res: {} as any,
    });

    await expect(
      caller.gps.saveLocation({
        latitude: "33.3152",
        longitude: "44.3661",
      })
    ).rejects.toThrow();
  });

  it("should prevent non-admin from viewing all active locations", async () => {
    const caller = appRouter.createCaller({
      user: { id: deliveryPersonId, role: "delivery" } as any,
      req: {} as any,
      res: {} as any,
    });

    await expect(caller.gps.getActiveLocations()).rejects.toThrow();
  });

  it("should prevent delivery person from viewing other's location history", async () => {
    // Get or create another delivery person
    let otherDelivery = await db.getUserByUsername("other_delivery_gps");
    
    if (!otherDelivery) {
      await db.createUser({
        name: "Other Delivery",
        username: "other_delivery_gps",
        password: "test123",
        role: "delivery",
        phone: "9876543210",
      });
      otherDelivery = await db.getUserByUsername("other_delivery_gps");
    }
    
    if (!otherDelivery) throw new Error("Failed to create test user");

    const caller = appRouter.createCaller({
      user: { id: deliveryPersonId, role: "delivery" } as any,
      req: {} as any,
      res: {} as any,
    });

    await expect(
      caller.gps.getLocationHistory({
        deliveryPersonId: otherDelivery.id,
        hours: 24,
      })
    ).rejects.toThrow();
  });
});
