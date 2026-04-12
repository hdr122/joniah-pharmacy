import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock admin user
function createAdminContext(): { ctx: TrpcContext } {
  const user = {
    id: 1,
    openId: "admin-test",
    email: "admin@test.com",
    name: "Admin Test",
    username: "admin",
    loginMethod: "custom",
    role: "admin" as const,
    phone: null,
    profileImage: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    passwordHash: null,
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
      cookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("Basic API Tests", () => {
  it("should return current user from auth.me", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();

    expect(result).toBeDefined();
    expect(result?.username).toBe("admin");
    expect(result?.role).toBe("admin");
  });

  it("should get dashboard stats for admin", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.stats.dashboard();

    expect(result).toBeDefined();
    expect(result).toHaveProperty("totalOrders");
    expect(result).toHaveProperty("activeDeliveries");
    expect(result).toHaveProperty("deliveredOrders");
    expect(result).toHaveProperty("totalRegions");
  });

  it("should list all regions", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.regions.list();

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("should list all provinces", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.provinces.list();

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });
});
