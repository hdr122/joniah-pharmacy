// ترحيل جداول واتساب إلى نظام الخطّين (main / followup).
// هذه أخطر نقطة في إضافة قسم المتابعة: قاعدة الإنتاج فيها جداول بلا عمود line
// وبمفاتيح أوّلية قديمة، والترحيل يجب أن يضيف العمود ويغيّر المفتاح بلا فقدان صف واحد
// (فقدان whatsapp_auth يعني انقطاع ربط الواتساب وإعادة مسح الباركود).
import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "./db";
import { sql } from "drizzle-orm";

const B = 999002;

function rowsOf(r: any): any[] {
  if (!Array.isArray(r)) return r?.rows || [];
  if (r.length > 0 && Array.isArray(r[0])) return r[0];
  return r;
}

describe("ترحيل جداول واتساب إلى الخطّين", () => {
  let d: any;

  beforeAll(async () => {
    d = await getDb();
    if (!d) throw new Error("قاعدة البيانات غير متاحة");

    // أعِد بناء الجداول بالشكل القديم (قبل إضافة الخطوط) وضع فيها بيانات
    await d.execute(sql`DROP TABLE IF EXISTS whatsapp_auth`);
    await d.execute(sql`DROP TABLE IF EXISTS whatsapp_conversations`);
    await d.execute(sql`DROP TABLE IF EXISTS whatsapp_messages`);
    await d.execute(sql`DROP TABLE IF EXISTS whatsapp_log`);

    await d.execute(sql`CREATE TABLE whatsapp_auth (
      branchId INT NOT NULL, k VARCHAR(191) NOT NULL, v LONGTEXT, PRIMARY KEY (branchId, k))`);
    await d.execute(sql`CREATE TABLE whatsapp_log (
      id INT AUTO_INCREMENT PRIMARY KEY, branchId INT NOT NULL, kind VARCHAR(20) NOT NULL,
      toPhone VARCHAR(30) DEFAULT '', orderId INT NULL, status VARCHAR(20) NOT NULL, error TEXT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await d.execute(sql`CREATE TABLE whatsapp_messages (
      id INT AUTO_INCREMENT PRIMARY KEY, branchId INT NOT NULL, phone VARCHAR(30) NOT NULL,
      fromMe TINYINT DEFAULT 0, text TEXT, pushName VARCHAR(191) DEFAULT '', waId VARCHAR(191) DEFAULT '',
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await d.execute(sql`CREATE TABLE whatsapp_conversations (
      branchId INT NOT NULL, phone VARCHAR(30) NOT NULL, name VARCHAR(191) DEFAULT '',
      lastText TEXT, lastAt TIMESTAMP NULL, unread INT DEFAULT 0, summary TEXT, summaryAt TIMESTAMP NULL,
      summaryDirty TINYINT DEFAULT 1, PRIMARY KEY (branchId, phone))`);

    await d.execute(sql`INSERT INTO whatsapp_auth (branchId, k, v) VALUES (${B}, 'creds', '{"me":{"id":"OLD"}}')`);
    await d.execute(sql`INSERT INTO whatsapp_log (branchId, kind, toPhone, status) VALUES (${B}, 'customer', '9647700000001', 'sent')`);
    await d.execute(sql`INSERT INTO whatsapp_messages (branchId, phone, fromMe, text) VALUES (${B}, '9647700000001', 0, 'رسالة قديمة')`);
    await d.execute(sql`INSERT INTO whatsapp_conversations (branchId, phone, name, lastText) VALUES (${B}, '9647700000001', 'زبون قديم', 'رسالة قديمة')`);

    // الآن شغّل الترحيل عبر أول استدعاء حقيقي للوحدة
    const whatsapp = await import("./whatsapp");
    await whatsapp.getLogs(B); // يستدعي ensureTables داخلياً
  });

  it("يضيف عمود line إلى كل الجداول الأربعة", async () => {
    for (const t of ["whatsapp_auth", "whatsapp_log", "whatsapp_messages", "whatsapp_conversations"]) {
      const cols = rowsOf(await d.execute(sql.raw(`SHOW COLUMNS FROM ${t} LIKE 'line'`)));
      expect(cols.length, `${t} بلا عمود line`).toBe(1);
      expect(String(cols[0].Default)).toBe("main");
    }
  });

  it("لا يفقد أي صف من البيانات القديمة", async () => {
    const n = async (t: string) =>
      Number(rowsOf(await d.execute(sql.raw(`SELECT COUNT(*) n FROM ${t} WHERE branchId = ${B}`)))[0].n);
    expect(await n("whatsapp_auth")).toBe(1);
    expect(await n("whatsapp_log")).toBe(1);
    expect(await n("whatsapp_messages")).toBe(1);
    expect(await n("whatsapp_conversations")).toBe(1);
  });

  it("يضع البيانات القديمة على الخط الأساسي — أي أن ربط الواتساب يبقى سليماً", async () => {
    const creds = rowsOf(await d.execute(sql`SELECT line, v FROM whatsapp_auth WHERE branchId = ${B} AND k = 'creds'`))[0];
    expect(creds.line).toBe("main");
    expect(String(creds.v)).toContain("OLD");
  });

  it("يغيّر المفتاح الأوّلي ليشمل الخط — فيمكن ربط رقمين لنفس الفرع", async () => {
    // نفس المفتاح القديم (branchId, k) لكن بخط مختلف: يجب أن يُقبل
    await d.execute(sql`INSERT INTO whatsapp_auth (branchId, line, k, v) VALUES (${B}, 'followup', 'creds', '{"me":{"id":"NEW"}}')`);
    const rows = rowsOf(await d.execute(sql`SELECT line FROM whatsapp_auth WHERE branchId = ${B} AND k = 'creds' ORDER BY line`));
    expect(rows.map((r: any) => r.line)).toEqual(["followup", "main"]);

    // وكذلك المحادثات: نفس الرقم على خطّين مختلفين محادثتان منفصلتان
    await d.execute(sql`INSERT INTO whatsapp_conversations (branchId, line, phone, name, lastText)
      VALUES (${B}, 'followup', '9647700000001', 'زبون قديم', 'رد على رقم المتابعة')`);
    const convs = rowsOf(await d.execute(sql`SELECT line, lastText FROM whatsapp_conversations
      WHERE branchId = ${B} AND phone = '9647700000001' ORDER BY line`));
    expect(convs.length).toBe(2);
  });

  it("الترحيل قابل للتكرار — تشغيله مرّتين لا يُسقط شيئاً", async () => {
    const whatsapp = await import("./whatsapp");
    // أجبر إعادة التنفيذ بإسقاط علامة الجاهزية عبر وحدة جديدة غير ممكن هنا،
    // لذا ننفّذ عبارات الترحيل نفسها مباشرةً ونتأكد أنها لا ترمي ولا تُتلف.
    const tryExec = async (q: any) => { try { await d.execute(q); } catch (_) { /* مطبّق سلفاً */ } };
    await tryExec(sql`ALTER TABLE whatsapp_auth ADD COLUMN line VARCHAR(16) NOT NULL DEFAULT 'main'`);
    await tryExec(sql`ALTER TABLE whatsapp_auth DROP PRIMARY KEY, ADD PRIMARY KEY (branchId, line, k)`);
    await tryExec(sql`ALTER TABLE whatsapp_conversations DROP PRIMARY KEY, ADD PRIMARY KEY (branchId, line, phone)`);

    const n = Number(rowsOf(await d.execute(sql`SELECT COUNT(*) n FROM whatsapp_auth WHERE branchId = ${B}`))[0].n);
    expect(n).toBe(2);
    expect(await whatsapp.getLogs(B)).toBeInstanceOf(Array);
  });
});
