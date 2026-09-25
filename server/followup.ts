/**
 * 📣 قسم المتابعة — واتساب ثانٍ لمتابعة الزبائن بعد الطلب
 * ==========================================================================
 * رقم واتساب منفصل تماماً عن رقم الفرع الأساسي (باركود مستقل، صندوق رسائل مستقل)،
 * مهمّته إرسال رسالة متابعة للزبون بعد مدّة من طلبه، وإطلاق حملات يدوية على
 * زبائن الفرع.
 *
 * مصدرا الرسائل:
 *   • مؤقّت الطلب  — يُجدوَل تلقائياً لكل طلب. بداية العدّ من إنشاء الطلب أو من
 *                     تسليمه حسب الإعدادات، والمدّة بالساعات (افتراضياً 24).
 *   • حملة يدوية  — كل زبائن الفرع أو عدد محدّد منهم (الأحدث طلباً أولاً).
 *
 * 🛡 نظام الحماية (هذه أرقام حقيقية يُحظر بسببها الواتساب إن أُسيء استخدامها):
 *   • فاصل زمني بين كل رسالة والتالية (افتراضياً 60 ثانية) + عشوائية تُضاف إليه.
 *   • بعد كل دفعة (افتراضياً 5 رسائل) استراحة (افتراضياً 5 دقائق) ثم تُكمل البقية.
 *   • حدّ يومي كلّي للرسائل.
 *   • التحقّق من أن الرقم على واتساب قبل الإرسال — الأرقام غير الموجودة تُتخطّى.
 *   • ساعات هدوء: لا إرسال ليلاً (افتراضياً من 10 مساءً حتى 9 صباحاً).
 *
 * كل شيء هنا best-effort: فشل المتابعة يجب ألّا يكسر طلباً أبداً.
 */
import { sql } from "drizzle-orm";
import * as db from "./db";
import * as whatsapp from "./whatsapp";

const LINE = "followup" as const;

function rowsOf(r: any): any[] {
  if (!Array.isArray(r)) return r?.rows || [];
  if (r.length > 0 && Array.isArray(r[0])) return r[0];
  return r;
}

