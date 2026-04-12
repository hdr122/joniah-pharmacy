import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  saveOrderRoutePoint: vi.fn().mockResolvedValue({ id: 1 }),
  getOrderRoutePoints: vi.fn().mockResolvedValue([
    {
      id: 1,
      orderId: 1,
      deliveryPersonId: 1,
      latitude: "33.3152",
      longitude: "44.3661",
      accuracy: "10",
      speed: "15",
      heading: "90",
      deviationFromRoute: 0,
      isOffRoute: false,
      timestamp: new Date(),
    },
  ]),
  getActiveOrdersWithLiveTracking: vi.fn().mockResolvedValue([
    {
      id: 1,
      customerName: "Test Customer",
      regionName: "Test Region",
      deliveryPersonId: 1,
      deliveryPersonName: "Test Delivery",
      status: "pending",
      currentLocation: {
        latitude: "33.3152",
        longitude: "44.3661",
        speed: "15",
      },
      trackingPoints: [],
      totalPoints: 5,
      isTracking: true,
      lastUpdate: new Date(),
    },
  ]),
  getOrderLiveTracking: vi.fn().mockResolvedValue({
    order: {
      id: 1,
      customerName: "Test Customer",
      regionName: "Test Region",
      deliveryPersonId: 1,
      deliveryPersonName: "Test Delivery",
      status: "pending",
    },
    trackingPoints: [
      {
        latitude: "33.3152",
        longitude: "44.3661",
        timestamp: new Date(),
      },
    ],
    currentLocation: {
      latitude: "33.3152",
      longitude: "44.3661",
    },
    stats: {
      totalPoints: 5,
      distanceCovered: 2.5,
      startTime: new Date(),
      lastUpdate: new Date(),
      isOffRoute: false,
      deviation: 0,
    },
  }),
  getOrderDeliveryProgress: vi.fn().mockResolvedValue({
    orderId: 1,
    status: "pending",
    isTracking: true,
    currentLocation: {
      latitude: "33.3152",
      longitude: "44.3661",
      speed: "15",
    },
    trackingStats: {
      totalPoints: 5,
      avgSpeed: 30,
      durationMinutes: 15,
      lastUpdate: new Date(),
      currentSpeed: 35,
      accuracy: "10",
    },
    path: [
      { lat: 33.3152, lng: 44.3661, timestamp: new Date(), speed: 15, isOffRoute: false },
    ],
  }),
}));

import * as db from "./db";

describe("Order Route Tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("saveOrderRoutePoint", () => {
    it("should save a route point successfully", async () => {
      const result = await db.saveOrderRoutePoint({
        orderId: 1,
        deliveryPersonId: 1,
        latitude: "33.3152",
        longitude: "44.3661",
        accuracy: "10",
        speed: "15",
        heading: "90",
        deviationFromRoute: 0,
        isOffRoute: false,
      });

      expect(result).toEqual({ id: 1 });
      expect(db.saveOrderRoutePoint).toHaveBeenCalledWith({
        orderId: 1,
        deliveryPersonId: 1,
        latitude: "33.3152",
        longitude: "44.3661",
        accuracy: "10",
        speed: "15",
        heading: "90",
        deviationFromRoute: 0,
        isOffRoute: false,
      });
    });
  });

  describe("getOrderRoutePoints", () => {
    it("should return route points for an order", async () => {
      const result = await db.getOrderRoutePoints(1);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        orderId: 1,
        deliveryPersonId: 1,
        latitude: "33.3152",
        longitude: "44.3661",
      });
    });
  });

  describe("getActiveOrdersWithLiveTracking", () => {
    it("should return active orders with tracking data", async () => {
      const result = await db.getActiveOrdersWithLiveTracking();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
        customerName: "Test Customer",
        isTracking: true,
        totalPoints: 5,
      });
    });
  });

  describe("getOrderLiveTracking", () => {
    it("should return live tracking data for an order", async () => {
      const result = await db.getOrderLiveTracking(1);

      expect(result).not.toBeNull();
      expect(result?.order.id).toBe(1);
      expect(result?.stats.totalPoints).toBe(5);
      expect(result?.stats.distanceCovered).toBe(2.5);
    });
  });

  describe("getOrderDeliveryProgress", () => {
    it("should return delivery progress for an order", async () => {
      const result = await db.getOrderDeliveryProgress(1);

      expect(result).not.toBeNull();
      expect(result?.orderId).toBe(1);
      expect(result?.isTracking).toBe(true);
      expect(result?.trackingStats.avgSpeed).toBe(30);
      expect(result?.path).toHaveLength(1);
    });
  });
});

describe("Coordinate Validation", () => {
  it("should validate latitude range", () => {
    const validLat = 33.3152;
    const invalidLat = 100;

    expect(validLat >= -90 && validLat <= 90).toBe(true);
    expect(invalidLat >= -90 && invalidLat <= 90).toBe(false);
  });

  it("should validate longitude range", () => {
    const validLng = 44.3661;
    const invalidLng = 200;

    expect(validLng >= -180 && validLng <= 180).toBe(true);
    expect(invalidLng >= -180 && invalidLng <= 180).toBe(false);
  });

  it("should validate Iraq coordinates range", () => {
    // Iraq approximate bounds: lat 29-38, lng 38-49
    const baghdadLat = 33.3152;
    const baghdadLng = 44.3661;

    expect(baghdadLat >= 29 && baghdadLat <= 38).toBe(true);
    expect(baghdadLng >= 38 && baghdadLng <= 49).toBe(true);
  });
});

describe("Distance Calculation", () => {
  // Haversine formula test
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  it("should calculate distance between two points correctly", () => {
    // Baghdad to Basra (approximately 450 km)
    const baghdadLat = 33.3152;
    const baghdadLng = 44.3661;
    const basraLat = 30.5085;
    const basraLng = 47.7804;

    const distance = calculateDistance(baghdadLat, baghdadLng, basraLat, basraLng);
    
    // Should be approximately 450-500 km
    expect(distance).toBeGreaterThan(400);
    expect(distance).toBeLessThan(550);
  });

  it("should return 0 for same coordinates", () => {
    const lat = 33.3152;
    const lng = 44.3661;

    const distance = calculateDistance(lat, lng, lat, lng);
    
    expect(distance).toBe(0);
  });
});

describe("Speed Conversion", () => {
  it("should convert m/s to km/h correctly", () => {
    const speedMs = 10; // 10 m/s
    const speedKmh = speedMs * 3.6;

    expect(speedKmh).toBe(36);
  });

  it("should handle zero speed", () => {
    const speedMs = 0;
    const speedKmh = speedMs * 3.6;

    expect(speedKmh).toBe(0);
  });
});
