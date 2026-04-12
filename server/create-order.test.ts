import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";

describe("Enhanced Order Creation", () => {
  it("should create order with customer data and hidePhoneFromDelivery", async () => {
    const caller = appRouter.createCaller({
      user: { id: 1, role: "admin" } as any,
    });
    
    const result = await caller.orders.create({
      deliveryPersonId: 1,
      regionId: 1,
      provinceId: 1,
      price: 50000,
      hidePhoneFromDelivery: 1,
      customerData: {
        phone: "07701112233",
        name: "Test Customer Enhanced",
        address1: "Baghdad, Test Street",
        locationUrl1: "https://maps.google.com/test",
      },
    });
    
    expect(result.success).toBe(true);
  });
  
  it("should find existing customer by phone", async () => {
    const caller = appRouter.createCaller({
      user: { id: 1, role: "admin" } as any,
    });
    
    const customer = await caller.customers.getByPhone({
      phone: "07701112233",
    });
    
    expect(customer).toBeDefined();
    if (customer) {
      expect(customer.phone).toBe("07701112233");
      expect(customer.name).toBe("Test Customer Enhanced");
    }
  });
  
  it("should search customers", async () => {
    const caller = appRouter.createCaller({
      user: { id: 1, role: "admin" } as any,
    });
    
    const results = await caller.customers.search({
      query: "077011",
    });
    
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
  });
});
