// فصل رقم الواتساب وإعادة ربطه يجب ألّا يُفقد شيئاً:
// لا الرسائل ولا المحادثات ولا تسجيلات المكالمات ولا رسائل المتابعة المجدولة.
// الوحيد الذي يُحذف هو مفاتيح الجلسة (whatsapp_auth) — وهذا هو معنى «فصل الرقم».
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as whatsapp from "./whatsapp";
import * as db from "./db";
import { sql } from "drizzle-orm";

const B = 999004;

function rowsOf(r: any): any[] {
  if (!Array.isArray(r)) return r?.rows || [];
  if (r.length > 0 && Array.isArray(r[0])) return r[0];
  return r;
}

describe("فصل رقم الواتساب وإعادة ربطه لا يُفقد البيانات", () => {
  let d: any;

  beforeAll(async () => {
    d = await db.getDb();
    if (!d) throw new Error("قاعدة البيانات غير متاحة");
    await whatsapp.clearAuth(B, "main");
    await whatsapp.clearAuth(B, "followup");
    await d.execute(sql`DELETE FROM whatsapp_messages WHERE branchId = ${B}`);
    await d.execute(sql`DELETE FROM whatsapp_conversations WHERE branchId = ${B}`);

    // محادثات ورسائل على الخطّين
    await whatsapp.storeMessage(B, "9647700000011", false, "سؤال من زبون", "أبو علي", "wa-1", "main");
    await whatsapp.storeMessage(B, "9647700000011", true, "أهلاً بك", "", "wa-2", "main");
    await whatsapp.storeMessage(B, "9647700000022", false, "رد على رسالة المتابعة", "أم حسن", "wa-3", "followup");

    // جلسة مرتبطة على الخطّين
    await d.execute(sql`INSERT INTO whatsapp_auth (branchId, line, k, v) VALUES (${B}, 'main', 'creds', '{"me":{"id":"9647700000001:1@s.whatsapp.net"}}')
      ON DUPLICATE KEY UPDATE v = VALUES(v)`);
    await d.execute(sql`INSERT INTO whatsapp_auth (branchId, line, k, v) VALUES (${B}, 'followup', 'creds', '{"me":{"id":"9647700000002:1@s.whatsapp.net"}}')
      ON DUPLICATE KEY UPDATE v = VALUES(v)`);

    // تسجيل مكالمة بصوتها
    await db.saveCallRecording(B, {
      phone: "07700000011", customerName: "أبو علي", transcript: "نص مكالمة",
      audioBase64: "A".repeat(200), mimeType: "audio/amr",
    });
  });

  afterAll(async () => {
    if (!d) return;
    await d.execute(sql`DELETE FROM whatsapp_messages WHERE branchId = ${B}`);
    await d.execute(sql`DELETE FROM whatsapp_conversations WHERE branchId = ${B}`);
    await d.execute(sql`DELETE FROM whatsapp_auth WHERE branchId = ${B}`);
    await d.execute(sql`DELETE FROM call_recording_audio WHERE branchId = ${B}`);
    await d.execute(sql`DELETE FROM call_recordings WHERE branchId = ${B}`);
  });

  it("فصل الخط الأساسي يمسح جلسته فقط", async () => {
    expect(await whatsapp.hasSavedSession(B, "main")).toBe(true);
    await whatsapp.logout(B, "main");
    expect(await whatsapp.hasSavedSession(B, "main")).toBe(false);

    // كل ما عدا الجلسة باقٍ كما هو
    const convs = await whatsapp.listConversations(B, 200, "main");
    expect(convs.length).toBe(1);
    const msgs = await whatsapp.getMessages(B, "9647700000011", 300, "main");
    expect(msgs.length).toBe(2);
    expect(String(msgs[0].text)).toContain("سؤال من زبون");
  });

  it("تسجيلات المكالمات وصوتها تبقى بعد الفصل", async () => {
    const recs = await db.getCallRecordings(B);
    expect(recs.length).toBe(1);
    const audio = await db.getCallRecordingAudio(B, Number((recs[0] as any).id));
    expect(audio?.audioBase64?.length).toBeGreaterThan(100);
  });

  it("فصل خط لا يمسّ جلسة الخط الآخر ولا صندوقه", async () => {
    expect(await whatsapp.hasSavedSession(B, "followup")).toBe(true); // بقي مربوطاً
    const convs = await whatsapp.listConversations(B, 200, "followup");
    expect(convs.length).toBe(1);
    expect(String(convs[0].lastText)).toContain("رد على رسالة المتابعة");
  });

  it("إعادة الربط تُعيد الرسائل القديمة كما هي — والمحادثة تتصل بالجديد", async () => {
    // ربط رقم مختلف تماماً عن السابق
    await d.execute(sql`INSERT INTO whatsapp_auth (branchId, line, k, v)
      VALUES (${B}, 'main', 'creds', '{"me":{"id":"9647709999999:1@s.whatsapp.net"}}')
      ON DUPLICATE KEY UPDATE v = VALUES(v)`);
    expect(await whatsapp.hasSavedSession(B, "main")).toBe(true);
    // والأرشيف لم يتأثّر لا بالفصل ولا بإعادة الربط برقم جديد
    const msgs = await whatsapp.getMessages(B, "9647700000011", 300, "main");
    expect(msgs.length).toBe(2);

    // ورسالة جديدة بعد إعادة الربط تُضاف لنفس المحادثة لا لمحادثة جديدة
    await whatsapp.storeMessage(B, "9647700000011", false, "رسالة بعد إعادة الربط", "أبو علي", "wa-4", "main");
    const after = await whatsapp.getMessages(B, "9647700000011", 300, "main");
    expect(after.length).toBe(3);
    const convs = await whatsapp.listConversations(B, 200, "main");
    expect(convs.length).toBe(1); // محادثة واحدة لا اثنتان
  });

  it("رسائل المتابعة المجدولة تبقى في الانتظار بعد الفصل", async () => {
    const followup = await import("./followup");
    await followup.ensureTables();
    await d.execute(sql`DELETE FROM followup_jobs WHERE branchId = ${B}`);
    await d.execute(sql`INSERT INTO followup_jobs (branchId, phone, name, body, dueAt, status)
      VALUES (${B}, '9647700000011', 'أبو علي', 'رسالة متابعة', NOW(), 'pending')`);

    await whatsapp.logout(B, "followup");

    const jobs = await followup.listJobs(B, { status: "pending" });
    expect(jobs.length).toBe(1); // لم تُلغَ — تُرسل متى أُعيد الربط
    await d.execute(sql`DELETE FROM followup_jobs WHERE branchId = ${B}`);
  });
});
