// طلبات المندوب غير المكتملة يجب ألّا تختفي أبداً بسبب مرور الوقت.
// هذا الاختبار يحرس الخطأ الذي كان يُخفي طلبات الأمس غير المنجزة من صفحة المندوب.
import { describe, it, expect } from "vitest";
import { getBusinessDayStart, getBusinessDayStartSql } from "./dateUtils";

// نسخة مطابقة لمنطق الفلترة في client/src/pages/delivery/Dashboard.tsx
const FINISHED_STATUSES = ["delivered", "returned", "cancelled"];

function businessDayStart(now: Date): Date {
  const start = new Date(now);
  start.setHours(5, 0, 0, 0);
  if (now.getHours() < 5) start.setDate(start.getDate() - 1);
  return start;
}

function filterOrdersByTime(orders: any[], now: Date) {
  const dayStart = businessDayStart(now).getTime();
  return orders.filter((order: any) => {
    if (!FINISHED_STATUSES.includes(order.status)) return true;
    const raw = order.deliveredAt || order.updatedAt || order.createdAt;
    const at = raw ? new Date(raw).getTime() : NaN;
    if (!Number.isFinite(at)) return true;
    return at >= dayStart;
  });
}

describe("فلترة طلبات المندوب", () => {
  const now = new Date("2026-09-18T12:00:00");
  const twoDaysAgo = new Date("2026-09-16T10:00:00").toISOString();
  const today = new Date("2026-09-18T09:00:00").toISOString();

  it("يُبقي الطلبات غير المكتملة القديمة ظاهرة", () => {
    const orders = [
      { id: 1, status: "pending_approval", createdAt: twoDaysAgo },
      { id: 2, status: "pending", createdAt: twoDaysAgo },
      { id: 3, status: "postponed", createdAt: twoDaysAgo },
    ];
    expect(filterOrdersByTime(orders, now).map((o) => o.id)).toEqual([1, 2, 3]);
  });

  it("يُخفي الطلبات المنتهية من أيام سابقة", () => {
    const orders = [
      { id: 4, status: "delivered", createdAt: twoDaysAgo, deliveredAt: twoDaysAgo },
      { id: 5, status: "returned", createdAt: twoDaysAgo, updatedAt: twoDaysAgo },
      { id: 6, status: "cancelled", createdAt: twoDaysAgo, updatedAt: twoDaysAgo },
    ];
    expect(filterOrdersByTime(orders, now)).toHaveLength(0);
  });

  it("يُبقي الطلبات المسلّمة اليوم", () => {
    const orders = [{ id: 7, status: "delivered", createdAt: today, deliveredAt: today }];
    expect(filterOrdersByTime(orders, now)).toHaveLength(1);
  });

  it("لا يُخفي طلباً بتاريخ غير صالح", () => {
    const orders = [{ id: 8, status: "delivered", createdAt: "not-a-date", deliveredAt: null }];
    expect(filterOrdersByTime(orders, now)).toHaveLength(1);
  });
});

describe("بداية يوم العمل بتوقيت بغداد", () => {
  it("الساعة 12 ظهراً بغداد ⇒ البداية 5 فجر اليوم نفسه", () => {
    // 2026-09-18 09:00 UTC = 12:00 بغداد
    const start = getBusinessDayStart(new Date("2026-09-18T09:00:00Z"));
    expect(start.toISOString()).toBe("2026-09-18T02:00:00.000Z"); // 05:00 بغداد
  });

  it("الساعة 2 فجراً بغداد ⇒ البداية 5 فجر أمس", () => {
    // 2026-09-17 23:00 UTC = 02:00 بغداد يوم 18
    const start = getBusinessDayStart(new Date("2026-09-17T23:00:00Z"));
    expect(start.toISOString()).toBe("2026-09-17T02:00:00.000Z"); // 05:00 بغداد يوم 17
  });

  it("الساعة 6 صباحاً UTC (9 صباحاً بغداد) ⇒ اليوم نفسه، لا يتأثر بتوقيت الخادم", () => {
    const start = getBusinessDayStart(new Date("2026-09-18T06:00:00Z"));
    expect(start.toISOString()).toBe("2026-09-18T02:00:00.000Z");
  });

  it("يُنتج صيغة DATETIME صالحة لـ MySQL", () => {
    expect(getBusinessDayStartSql(new Date("2026-09-18T09:00:00Z")))
      .toBe("2026-09-18 02:00:00");
  });
});
