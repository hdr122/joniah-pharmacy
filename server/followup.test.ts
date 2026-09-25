// قسم المتابعة: الإعدادات وحدود الحماية وساعات الهدوء والجدولة.
// الحماية هنا ليست تجميلية — إعدادات متساهلة تحرق رقم واتساب فعلياً.
import { describe, it, expect, beforeAll } from "vitest";
import * as followup from "./followup";
import * as whatsapp from "./whatsapp";
import { getDb } from "./db";
import { sql } from "drizzle-orm";

const BRANCH = 999001; // فرع وهمي لا يمسّ بيانات حقيقية

describe("قسم المتابعة — الإعدادات والحماية", () => {
  beforeAll(async () => {
    await followup.ensureTables();
    // نظّف أثر أي تشغيل سابق — وإلا فحص الإعدادات الافتراضية يقرأ إعدادات محفوظة
    const d = await getDb();
    if (d) {
      await d.execute(sql`DELETE FROM followup_settings WHERE branchId = ${BRANCH}`);
      await d.execute(sql`DELETE FROM followup_jobs WHERE branchId = ${BRANCH}`);
      await d.execute(sql`DELETE FROM followup_campaigns WHERE branchId = ${BRANCH}`);
    }
  });

  it("يعيد إعدادات افتراضية آمنة لفرع بلا إعدادات", async () => {
    const s = await followup.getSettings(BRANCH);
    expect(s.enabled).toBe(false);          // لا يعمل قبل أن يُفعّله صاحب الفرع
    expect(s.anchor).toBe("delivered");
    expect(s.delayHours).toBe(24);
    expect(s.intervalSec).toBeGreaterThanOrEqual(10);
    expect(s.checkOnWhatsApp).toBe(true);
  });

  it("يرفض فاصلاً زمنياً أقل من 10 ثوانٍ (يحرق الرقم)", async () => {
    const s = await followup.saveSettings(BRANCH, { intervalSec: 0 });
    expect(s.intervalSec).toBe(10);
  });

  it("يحدّ القيم المتطرفة ضمن نطاق معقول", async () => {
    const s = await followup.saveSettings(BRANCH, {
      intervalSec: 999999, batchSize: 0, batchPauseMin: -5, dailyCap: 99999, delayHours: -3,
      quietFromHour: 99, quietToHour: -1,
    });
    expect(s.intervalSec).toBe(3600);
    expect(s.batchSize).toBe(1);
    expect(s.batchPauseMin).toBe(0);
    expect(s.dailyCap).toBe(5000);
    expect(s.delayHours).toBe(0);
    expect(s.quietFromHour).toBe(23);
    expect(s.quietToHour).toBe(0);
  });

  it("يحفظ الإعدادات ويعيدها كما هي", async () => {
    const saved = await followup.saveSettings(BRANCH, {
      enabled: true, anchor: "created", delayHours: 2,
      intervalSec: 20, batchSize: 5, batchPauseMin: 5, dailyCap: 150,
      template: "مرحباً {name} من {branch}",
    });
    expect(saved.anchor).toBe("created");
    expect(saved.delayHours).toBe(2);
    expect(saved.intervalSec).toBe(20);
    expect(saved.batchSize).toBe(5);
    expect(saved.batchPauseMin).toBe(5);

    const again = await followup.getSettings(BRANCH);
    expect(again).toEqual(saved);
  });

  it("يملأ متغيّرات القالب", () => {
    const out = followup.render("مرحباً {name} 👋 طلبك #{order} من {branch} بمبلغ {total}", {
      name: "أبو أحمد", order: 12, branch: "مطعمنا", total: "11,000",
    });
    expect(out).toContain("أبو أحمد");
    expect(out).toContain("#12");
    expect(out).toContain("مطعمنا");
    expect(out).not.toContain("{name}");
  });
});

describe("قسم المتابعة — خطّ واتساب منفصل", () => {
  it("خط المتابعة مستقل عن الخط الأساسي", () => {
    const main = whatsapp.status(BRANCH, "main");
    const follow = whatsapp.status(BRANCH, "followup");
    expect(main.line).toBe("main");
    expect(follow.line).toBe("followup");
    // اتصالان منفصلان: ربط أحدهما لا يجعل الآخر متصلاً
    expect(whatsapp.isConnected(BRANCH, "main")).toBe(false);
    expect(whatsapp.isConnected(BRANCH, "followup")).toBe(false);
  });

  it("asLine يقبل followup فقط ويُرجع main لأي شيء آخر", () => {
    expect(whatsapp.asLine("followup")).toBe("followup");
    expect(whatsapp.asLine("main")).toBe("main");
    expect(whatsapp.asLine("xxx")).toBe("main");
    expect(whatsapp.asLine(undefined)).toBe("main");
  });
});

describe("قسم المتابعة — الجدولة", () => {
  beforeAll(async () => {
    await followup.ensureTables();
    const d = await getDb();
    if (d) await d.execute(sql`DELETE FROM followup_jobs WHERE branchId = ${BRANCH}`);
  });

  it("لا يُجدوِل شيئاً والقسم معطّل", async () => {
    await followup.saveSettings(BRANCH, { enabled: false, anchor: "created" });
    await followup.onOrderCreated(BRANCH, 99900001);
    const jobs = await followup.listJobs(BRANCH);
    expect(jobs.length).toBe(0);
  });

  it("لا يُجدوِل عند التسليم إن كانت البداية «من الإنشاء»", async () => {
    await followup.saveSettings(BRANCH, { enabled: true, anchor: "created" });
    await followup.onOrderDelivered(BRANCH, 99900002);
    const jobs = await followup.listJobs(BRANCH);
    expect(jobs.length).toBe(0);
  });

  it("الإحصاءات تعمل على فرع فارغ", async () => {
    const st = await followup.stats(BRANCH);
    expect(st.pending).toBe(0);
    expect(st.sentToday).toBe(0);
  });

  it("runnerInfo يعيد حالة صالحة بلا تشغيل", () => {
    const info = followup.runnerInfo(BRANCH);
    expect(info.busy).toBe(false);
    expect(info.pausedUntil).toBeNull();
  });
});
