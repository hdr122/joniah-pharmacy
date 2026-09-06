/**
 * 🧠 تحليل الزبائن والمكالمات — نظام شركة Xenon للاتصالات
 * ==========================================================
 * يحلّل بـ Xenon AI كل محادثة واتساب وكل مكالمة مُفرَّغة (واتساب أو رصيد) ويستخرج:
 *   • الحالة المزاجية للزبون: فرحان / عادي / ضايج / منزعج
 *   • سبب ذلك من كلام الزبون نفسه (مع اقتباس إن أمكن)
 *   • ماذا يريد الزبون، وملخص قصير للمحادثة
 * النتائج تُخزَّن في customer_sentiment (صف لكل مكالمة، وصف لكل محادثة واتساب يُحدَّث
 * عند وصول رسائل جديدة) وتُعرض في صفحة «تحليل الزبائن» حسب الشخص ورقمه.
 * يعمل تلقائياً كل 10 دقائق للفروع المفعّل لها Xenon AI، ويمكن تشغيله يدوياً من الصفحة.
 * كل شيء هنا best-effort: فشل التحليل لا يؤثر على أي شيء آخر في النظام.
 */
import { sql } from "drizzle-orm";
import * as db from "./db";
import { getMessages } from "./whatsapp";

function rowsOf(r: any): any[] {
  if (!Array.isArray(r)) return r?.rows || [];
  if (r.length > 0 && Array.isArray(r[0])) return r[0];
  return r;
}
const lim = (n: number, max = 500) => sql.raw(String(Math.min(Math.max(Math.floor(n) || 1, 1), max)));

export type Mood = "happy" | "neutral" | "annoyed" | "angry";
const MOODS: Mood[] = ["happy", "neutral", "annoyed", "angry"];
export type Channel = "whatsapp_chat" | "whatsapp_call" | "cellular_call" | "call";

