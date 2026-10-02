// مزامنة دفعات المواقع ونقاط المسار المخزّنة محلياً (عند عودة الإنترنت).
// تحرس: الإدراج الدفعي يعمل، يحافظ على الوقت الأصلي لكل نقطة، ويُقيَّد بدور المندوب.
import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import { getDb } from "./db";
import { sql } from "drizzle-orm";

describe("مزامنة دفعات GPS دون اتصال", () => {
  let riderId: number;
  let branchId: number;

  beforeAll(async () => {
    let rider = await db.getUserByUsername("test_batch_rider");
    if (!rider) {
      await db.createUser({ name: "مندوب دفعات", username: "test_batch_rider", password: "x", role: "delivery", phone: "7" });
      rider = await db.getUserByUsername("test_batch_rider");
    }
    riderId = rider!.id;
    branchId = (rider as any).branchId ?? 1;
  });

  const caller = () => appRouter.createCaller({
    user: { id: riderId, role: "delivery", branchId } as any,
    req: {} as any, res: {} as any,
  });

  it("يُدرج دفعة مواقع ويحافظ على وقت التسجيل الأصلي", async () => {
    const recordedAt = "2026-01-02T08:15:30.000Z";
    const r = await caller().gps.saveLocationsBatch({
      points: [
        { latitude: "33.30", longitude: "44.40", accuracy: "8", recordedAt },
        { latitude: "33.31", longitude: "44.41", accuracy: "9", battery: "77", recordedAt },
      ],
    });
    expect(r.success).toBe(true);
    expect(r.inserted).toBe(2);

    const d = await getDb();
    const rows: any = await d!.execute(sql`SELECT createdAt FROM delivery_locations
      WHERE deliveryPersonId = ${riderId} AND latitude = '33.30' ORDER BY id DESC LIMIT 1`);
    const row = (Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows)[0];
    // الوقت المحفوظ يوافق وقت التسجيل (بصيغة DATETIME) لا وقت الإدراج
    expect(String(row.createdAt)).toContain("2026-01-02");
  });

  it("يُدرج دفعة نقاط مسار لطلب", async () => {
    const r = await caller().gps.saveRoutePointsBatch({
      points: [
        { orderId: 999999, latitude: "33.32", longitude: "44.42", recordedAt: "2026-01-02T08:16:00.000Z" },
        { orderId: 999999, latitude: "33.33", longitude: "44.43" },
      ],
    });
    expect(r.success).toBe(true);
    expect(r.inserted).toBe(2);
  });

  it("يرفض غير المندوب", async () => {
    const admin = appRouter.createCaller({ user: { id: 1, role: "admin", branchId } as any, req: {} as any, res: {} as any });
    await expect(admin.gps.saveLocationsBatch({ points: [{ latitude: "1", longitude: "1" }] })).rejects.toThrow();
  });

  it("يرفض دفعة فارغة", async () => {
    await expect(caller().gps.saveLocationsBatch({ points: [] as any })).rejects.toThrow();
  });
});