// ساعة بغداد الحالية (الخادم يعمل بـ UTC على Railway)
function baghdadHour(now: Date = new Date()): number {
  return new Date(now.getTime() + 3 * 3600e3).getUTCHours();
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────────────────────
// الجداول
// ─────────────────────────────────────────────────────────────────────────────
let tablesReady = false;
export async function ensureTables() {
  if (tablesReady) return;
  const d = await db.getDb();
  if (!d) return;
  await d.execute(sql`CREATE TABLE IF NOT EXISTS followup_settings (
    branchId INT PRIMARY KEY,
    enabled TINYINT DEFAULT 0,
    autoEnabled TINYINT DEFAULT 1,
    template TEXT,
    anchor VARCHAR(12) DEFAULT 'delivered',
    delayHours INT DEFAULT 24,
    intervalSec INT DEFAULT 60,
    jitterSec INT DEFAULT 15,
    batchSize INT DEFAULT 5,
    batchPauseMin INT DEFAULT 5,
    dailyCap INT DEFAULT 200,
    checkOnWhatsApp TINYINT DEFAULT 1,
    quietFromHour INT DEFAULT 22,
    quietToHour INT DEFAULT 9,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);
  await d.execute(sql`CREATE TABLE IF NOT EXISTS followup_campaigns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    branchId INT NOT NULL,
    name VARCHAR(191) DEFAULT '',
    template TEXT,
    target VARCHAR(16) DEFAULT 'all',
    limitCount INT DEFAULT 0,
    status VARCHAR(12) DEFAULT 'running',
    total INT DEFAULT 0,
    createdBy INT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    finishedAt TIMESTAMP NULL,
    INDEX branch_created (branchId, createdAt)
  )`);
  await d.execute(sql`CREATE TABLE IF NOT EXISTS followup_jobs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    branchId INT NOT NULL,
    campaignId INT NULL,
    orderId INT NULL,
    customerId INT NULL,
    phone VARCHAR(30) NOT NULL,
    name VARCHAR(191) DEFAULT '',
    body TEXT,
    dueAt TIMESTAMP NOT NULL,
    status VARCHAR(12) NOT NULL DEFAULT 'pending',
    error TEXT,
    claimedAt TIMESTAMP NULL,
    sentAt TIMESTAMP NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_branch_order (branchId, orderId),
    INDEX due_idx (branchId, status, dueAt),
    INDEX campaign_idx (campaignId, status)
  )`);
  // ترحيل: أعمدة أُضيفت بعد أول إصدار (MySQL لا يدعم ADD COLUMN IF NOT EXISTS)
  try { await d.execute(sql`ALTER TABLE followup_jobs ADD COLUMN claimedAt TIMESTAMP NULL`); } catch (_) { /* مطبّق سلفاً */ }

  tablesReady = true;
}

// ─────────────────────────────────────────────────────────────────────────────
// الإعدادات
// ─────────────────────────────────────────────────────────────────────────────
export const DEFAULT_TEMPLATE =
  "مرحباً {name} 👋\nشكراً لطلبك من {branch}.\nنتمنى أن تكون التجربة نالت رضاك 🌹\nإن كان لديك أي ملاحظة راسلنا على هذا الرقم، رأيك يهمّنا.";

export type FollowupSettings = {
  enabled: boolean;
  autoEnabled: boolean;
  template: string;
  anchor: "delivered" | "created";
  delayHours: number;
  intervalSec: number;
  jitterSec: number;
  batchSize: number;
  batchPauseMin: number;
  dailyCap: number;
  checkOnWhatsApp: boolean;
  quietFromHour: number;
  quietToHour: number;
};

const DEFAULTS: FollowupSettings = {
  enabled: false, autoEnabled: true, template: DEFAULT_TEMPLATE,
  anchor: "delivered", delayHours: 24,
  intervalSec: 60, jitterSec: 15, batchSize: 5, batchPauseMin: 5,
  dailyCap: 200, checkOnWhatsApp: true, quietFromHour: 22, quietToHour: 9,
};

export async function getSettings(branchId: number): Promise<FollowupSettings> {
  await ensureTables();
  const d = await db.getDb();
  if (!d) return { ...DEFAULTS };
  const row = rowsOf(await d.execute(sql`SELECT * FROM followup_settings WHERE branchId = ${branchId} LIMIT 1`))[0];
  if (!row) return { ...DEFAULTS };
  return {
    enabled: !!Number(row.enabled),
    autoEnabled: !!Number(row.autoEnabled),
    template: row.template || DEFAULT_TEMPLATE,
    anchor: row.anchor === "created" ? "created" : "delivered",
    delayHours: Number(row.delayHours ?? 24),
    intervalSec: Number(row.intervalSec ?? 60),
    jitterSec: Number(row.jitterSec ?? 15),
    batchSize: Number(row.batchSize ?? 5),
    batchPauseMin: Number(row.batchPauseMin ?? 5),
    dailyCap: Number(row.dailyCap ?? 200),
    checkOnWhatsApp: !!Number(row.checkOnWhatsApp),
    quietFromHour: Number(row.quietFromHour ?? 22),
    quietToHour: Number(row.quietToHour ?? 9),
  };
}

export async function saveSettings(branchId: number, s: Partial<FollowupSettings>) {
  await ensureTables();
  const d = await db.getDb();
  if (!d) throw new Error("Database not available");
  const n: FollowupSettings = { ...(await getSettings(branchId)), ...s };

  // حدود عاقلة — تمنع إعدادات تحرق الرقم (مثل فاصل صفر مع 5000 رسالة)
  const clamp = (v: number, lo: number, hi: number, dflt: number) =>
    Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : dflt;
  n.delayHours = clamp(n.delayHours, 0, 720, 24);
  n.intervalSec = clamp(n.intervalSec, 10, 3600, 60);       // 10 ثوانٍ حدّ أدنى صارم
  n.jitterSec = clamp(n.jitterSec, 0, 600, 15);
  n.batchSize = clamp(n.batchSize, 1, 100, 5);
  n.batchPauseMin = clamp(n.batchPauseMin, 0, 240, 5);
  n.dailyCap = clamp(n.dailyCap, 1, 5000, 200);
  n.quietFromHour = clamp(n.quietFromHour, 0, 23, 22);
  n.quietToHour = clamp(n.quietToHour, 0, 23, 9);
  n.template = String(n.template || DEFAULT_TEMPLATE).slice(0, 2000);
  n.anchor = n.anchor === "created" ? "created" : "delivered";

  await d.execute(sql`INSERT INTO followup_settings
    (branchId, enabled, autoEnabled, template, anchor, delayHours, intervalSec, jitterSec, batchSize,
     batchPauseMin, dailyCap, checkOnWhatsApp, quietFromHour, quietToHour)
    VALUES (${branchId}, ${n.enabled ? 1 : 0}, ${n.autoEnabled ? 1 : 0}, ${n.template}, ${n.anchor}, ${n.delayHours},
     ${n.intervalSec}, ${n.jitterSec}, ${n.batchSize}, ${n.batchPauseMin}, ${n.dailyCap},
     ${n.checkOnWhatsApp ? 1 : 0}, ${n.quietFromHour}, ${n.quietToHour})
    ON DUPLICATE KEY UPDATE
     enabled=VALUES(enabled), autoEnabled=VALUES(autoEnabled), template=VALUES(template), anchor=VALUES(anchor),
     delayHours=VALUES(delayHours), intervalSec=VALUES(intervalSec), jitterSec=VALUES(jitterSec),
     batchSize=VALUES(batchSize), batchPauseMin=VALUES(batchPauseMin), dailyCap=VALUES(dailyCap),
     checkOnWhatsApp=VALUES(checkOnWhatsApp), quietFromHour=VALUES(quietFromHour), quietToHour=VALUES(quietToHour)`);
  return n;
}

// ─────────────────────────────────────────────────────────────────────────────
// قالب الرسالة
// ─────────────────────────────────────────────────────────────────────────────
export function render(tpl: string, vars: Record<string, string | number | null | undefined>) {
  return whatsapp.renderTemplate(tpl, vars);
}

async function branchName(branchId: number): Promise<string> {
  try { return (await db.getBranchById(branchId))?.name || "فرعنا"; } catch { return "فرعنا"; }
}

// ─────────────────────────────────────────────────────────────────────────────
// جدولة متابعة طلب (مؤقّت تلقائي) — متابعة واحدة لكل طلب (UNIQUE على orderId)
// ─────────────────────────────────────────────────────────────────────────────
async function scheduleOrder(branchId: number, orderId: number, anchorAt: Date) {
  const s = await getSettings(branchId);
  if (!s.enabled || !s.autoEnabled) return;

  const order: any = await db.getOrderById(orderId);
  if (!order) return;
  const phone = whatsapp.normalizePhone(order.customerPhone || "");
  if (!phone) return; // زبون بلا رقم — لا متابعة

  const due = new Date(anchorAt.getTime() + s.delayHours * 3600e3);
  const body = render(s.template, {
    name: order.customerName || "زبوننا العزيز",
    phone: order.customerPhone || "",
    order: orderId,
    total: order.price != null ? Number(order.price) - Number(order.discount || 0) : "",
    area: order.regionName || "",
    address: order.address || order.customerAddress1 || "",
    branch: await branchName(branchId),
  });

  const d = await db.getDb();
  if (!d) return;
  await ensureTables();
  // INSERT IGNORE: لو جُدول هذا الطلب سابقاً لا نُكرّر المتابعة
  await d.execute(sql`INSERT IGNORE INTO followup_jobs
    (branchId, campaignId, orderId, customerId, phone, name, body, dueAt, status)
    VALUES (${branchId}, NULL, ${orderId}, ${order.customerId ?? null}, ${phone},
     ${String(order.customerName || "").slice(0, 190)}, ${body},
     ${due.toISOString().slice(0, 19).replace("T", " ")}, 'pending')`);
}

/** طلب جديد أُنشئ — يُجدوَل فقط إن كانت بداية العدّ «من إنشاء الطلب». */
export async function onOrderCreated(branchId: number, orderId: number) {
  try {
    const s = await getSettings(branchId);
    if (s.anchor !== "created") return;
    await scheduleOrder(branchId, orderId, new Date());
  } catch (e: any) { console.warn("[followup] onOrderCreated:", e?.message || e); }
}

/** طلب سُلِّم — يُجدوَل فقط إن كانت بداية العدّ «من تسليم الطلب». */
export async function onOrderDelivered(branchId: number, orderId: number) {
  try {
    const s = await getSettings(branchId);
    if (s.anchor !== "delivered") return;
    await scheduleOrder(branchId, orderId, new Date());
  } catch (e: any) { console.warn("[followup] onOrderDelivered:", e?.message || e); }
}

/** طلب أُلغي أو حُذف — ألغِ متابعته المعلّقة. */
export async function onOrderCancelled(branchId: number, orderId: number) {
  try {
    await ensureTables();
    const d = await db.getDb();
    if (!d) return;
    await d.execute(sql`UPDATE followup_jobs SET status = 'cancelled'
      WHERE branchId = ${branchId} AND orderId = ${orderId} AND status = 'pending'`);
  } catch (e: any) { console.warn("[followup] onOrderCancelled:", e?.message || e); }
}

// ─────────────────────────────────────────────────────────────────────────────
// الحملات اليدوية
// ─────────────────────────────────────────────────────────────────────────────
export type CampaignTarget = "all" | "ordered";

/** عدد الزبائن الذين ستطالهم الحملة — للمعاينة قبل الإطلاق. */
export async function audienceCount(branchId: number, target: CampaignTarget, limitCount = 0) {
  const rows = await pickAudience(branchId, target, limitCount);
  return { count: rows.length };
}

async function pickAudience(branchId: number, target: CampaignTarget, limitCount = 0) {
  const d = await db.getDb();
  if (!d) return [];
  const cap = limitCount > 0 ? Math.min(limitCount, 5000) : 5000;
  // 'ordered' = زبائن لديهم طلب فعلي من هذا الفرع (الأحدث طلباً أولاً)
  // 'all'     = كل زبائن الفرع (الأحدث تسجيلاً أولاً)
  const q = target === "ordered"
    ? sql`SELECT c.id, c.name, c.phone, MAX(o.createdAt) lastOrder
          FROM customers c JOIN orders o ON o.customerId = c.id AND o.isDeleted = 0
          WHERE c.branchId = ${branchId} AND c.phone <> ''
          GROUP BY c.id, c.name, c.phone
          ORDER BY lastOrder DESC LIMIT ${sql.raw(String(cap))}`
    : sql`SELECT c.id, c.name, c.phone FROM customers c
          WHERE c.branchId = ${branchId} AND c.phone <> ''
          ORDER BY c.id DESC LIMIT ${sql.raw(String(cap))}`;
  return rowsOf(await d.execute(q));
}

export async function createCampaign(branchId: number, input: {
  name?: string; template?: string; target: CampaignTarget; limitCount?: number; createdBy?: number;
}) {
  await ensureTables();
  const d = await db.getDb();
  if (!d) throw new Error("Database not available");
  const s = await getSettings(branchId);
  const tpl = String(input.template || s.template || DEFAULT_TEMPLATE).slice(0, 2000);
  const target: CampaignTarget = input.target === "ordered" ? "ordered" : "all";
  const limitCount = Math.max(0, Math.min(Number(input.limitCount) || 0, 5000));

  const people = await pickAudience(branchId, target, limitCount);
  if (!people.length) throw new Error("لا يوجد زبائن مطابقون لهذا الاختيار");

  const res: any = await d.execute(sql`INSERT INTO followup_campaigns
    (branchId, name, template, target, limitCount, status, total, createdBy)
    VALUES (${branchId}, ${String(input.name || "حملة متابعة").slice(0, 190)}, ${tpl}, ${target},
     ${limitCount}, 'running', ${people.length}, ${input.createdBy ?? null})`);
  const campaignId = Number(res?.insertId ?? res?.[0]?.insertId ?? 0);

  const bname = await branchName(branchId);
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  let queued = 0;
  for (const p of people) {
    const phone = whatsapp.normalizePhone(p.phone || "");
    if (!phone) continue;
    const body = render(tpl, { name: p.name || "زبوننا العزيز", phone: p.phone || "", branch: bname, order: "", total: "", area: "", address: "" });
    await d.execute(sql`INSERT INTO followup_jobs
      (branchId, campaignId, orderId, customerId, phone, name, body, dueAt, status)
      VALUES (${branchId}, ${campaignId}, NULL, ${p.id ?? null}, ${phone},
       ${String(p.name || "").slice(0, 190)}, ${body}, ${now}, 'pending')`);
    queued++;
  }
  await d.execute(sql`UPDATE followup_campaigns SET total = ${queued} WHERE id = ${campaignId}`);
  kick(branchId);
  return { id: campaignId, queued };
}

export async function listCampaigns(branchId: number, limit = 30) {
  await ensureTables();
  const d = await db.getDb();
  if (!d) return [];
  return rowsOf(await d.execute(sql`SELECT c.*,
      (SELECT COUNT(*) FROM followup_jobs j WHERE j.campaignId = c.id AND j.status = 'sent') sent,
      (SELECT COUNT(*) FROM followup_jobs j WHERE j.campaignId = c.id AND j.status = 'skipped') skipped,
      (SELECT COUNT(*) FROM followup_jobs j WHERE j.campaignId = c.id AND j.status = 'failed') failed,
      (SELECT COUNT(*) FROM followup_jobs j WHERE j.campaignId = c.id AND j.status = 'pending') pending
    FROM followup_campaigns c WHERE c.branchId = ${branchId}
    ORDER BY c.id DESC LIMIT ${sql.raw(String(Math.min(Math.max(limit, 1), 100)))}`));
}

export async function cancelCampaign(branchId: number, campaignId: number) {
  await ensureTables();
  const d = await db.getDb();
  if (!d) throw new Error("Database not available");
  await d.execute(sql`UPDATE followup_jobs SET status = 'cancelled'
    WHERE branchId = ${branchId} AND campaignId = ${campaignId} AND status = 'pending'`);
  await d.execute(sql`UPDATE followup_campaigns SET status = 'cancelled', finishedAt = NOW()
    WHERE branchId = ${branchId} AND id = ${campaignId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// قائمة الانتظار والإحصاءات
// ─────────────────────────────────────────────────────────────────────────────
export async function listJobs(branchId: number, opts?: { status?: string; limit?: number }) {
  await ensureTables();
  const d = await db.getDb();
  if (!d) return [];
  const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 500);
  const st = opts?.status;
  return rowsOf(await d.execute(sql`SELECT * FROM followup_jobs
    WHERE branchId = ${branchId} ${st ? sql`AND status = ${st}` : sql``}
    ORDER BY (status = 'pending') DESC, dueAt ASC, id DESC
    LIMIT ${sql.raw(String(limit))}`));
}

export async function stats(branchId: number) {
  await ensureTables();
  const d = await db.getDb();
  if (!d) return { pending: 0, dueNow: 0, sentToday: 0, skippedToday: 0, failedToday: 0 };
  const row = rowsOf(await d.execute(sql`SELECT
      SUM(status = 'pending') pending,
      SUM(status = 'pending' AND dueAt <= NOW()) dueNow,
      SUM(status = 'sent' AND DATE(sentAt) = CURDATE()) sentToday,
      SUM(status = 'skipped' AND DATE(sentAt) = CURDATE()) skippedToday,
      SUM(status = 'failed' AND DATE(sentAt) = CURDATE()) failedToday
    FROM followup_jobs WHERE branchId = ${branchId}`))[0] || {};
  return {
    pending: Number(row.pending || 0), dueNow: Number(row.dueNow || 0),
    sentToday: Number(row.sentToday || 0), skippedToday: Number(row.skippedToday || 0),
    failedToday: Number(row.failedToday || 0),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// العامل (worker) — يُنفّذ الإرسال بالإيقاع المحدّد في الحماية
// ─────────────────────────────────────────────────────────────────────────────
type RunState = { busy: boolean; pausedUntil: number; inBatch: number; lastNote: string };
const runners = new Map<number, RunState>();

function runState(branchId: number): RunState {
  let r = runners.get(branchId);
  if (!r) { r = { busy: false, pausedUntil: 0, inBatch: 0, lastNote: "" }; runners.set(branchId, r); }
  return r;
}

/** حالة العامل لهذا الفرع (تُعرض في الواجهة). */
export function runnerInfo(branchId: number) {
  const r = runState(branchId);
  return {
    busy: r.busy,
    pausedUntil: r.pausedUntil > Date.now() ? new Date(r.pausedUntil).toISOString() : null,
    note: r.lastNote,
  };
}

function inQuietHours(s: FollowupSettings, now = new Date()): boolean {
  if (s.quietFromHour === s.quietToHour) return false; // لا ساعات هدوء
  const h = baghdadHour(now);
  return s.quietFromHour < s.quietToHour
    ? h >= s.quietFromHour && h < s.quietToHour
    : h >= s.quietFromHour || h < s.quietToHour;      // تمتدّ عبر منتصف الليل
}

async function markJob(jobId: number, status: string, error = "") {
  const d = await db.getDb();
  if (!d) return;
  await d.execute(sql`UPDATE followup_jobs SET status = ${status}, error = ${error.slice(0, 500)}, sentAt = NOW() WHERE id = ${jobId}`);
}

/** يدفع عامل الفرع للعمل فوراً إن لم يكن مشغولاً. */
export function kick(branchId: number) {
  runBranch(branchId).catch((e) => console.warn("[followup] run:", e?.message || e));
}

async function runBranch(branchId: number) {
  const r = runState(branchId);
  if (r.busy) return;
  if (Date.now() < r.pausedUntil) return;   // في استراحة دفعة

  const s = await getSettings(branchId);
  if (!s.enabled) return;
  if (!whatsapp.isConnected(branchId, LINE)) { r.lastNote = "واتساب المتابعة غير متصل"; return; }
  if (inQuietHours(s)) { r.lastNote = `ساعات هدوء (${s.quietFromHour}:00–${s.quietToHour}:00)`; return; }

  const d = await db.getDb();
  if (!d) return;
  await ensureTables();

  r.busy = true;
  try {
    r.inBatch = 0;
    while (true) {
      if (Date.now() < r.pausedUntil) break;

      const sentToday = await whatsapp.countToday(branchId, LINE, "followup");
      if (sentToday >= s.dailyCap) { r.lastNote = `بلغ الحد اليومي (${s.dailyCap})`; break; }

      const job: any = rowsOf(await d.execute(sql`SELECT * FROM followup_jobs
        WHERE branchId = ${branchId} AND status = 'pending' AND dueAt <= NOW()
        ORDER BY dueAt ASC, id ASC LIMIT 1`))[0];
      if (!job) { r.lastNote = "لا توجد رسائل مستحقّة"; break; }

      // احجز المهمة فوراً كي لا يلتقطها نداء متزامن آخر
      const claim: any = await d.execute(sql`UPDATE followup_jobs SET status = 'sending', claimedAt = NOW()
        WHERE id = ${job.id} AND status = 'pending'`);
      const claimed = Number(claim?.affectedRows ?? claim?.[0]?.affectedRows ?? 0);
      if (!claimed) continue;

      // ✅ هل الرقم على واتساب أصلاً؟
      if (s.checkOnWhatsApp) {
        const onWa = await whatsapp.isOnWhatsApp(branchId, LINE, job.phone);
        if (!onWa) {
          await markJob(job.id, "skipped", "الرقم ليس على واتساب");
          r.lastNote = "تخطّي رقم ليس على واتساب";
          continue; // التخطّي لا يستهلك من إيقاع الإرسال
        }
      }

      const res = await whatsapp.sendDirect(branchId, LINE, job.phone, String(job.body || ""), "followup", job.orderId ?? null);
      if (res.ok) {
        await markJob(job.id, "sent");
        r.inBatch++;
        r.lastNote = `أُرسلت إلى ${job.phone}`;
      } else if (res.skipped) {
        await markJob(job.id, "skipped", res.skipped);
        continue;
      } else {
        await markJob(job.id, "failed", res.error || "فشل غير معروف");
        r.lastNote = `فشل الإرسال: ${res.error || ""}`;
      }

      // أغلق الحملة إن لم يبقَ فيها شيء — استعلامان منفصلان لأن MySQL يمنع
      // القراءة من نفس الجدول داخل UPDATE عليه
      if (job.campaignId) {
        const left = rowsOf(await d.execute(sql`SELECT COUNT(*) c FROM followup_jobs
          WHERE campaignId = ${job.campaignId} AND status IN ('pending','sending')`))[0];
        if (!Number(left?.c || 0)) {
          await d.execute(sql`UPDATE followup_campaigns SET status = 'done', finishedAt = NOW()
            WHERE id = ${job.campaignId} AND status = 'running'`);
        }
      }

      // 🛡 استراحة الدفعة: بعد كل batchSize رسالة ننتظر batchPauseMin دقيقة ثم نُكمل
      if (s.batchPauseMin > 0 && r.inBatch >= s.batchSize) {
        r.pausedUntil = Date.now() + s.batchPauseMin * 60_000;
        r.inBatch = 0;
        r.lastNote = `استراحة ${s.batchPauseMin} دقيقة بعد ${s.batchSize} رسائل`;
        break;
      }

      // 🛡 الفاصل الزمني بين الرسائل + عشوائية
      await sleep(rand(s.intervalSec, s.intervalSec + s.jitterSec) * 1000);
    }
  } finally {
    r.busy = false;
  }
}

/** نبضة دورية: تُشغّل عامل كل فرع مفعَّل. تُستدعى من cron كل دقيقة. */
export async function tick() {
  try {
    await ensureTables();
    const d = await db.getDb();
    if (!d) return;
    // تعافٍ: مهمة بقيت 'sending' لأكثر من 10 دقائق منذ حجزها تعني أن العملية
    // توقّفت أثناء الإرسال (نشر أو انهيار) — أعِدها إلى الانتظار كي لا تعلق أبداً.
    // المعيار claimedAt لا createdAt، وإلا أُعيدت مهمة قيد الإرسال الآن فتُرسل مرتين.
    await d.execute(sql`UPDATE followup_jobs SET status = 'pending'
      WHERE status = 'sending' AND claimedAt IS NOT NULL
        AND claimedAt < DATE_SUB(NOW(), INTERVAL 10 MINUTE)`);

    const rows = rowsOf(await d.execute(sql`SELECT branchId FROM followup_settings WHERE enabled = 1`));
    for (const row of rows) {
      const bid = Number(row.branchId);
      if (bid) kick(bid);
    }
  } catch (e: any) {
    console.warn("[followup] tick:", e?.message || e);
  }
}