let tablesReady = false;
async function ensureTables() {
  if (tablesReady) return;
  const d = await db.getDb();
  if (!d) return;
  await d.execute(sql`CREATE TABLE IF NOT EXISTS customer_sentiment (
    id INT AUTO_INCREMENT PRIMARY KEY,
    branchId INT NOT NULL,
    refKey VARCHAR(80) NOT NULL,
    refType VARCHAR(12) NOT NULL,
    refId INT DEFAULT 0,
    phone VARCHAR(30) DEFAULT '',
    name VARCHAR(191) DEFAULT '',
    channel VARCHAR(20) DEFAULT 'call',
    mood VARCHAR(12) DEFAULT 'neutral',
    score INT DEFAULT 0,
    reason TEXT,
    wants TEXT,
    summary TEXT,
    lastMsgId INT DEFAULT 0,
    msgCount INT DEFAULT 0,
    sourceAt TIMESTAMP NULL,
    analyzedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY branch_ref (branchId, refKey),
    INDEX branch_phone (branchId, phone),
    INDEX branch_source (branchId, sourceAt)
  )`);
  try { await db.ensureCallRecordingsTable(); } catch {}
  tablesReady = true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Xenon AI
// ─────────────────────────────────────────────────────────────────────────────
type AiResult = { mood: Mood; score: number; reason: string; wants: string; summary: string; name: string };

export async function analyzeWithAi(cfg: { key: string; model: string }, kind: "chat" | "call", channelLabel: string,
  transcript: string, knownName: string, knownPhone: string): Promise<AiResult> {
  const model = (cfg.model && cfg.model !== "gemini-3.6-flash") ? cfg.model : "gemini-3.5-flash";
  const prompt = [
    `أنت محلل خدمة زبائن لمطعم/شركة توصيل في العراق. أمامك ${kind === "chat" ? "محادثة واتساب" : "تفريغ " + channelLabel} بين المطعم والزبون.`,
    "حدّد الحالة المزاجية للزبون كما تظهر من كلامه هو (وليس من كلام المطعم/الكاشير):",
    "- happy: فرحان / راضٍ / شاكر / يمدح.",
    "- neutral: عادي، طلب أو استفسار اعتيادي بلا مشاعر واضحة.",
    "- annoyed: ضايج / متضايق / غير راضٍ (تأخير، خطأ، نبرة انزعاج، تذمّر خفيف).",
    "- angry: منزعج جداً / غاضب / يشتكي بشدة / يهدد بعدم التعامل أو بالإبلاغ.",
    "اكتب «السبب» في جملة أو جملتين مستندة حرفياً إلى ما قاله الزبون، واقتبس عبارته بين علامتي تنصيص إن أمكن. إن لم يكن هناك سبب واضح فاكتب: لا يوجد سبب واضح — تعامل اعتيادي.",
    "اكتب «ماذا يريد» الزبون (طلب / شكوى / استفسار / إلغاء…) في سطر واحد، و«الملخص» في سطرين على الأكثر.",
    "لا تخترع أي معلومة غير موجودة في النص. لا تذكر أسماء غير مذكورة. أعِد JSON فقط بلا أي شرح بهذا الشكل بالضبط:",
    '{"mood":"happy|neutral|annoyed|angry","score":0,"reason":"","wants":"","summary":"","name":""}',
    "score: -2 غاضب جداً، -1 ضايج، 0 عادي، 1 راضٍ، 2 فرحان جداً. name: اسم الزبون إن ذُكر في النص وإلا فارغ.",
    knownName ? "اسم الزبون المعروف مسبقاً: " + knownName : "",
    knownPhone ? "رقم الزبون: " + knownPhone : "",
    "— النص —",
    transcript,
  ].filter(Boolean).join("\n");
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cfg.key}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, topP: 0.1, response_mime_type: "application/json" },
    }),
  });
  const txt = await res.text();
  if (!res.ok) { let msg = txt.slice(0, 200); try { msg = JSON.parse(txt).error?.message || msg; } catch {} throw new Error("Xenon AI: " + msg); }
  let data: any = {}; try { data = JSON.parse(txt); } catch {}
  const raw = String(data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "").trim();
  let j: any = {};
  try { j = JSON.parse(raw); } catch { const m = raw.match(/\{[\s\S]*\}/); if (m) { try { j = JSON.parse(m[0]); } catch {} } }
  let score = Number(j.score);
  if (!Number.isFinite(score)) score = 0;
  score = Math.max(-2, Math.min(2, Math.round(score)));
  let mood: Mood = MOODS.includes(j.mood) ? j.mood : (score <= -2 ? "angry" : score === -1 ? "annoyed" : score >= 1 ? "happy" : "neutral");
  // اتساق: الدرجة تتبع الحالة إن تعارضتا
  if (mood === "angry" && score > -1) score = -2;
  if (mood === "annoyed" && score >= 0) score = -1;
  if (mood === "happy" && score < 1) score = 1;
  if (mood === "neutral") score = 0;
  const s = (v: any, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
  return { mood, score, reason: s(j.reason, 1000), wants: s(j.wants, 500), summary: s(j.summary, 1500), name: s(j.name, 120) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pending items (مكالمات لم تُحلَّل، محادثات وصلتها رسائل جديدة)
// ─────────────────────────────────────────────────────────────────────────────
const looksLikeFilename = (v: string) => /\d{6,}/.test(v) || /\.(amr|m4a|mp3|wav|ogg|opus|aac)$/i.test(v);

async function pendingRecordings(branchId: number, max: number) {
  const d = await db.getDb();
  if (!d) return [];
  return rowsOf(await d.execute(sql`
    SELECT r.id, r.phone, r.callerName, r.customerName, r.transcript, r.source, r.callType, r.createdAt
    FROM call_recordings r
    LEFT JOIN customer_sentiment s ON s.branchId = r.branchId AND s.refKey = CONCAT('rec:', r.id)
    WHERE r.branchId = ${branchId} AND s.id IS NULL AND r.transcript IS NOT NULL AND CHAR_LENGTH(r.transcript) > 15
    ORDER BY r.id DESC LIMIT ${lim(max)}`));
}

async function pendingChats(branchId: number, max: number) {
  const d = await db.getDb();
  if (!d) return [];
  try {
    return rowsOf(await d.execute(sql`
      SELECT c.phone, c.name, c.lastAt,
        (SELECT MAX(m.id) FROM whatsapp_messages m WHERE m.branchId = c.branchId AND m.phone = c.phone) AS maxId,
        COALESCE(s.lastMsgId, 0) AS doneId
      FROM whatsapp_conversations c
      LEFT JOIN customer_sentiment s ON s.branchId = c.branchId AND s.refKey = CONCAT('chat:', c.phone)
      WHERE c.branchId = ${branchId}
      HAVING maxId > doneId
      ORDER BY c.lastAt DESC LIMIT ${lim(max)}`));
  } catch { return []; } // جداول واتساب غير موجودة بعد
}

export async function pendingCount(branchId: number) {
  await ensureTables();
  const [r, c] = await Promise.all([pendingRecordings(branchId, 500), pendingChats(branchId, 500)]);
  return { recordings: r.length, chats: c.length, total: r.length + c.length };
}

async function analyzeRecording(branchId: number, cfg: { key: string; model: string }, r: any) {
  const d = await db.getDb();
  if (!d) return;
  const callType = String(r.callType || "").toLowerCase();
  const channel: Channel = callType === "whatsapp" ? "whatsapp_call" : callType === "cellular" ? "cellular_call" : "call";
  const chLabel = channel === "whatsapp_call" ? "مكالمة واتساب" : channel === "cellular_call" ? "مكالمة هاتف (رصيد)" : "مكالمة";
  const known = String(r.customerName || "").trim() || (looksLikeFilename(String(r.callerName || "")) ? "" : String(r.callerName || "").trim());
  const ai = await analyzeWithAi(cfg, "call", chLabel, String(r.transcript || "").slice(0, 12000), known, String(r.phone || ""));
  const name = known || ai.name || "";
  await d.execute(sql`INSERT INTO customer_sentiment
      (branchId, refKey, refType, refId, phone, name, channel, mood, score, reason, wants, summary, lastMsgId, msgCount, sourceAt, analyzedAt)
    VALUES (${branchId}, ${"rec:" + r.id}, 'recording', ${Number(r.id)}, ${String(r.phone || "")}, ${name}, ${channel},
      ${ai.mood}, ${ai.score}, ${ai.reason}, ${ai.wants}, ${ai.summary}, 0, 0, ${r.createdAt || null}, NOW())
    ON DUPLICATE KEY UPDATE name = VALUES(name), channel = VALUES(channel), mood = VALUES(mood), score = VALUES(score),
      reason = VALUES(reason), wants = VALUES(wants), summary = VALUES(summary), analyzedAt = NOW()`);
}

async function analyzeChat(branchId: number, cfg: { key: string; model: string }, c: any) {
  const d = await db.getDb();
  if (!d) return;
  const msgs = await getMessages(branchId, String(c.phone), 60);
  if (!msgs.length) return;
  const transcript = msgs.map((m: any) => `${Number(m.fromMe) ? "المطعم" : "الزبون"}: ${String(m.text || "").replace(/\s+/g, " ").slice(0, 400)}`).join("\n");
  const known = String(c.name || "").trim();
  const ai = await analyzeWithAi(cfg, "chat", "محادثة واتساب", transcript, known, String(c.phone));
  const lastId = Math.max(...msgs.map((m: any) => Number(m.id) || 0), Number(c.maxId) || 0);
  await d.execute(sql`INSERT INTO customer_sentiment
      (branchId, refKey, refType, refId, phone, name, channel, mood, score, reason, wants, summary, lastMsgId, msgCount, sourceAt, analyzedAt)
    VALUES (${branchId}, ${"chat:" + c.phone}, 'chat', 0, ${String(c.phone)}, ${known || ai.name || ""}, 'whatsapp_chat',
      ${ai.mood}, ${ai.score}, ${ai.reason}, ${ai.wants}, ${ai.summary}, ${lastId}, ${msgs.length}, ${c.lastAt || null}, NOW())
    ON DUPLICATE KEY UPDATE name = VALUES(name), mood = VALUES(mood), score = VALUES(score), reason = VALUES(reason),
      wants = VALUES(wants), summary = VALUES(summary), lastMsgId = VALUES(lastMsgId), msgCount = VALUES(msgCount),
      sourceAt = VALUES(sourceAt), analyzedAt = NOW()`);
}

const inFlight = new Set<number>();
/** حلّل ما ينتظر التحليل لهذا الفرع (بحد أقصى max عنصراً لكل تشغيل حمايةً لحصة الـAPI). */
export async function analyzePending(branchId: number, max = 12) {
  await ensureTables();
  const cfg = await db.getXenonAiForBranch(branchId);
  if (!cfg.enabled || !cfg.key) throw new Error("Xenon AI غير مفعّل لهذا الفرع — فعّله من لوحة المطوّر");
  if (inFlight.has(branchId)) return { analyzed: 0, failed: 0, remaining: (await pendingCount(branchId)).total, busy: true };
  inFlight.add(branchId);
  let analyzed = 0, failed = 0; let lastError = "";
  try {
    const half = Math.max(1, Math.ceil(max / 2));
    const [recs, chats] = await Promise.all([pendingRecordings(branchId, half), pendingChats(branchId, half)]);
    for (const r of recs) {
      try { await analyzeRecording(branchId, cfg, r); analyzed++; } catch (e: any) { failed++; lastError = e?.message || String(e); console.warn("[sentiment] rec", r.id, lastError); }
    }
    for (const c of chats) {
      try { await analyzeChat(branchId, cfg, c); analyzed++; } catch (e: any) { failed++; lastError = e?.message || String(e); console.warn("[sentiment] chat", c.phone, lastError); }
    }
  } finally { inFlight.delete(branchId); }
  const remaining = (await pendingCount(branchId)).total;
  return { analyzed, failed, remaining, error: failed && !analyzed ? lastError : "" };
}

/** إعادة تحليل عنصر واحد (زر «إعادة التحليل»). */
export async function reanalyze(branchId: number, refKey: string) {
  await ensureTables();
  const d = await db.getDb();
  if (!d) throw new Error("Database not available");
  const cfg = await db.getXenonAiForBranch(branchId);
  if (!cfg.enabled || !cfg.key) throw new Error("Xenon AI غير مفعّل لهذا الفرع — فعّله من لوحة المطوّر");
  if (refKey.startsWith("rec:")) {
    const id = Number(refKey.slice(4));
    const r = rowsOf(await d.execute(sql`SELECT * FROM call_recordings WHERE branchId = ${branchId} AND id = ${id} LIMIT 1`))[0];
    if (!r) throw new Error("المكالمة غير موجودة");
    await analyzeRecording(branchId, cfg, r);
  } else if (refKey.startsWith("chat:")) {
    const phone = refKey.slice(5);
    const c = rowsOf(await d.execute(sql`SELECT * FROM whatsapp_conversations WHERE branchId = ${branchId} AND phone = ${phone} LIMIT 1`))[0];
    if (!c) throw new Error("المحادثة غير موجودة");
    await analyzeChat(branchId, cfg, c);
  } else throw new Error("مرجع غير صالح");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Listing
// ─────────────────────────────────────────────────────────────────────────────
export type ListFilters = { mood?: string; channel?: string; q?: string; from?: string; to?: string; limit?: number };
export async function list(branchId: number, f: ListFilters = {}) {
  await ensureTables();
  const d = await db.getDb();
  if (!d) return { rows: [], stats: { happy: 0, neutral: 0, annoyed: 0, angry: 0, total: 0 }, pending: { recordings: 0, chats: 0, total: 0 } };
  const conds: any[] = [sql`branchId = ${branchId}`];
  if (f.mood && MOODS.includes(f.mood as Mood)) conds.push(sql`mood = ${f.mood}`);
  if (f.channel) conds.push(sql`channel = ${f.channel}`);
  if (f.q && f.q.trim()) {
    const like = `%${f.q.trim()}%`;
    conds.push(sql`(phone LIKE ${like} OR name LIKE ${like} OR reason LIKE ${like} OR summary LIKE ${like} OR wants LIKE ${like})`);
  }
  if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) conds.push(sql`sourceAt >= ${f.from + " 00:00:00"}`);
  if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) conds.push(sql`sourceAt <= ${f.to + " 23:59:59"}`);
  const where = sql.join(conds, sql` AND `);
  const rows = rowsOf(await d.execute(sql`SELECT * FROM customer_sentiment WHERE ${where} ORDER BY sourceAt DESC, id DESC LIMIT ${lim(f.limit || 400, 1000)}`));
  const st = rowsOf(await d.execute(sql`SELECT mood, COUNT(*) c FROM customer_sentiment WHERE branchId = ${branchId} GROUP BY mood`));
  const stats: any = { happy: 0, neutral: 0, annoyed: 0, angry: 0, total: 0 };
  for (const r of st) { stats[r.mood] = Number(r.c || 0); stats.total += Number(r.c || 0); }
  const pending = await pendingCount(branchId);
  return { rows, stats, pending };
}

/** تفاصيل عنصر: المحادثة كاملة أو تفريغ المكالمة (مع hasAudio للتشغيل). */
export async function detail(branchId: number, refKey: string) {
  await ensureTables();
  const d = await db.getDb();
  if (!d) throw new Error("Database not available");
  const row = rowsOf(await d.execute(sql`SELECT * FROM customer_sentiment WHERE branchId = ${branchId} AND refKey = ${refKey} LIMIT 1`))[0] || null;
  if (refKey.startsWith("chat:")) {
    const phone = refKey.slice(5);
    const messages = await getMessages(branchId, phone, 300);
    return { kind: "chat" as const, row, messages };
  }
  if (refKey.startsWith("rec:")) {
    const id = Number(refKey.slice(4));
    const rec = rowsOf(await d.execute(sql`SELECT id, phone, callerName, customerName, area, address, items, notes, transcript, source, callType, createdAt
      FROM call_recordings WHERE branchId = ${branchId} AND id = ${id} LIMIT 1`))[0] || null;
    let hasAudio = false;
    try { hasAudio = rowsOf(await d.execute(sql`SELECT 1 x FROM call_recording_audio WHERE branchId = ${branchId} AND recordingId = ${id} LIMIT 1`)).length > 0; } catch {}
    return { kind: "recording" as const, row, recording: rec, hasAudio };
  }
  throw new Error("مرجع غير صالح");
}

// ─────────────────────────────────────────────────────────────────────────────
// Scheduler — كل 10 دقائق لكل فرع مفعّل له Xenon AI
// ─────────────────────────────────────────────────────────────────────────────
let timer: NodeJS.Timeout | null = null;
let running = false;
export function startScheduler(intervalMs = 10 * 60 * 1000) {
  if (timer) return;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const d = await db.getDb();
      if (!d) return;
      await ensureTables();
      const branches = new Set<number>();
      try { rowsOf(await d.execute(sql`SELECT DISTINCT branchId FROM call_recordings`)).forEach((r: any) => branches.add(Number(r.branchId))); } catch {}
      try { rowsOf(await d.execute(sql`SELECT DISTINCT branchId FROM whatsapp_conversations`)).forEach((r: any) => branches.add(Number(r.branchId))); } catch {}
      for (const b of Array.from(branches)) {
        if (!b) continue;
        try {
          const cfg = await db.getXenonAiForBranch(b);
          if (!cfg.enabled || !cfg.key) continue;
          const r = await analyzePending(b, 8);
          if (r.analyzed) console.log(`[sentiment] branch ${b}: analyzed ${r.analyzed}, remaining ${r.remaining}`);
        } catch (e: any) { console.warn("[sentiment] branch", b, e?.message || e); }
      }
    } catch (e: any) { console.warn("[sentiment] tick:", e?.message || e); }
    finally { running = false; }
  };
  timer = setInterval(() => { tick().catch(() => {}); }, intervalMs);
  setTimeout(() => { tick().catch(() => {}); }, 25_000);
}
