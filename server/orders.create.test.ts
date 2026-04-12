import { describe, it, expect } from 'vitest';
import { appRouter } from './routers';
import type { TrpcContext } from './_core/context';

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createTestContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    username: 'test_admin',
    name: 'Test Admin',
    role: 'admin',
    openId: 'test-admin-openid',
    email: 'admin@test.com',
    loginMethod: 'manus',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return ctx;
}

describe('Orders - Create Order and List Test', () => {
  it('should verify that orders.list returns data correctly', async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // اختبار جلب قائمة الطلبات
    const ordersList = await caller.orders.list({ limit: 10, offset: 0 });

    // التحقق من أن القائمة تعمل بشكل صحيح
    expect(ordersList).toBeDefined();
    expect(Array.isArray(ordersList)).toBe(true);
    
    // إذا كان هناك طلبات، تحقق من البنية
    if (ordersList.length > 0) {
      const firstOrder = ordersList[0];
      expect(firstOrder).toHaveProperty('id');
      expect(firstOrder).toHaveProperty('status');
      expect(firstOrder).toHaveProperty('createdAt');
    }
  });

  it('should verify that orders.count returns a number', async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // اختبار عد الطلبات
    const count = await caller.orders.count();

    // التحقق من أن العد يعمل بشكل صحيح
    expect(count).toBeDefined();
    expect(typeof count).toBe('number');
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
