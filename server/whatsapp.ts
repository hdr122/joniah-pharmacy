/**
 * WhatsApp integration (per branch) — ربط واتساب الفرع بالباركود/رمز الربط
 * ==========================================================================
 * Uses the WhatsApp Web multi-device protocol (Baileys). Each branch links its own
 * number; the session (creds + signal keys) is persisted in MySQL so a Railway
 * redeploy does NOT force a re-scan.
 *
 * Notifications:
 *   • courier  — when an order is created for / transferred to a delivery person.
 *   • customer — when an order is created for a customer with a phone number.
 * Both are toggles with editable templates ({order} {name} {phone} {area}
 * {address} {items} {total} {note} {driver} {driverPhone} {branch} {ratingLink}).
 *
 * 🛡 نظام Xenon للحماية (anti-ban, fully configurable, can be disabled):
 *   random delay between messages, per-minute cap, daily total cap, daily cap per
 *   customer, no-repeat cooldown per customer, and "is this number on WhatsApp?"
 *   check before messaging a customer. Every decision is written to whatsapp_log.
 *
 * Everything here is best-effort: a WhatsApp failure must never break an order.
 */
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  initAuthCreds,
  BufferJSON,
  proto,
  type AuthenticationCreds,
  type SignalDataTypeMap,
  type WASocket,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import pino from "pino";
import { sql } from "drizzle-orm";
import * as db from "./db";
import { xenonAiError } from "./_core/aiError";

// 📞 خطوط الواتساب لكل فرع:
//   main     — الرقم الأساسي: إشعارات الطلبات للمندوب والزبون وصندوق الرسائل.
//   followup — رقم قسم المتابعة: رسائل المتابعة بعد الطلب والحملات، بصندوق رسائل منفصل.
// كل خط جلسة Baileys مستقلة تماماً (رقم مختلف، باركود مختلف).
export type WaLine = "main" | "followup";
export const WA_LINES: WaLine[] = ["main", "followup"];
export function asLine(v: unknown): WaLine {
  return v === "followup" ? "followup" : "main";
}

// اسم المستخدم (pushName) الظاهر لكل jid — يُملأ من الرسائل ويُستعمل مع المكالمات.
// المفتاح: `${branchId}:${line}:${jid}`.
const pushNameCache = new Map<string, string>();
// الرقم المحلي المخزّن للزبائن (07…) من رقم الواتساب الدولي (964…).
function waLocalPhone(intlOrJidNumber: string): string {
  const n = String(intlOrJidNumber || "").replace(/@.*/, "");
  return n.startsWith("964") ? "0" + n.slice(3) : n;
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage (runtime CREATE TABLE IF NOT EXISTS — no db:push needed)
// ─────────────────────────────────────────────────────────────────────────────
function rowsOf(r: any): any[] {
  if (!Array.isArray(r)) return r?.rows || [];
  if (r.length > 0 && Array.isArray(r[0])) return r[0];
  return r;
}
const nowSql = () => {
  const d = new Date(Date.now() + 3 * 60 * 60 * 1000); // Iraq (GMT+3) like the rest of the app
  return d.toISOString().slice(0, 19).replace("T", " ");
};

let tablesReady = false;
async function ensureTables() {
  if (tablesReady) return;
  const d = await db.getDb();
  if (!d) return;
  await d.execute(sql`CREATE TABLE IF NOT EXISTS whatsapp_auth (
    branchId INT NOT NULL,
    line VARCHAR(16) NOT NULL DEFAULT 'main',
    k VARCHAR(191) NOT NULL,
    v LONGTEXT,
    PRIMARY KEY (branchId, line, k)
  )`);
  await d.execute(sql`CREATE TABLE IF NOT EXISTS whatsapp_settings (
    branchId INT PRIMARY KEY,
    enabled TINYINT DEFAULT 0,
    notifyCourier TINYINT DEFAULT 1,
    notifyCustomer TINYINT DEFAULT 1,
    courierTemplate TEXT,
    customerTemplate TEXT,
    protectionEnabled TINYINT DEFAULT 1,
    minDelaySec INT DEFAULT 3,
    maxDelaySec INT DEFAULT 8,
    maxPerMinute INT DEFAULT 8,
    dailyCapTotal INT DEFAULT 300,
    dailyCapPerCustomer INT DEFAULT 3,
    customerCooldownMin INT DEFAULT 2,
    checkOnWhatsApp TINYINT DEFAULT 1,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);
  await d.execute(sql`CREATE TABLE IF NOT EXISTS whatsapp_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    branchId INT NOT NULL,
    line VARCHAR(16) NOT NULL DEFAULT 'main',
    kind VARCHAR(20) NOT NULL,
    toPhone VARCHAR(30) DEFAULT '',
    orderId INT NULL,
    status VARCHAR(20) NOT NULL,
    error TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX branch_created (branchId, createdAt),
    INDEX branch_phone (branchId, toPhone)
  )`);
  // صندوق رسائل الزبائن: كل رسالة واردة/صادرة على رقم الفرع + ملخص ذكي لكل محادثة
  await d.execute(sql`CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    branchId INT NOT NULL,
    line VARCHAR(16) NOT NULL DEFAULT 'main',
    phone VARCHAR(30) NOT NULL,
    fromMe TINYINT DEFAULT 0,
    text TEXT,
    pushName VARCHAR(191) DEFAULT '',
    waId VARCHAR(191) DEFAULT '',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX branch_phone (branchId, phone),
    INDEX branch_created (branchId, createdAt)
  )`);
  await d.execute(sql`CREATE TABLE IF NOT EXISTS whatsapp_conversations (
    branchId INT NOT NULL,
    line VARCHAR(16) NOT NULL DEFAULT 'main',
    phone VARCHAR(30) NOT NULL,
    name VARCHAR(191) DEFAULT '',
    lastText TEXT,
    lastAt TIMESTAMP NULL,
    unread INT DEFAULT 0,
    summary TEXT,
    summaryAt TIMESTAMP NULL,
    summaryDirty TINYINT DEFAULT 1,
    PRIMARY KEY (branchId, line, phone)
  )`);

  // ترحيل الجداول المُنشأة قبل إضافة الخطوط — كل عبارة مستقلة ويُتجاهل خطؤها
  // إن كانت مطبّقة سلفاً (MySQL لا يدعم ADD COLUMN IF NOT EXISTS).
  const tryExec = async (q: any) => { try { await d.execute(q); } catch (_) { /* مطبّق سلفاً */ } };
  await tryExec(sql`ALTER TABLE whatsapp_auth ADD COLUMN line VARCHAR(16) NOT NULL DEFAULT 'main'`);
  await tryExec(sql`ALTER TABLE whatsapp_log ADD COLUMN line VARCHAR(16) NOT NULL DEFAULT 'main'`);
  await tryExec(sql`ALTER TABLE whatsapp_messages ADD COLUMN line VARCHAR(16) NOT NULL DEFAULT 'main'`);
  await tryExec(sql`ALTER TABLE whatsapp_conversations ADD COLUMN line VARCHAR(16) NOT NULL DEFAULT 'main'`);

  // المفاتيح الأوّلية المركّبة.
  // ⚠️ `drizzle-kit push` (يعمل عند كل نشر) يُسقط هذه المفاتيح لأن MySQL يسمّي
  // المفتاح الأوّلي PRIMARY دائماً بينما schema.ts يسمّيه باسم آخر. وبلا مفتاح
  // أوّلي تتوقّف ON DUPLICATE KEY UPDATE عن العمل فتتكرّر صفوف جلسة الواتساب
  // وتفسد. لذلك نتحقّق من المفتاح ونُعيد بناءه عند كل إقلاع.
  await ensurePrimaryKey(d, "whatsapp_auth", ["branchId", "line", "k"]);
  await ensurePrimaryKey(d, "whatsapp_conversations", ["branchId", "line", "phone"]);

  tablesReady = true;
}

/** يضمن أن المفتاح الأوّلي للجدول هو الأعمدة المطلوبة بالضبط — يُصلحه إن نقص أو اختلف. */
async function ensurePrimaryKey(d: any, table: string, cols: string[]) {
  try {
    const cur = rowsOf(await d.execute(sql.raw(`SHOW KEYS FROM \`${table}\` WHERE Key_name = 'PRIMARY'`)))
      .sort((a: any, b: any) => Number(a.Seq_in_index) - Number(b.Seq_in_index))
      .map((r: any) => String(r.Column_name));
    if (cur.length === cols.length && cur.every((c, i) => c === cols[i])) return; // سليم

    const keyCols = cols.map((c) => `\`${c}\``).join(", ");
    if (cur.length) {
      try { await d.execute(sql.raw(`ALTER TABLE \`${table}\` DROP PRIMARY KEY`)); } catch (_) { /* لا مفتاح */ }
    }
    try {
      await d.execute(sql.raw(`ALTER TABLE \`${table}\` ADD PRIMARY KEY (${keyCols})`));
    } catch (_) {
      // الفشل هنا سببه عملياً واحد: صفوف مكرّرة تسلّلت أثناء غياب المفتاح
      // (ON DUPLICATE KEY UPDATE تتحوّل إلى INSERT عادي بلا مفتاح). لا نفحص نص
      // الخطأ لأن drizzle يستبدله بنصّ الاستعلام، فنمضي مباشرةً إلى إعادة البناء.
      console.warn(`[whatsapp] صفوف مكرّرة في ${table} — يُعاد بناؤه`);

      // الأعمدة غير المفتاحية تُحدَّث من الصف اللاحق، فيبقى الأحدث لا الأقدم.
      // هذا حاسم لمفاتيح جلسة الواتساب: الاحتفاظ بأقدم creds يُفقد الجلسة.
      const allCols = rowsOf(await d.execute(sql.raw(`SHOW COLUMNS FROM \`${table}\``)))
        .map((r: any) => String(r.Field));
      const dataCols = allCols.filter((c) => !cols.includes(c));
      const onDup = dataCols.length
        ? ` ON DUPLICATE KEY UPDATE ${dataCols.map((c) => `\`${c}\` = VALUES(\`${c}\`)`).join(", ")}`
        : "";

      await d.execute(sql.raw(`DROP TABLE IF EXISTS \`${table}__dedup\``));
      await d.execute(sql.raw(`CREATE TABLE \`${table}__dedup\` LIKE \`${table}\``));
      await d.execute(sql.raw(`ALTER TABLE \`${table}__dedup\` ADD PRIMARY KEY (${keyCols})`));
      await d.execute(sql.raw(`INSERT INTO \`${table}__dedup\` SELECT * FROM \`${table}\`${onDup}`));
      await d.execute(sql.raw(`DROP TABLE \`${table}\``));
      await d.execute(sql.raw(`RENAME TABLE \`${table}__dedup\` TO \`${table}\``));
    }
    console.log(`[whatsapp] أُعيد بناء المفتاح الأوّلي لـ ${table} (${cols.join(", ")})`);
  } catch (e: any) {
    console.warn(`[whatsapp] تعذّر ضبط المفتاح الأوّلي لـ ${table}:`, e?.message || e);
  }
}

export const DEFAULT_COURIER_TEMPLATE =
  "🛵 طلب جديد #{order}\n👤 الزبون: {name}\n📞 {phone}\n🗺 المنطقة: {area}\n📍 العنوان: {address}\n🍔 الطلب:\n{items}\n💵 المبلغ: {total} د.ع\n📝 {note}\n— {branch}";
export const DEFAULT_CUSTOMER_TEMPLATE =
  "مرحباً {name} 👋\nتم استلام طلبك رقم #{order} من {branch}.\n🍔 الطلب:\n{items}\n💵 الإجمالي: {total} د.ع\n🛵 المندوب: {driver} {driverPhone}\nشكراً لاختيارك لنا 🌹{ratingLink}";

export type WaSettings = {
  enabled: boolean; notifyCourier: boolean; notifyCustomer: boolean;
  courierTemplate: string; customerTemplate: string;
  protectionEnabled: boolean; minDelaySec: number; maxDelaySec: number; maxPerMinute: number;
  dailyCapTotal: number; dailyCapPerCustomer: number; customerCooldownMin: number; checkOnWhatsApp: boolean;
};
const DEFAULT_SETTINGS: WaSettings = {
  enabled: false, notifyCourier: true, notifyCustomer: true,
  courierTemplate: DEFAULT_COURIER_TEMPLATE, customerTemplate: DEFAULT_CUSTOMER_TEMPLATE,
  protectionEnabled: true, minDelaySec: 3, maxDelaySec: 8, maxPerMinute: 8,
  dailyCapTotal: 300, dailyCapPerCustomer: 3, customerCooldownMin: 2, checkOnWhatsApp: true,
};

export async function getSettings(branchId: number): Promise<WaSettings> {
  await ensureTables();
  const d = await db.getDb();
  if (!d) return { ...DEFAULT_SETTINGS };
  const row = rowsOf(await d.execute(sql`SELECT * FROM whatsapp_settings WHERE branchId = ${branchId} LIMIT 1`))[0];
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    enabled: !!Number(row.enabled), notifyCourier: !!Number(row.notifyCourier), notifyCustomer: !!Number(row.notifyCustomer),
    courierTemplate: row.courierTemplate || DEFAULT_COURIER_TEMPLATE,
    customerTemplate: row.customerTemplate || DEFAULT_CUSTOMER_TEMPLATE,
    protectionEnabled: !!Number(row.protectionEnabled),
    minDelaySec: Number(row.minDelaySec ?? 3), maxDelaySec: Number(row.maxDelaySec ?? 8), maxPerMinute: Number(row.maxPerMinute ?? 8),
    dailyCapTotal: Number(row.dailyCapTotal ?? 300), dailyCapPerCustomer: Number(row.dailyCapPerCustomer ?? 3),
    customerCooldownMin: Number(row.customerCooldownMin ?? 2), checkOnWhatsApp: !!Number(row.checkOnWhatsApp),
  };
}

export async function saveSettings(branchId: number, s: Partial<WaSettings>) {
  await ensureTables();
  const d = await db.getDb();
  if (!d) throw new Error("Database not available");
  const cur = await getSettings(branchId);
  const n: WaSettings = { ...cur, ...s };
  // sanity bounds
  n.minDelaySec = Math.max(0, Math.min(120, Math.round(n.minDelaySec)));
  n.maxDelaySec = Math.max(n.minDelaySec, Math.min(300, Math.round(n.maxDelaySec)));
  n.maxPerMinute = Math.max(1, Math.min(60, Math.round(n.maxPerMinute)));
  n.dailyCapTotal = Math.max(1, Math.min(10000, Math.round(n.dailyCapTotal)));
  n.dailyCapPerCustomer = Math.max(1, Math.min(50, Math.round(n.dailyCapPerCustomer)));
  n.customerCooldownMin = Math.max(0, Math.min(1440, Math.round(n.customerCooldownMin)));
  await d.execute(sql`INSERT INTO whatsapp_settings
    (branchId, enabled, notifyCourier, notifyCustomer, courierTemplate, customerTemplate, protectionEnabled,
     minDelaySec, maxDelaySec, maxPerMinute, dailyCapTotal, dailyCapPerCustomer, customerCooldownMin, checkOnWhatsApp)
    VALUES (${branchId}, ${n.enabled ? 1 : 0}, ${n.notifyCourier ? 1 : 0}, ${n.notifyCustomer ? 1 : 0}, ${n.courierTemplate}, ${n.customerTemplate},
     ${n.protectionEnabled ? 1 : 0}, ${n.minDelaySec}, ${n.maxDelaySec}, ${n.maxPerMinute}, ${n.dailyCapTotal}, ${n.dailyCapPerCustomer},
     ${n.customerCooldownMin}, ${n.checkOnWhatsApp ? 1 : 0})
    ON DUPLICATE KEY UPDATE
     enabled=VALUES(enabled), notifyCourier=VALUES(notifyCourier), notifyCustomer=VALUES(notifyCustomer),
     courierTemplate=VALUES(courierTemplate), customerTemplate=VALUES(customerTemplate), protectionEnabled=VALUES(protectionEnabled),
     minDelaySec=VALUES(minDelaySec), maxDelaySec=VALUES(maxDelaySec), maxPerMinute=VALUES(maxPerMinute),
     dailyCapTotal=VALUES(dailyCapTotal), dailyCapPerCustomer=VALUES(dailyCapPerCustomer),
     customerCooldownMin=VALUES(customerCooldownMin), checkOnWhatsApp=VALUES(checkOnWhatsApp)`);
  return n;
}

async function logSend(branchId: number, line: WaLine, kind: string, toPhone: string, orderId: number | null, status: string, error = "") {
  try {
    await ensureTables();
    const d = await db.getDb();
    if (!d) return;
    await d.execute(sql`INSERT INTO whatsapp_log (branchId, line, kind, toPhone, orderId, status, error)
      VALUES (${branchId}, ${line}, ${kind}, ${toPhone}, ${orderId}, ${status}, ${error.slice(0, 500)})`);
  } catch (_) { /* logging is secondary */ }
}

export async function getLogs(branchId: number, limit = 100, line: WaLine = "main") {
  await ensureTables();
  const d = await db.getDb();
  if (!d) return [];
  return rowsOf(await d.execute(sql`SELECT * FROM whatsapp_log WHERE branchId = ${branchId} AND line = ${line} ORDER BY id DESC LIMIT ${sql.raw(String(Math.min(Math.max(limit, 1), 500)))}`));
}

export async function getTodayStats(branchId: number, line: WaLine = "main") {
  await ensureTables();
  const d = await db.getDb();
  if (!d) return { sent: 0, failed: 0, skipped: 0 };
  const row = rowsOf(await d.execute(sql`SELECT
      SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END) sent,
      SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) failed,
      SUM(CASE WHEN status='skipped' THEN 1 ELSE 0 END) skipped
    FROM whatsapp_log WHERE branchId = ${branchId} AND line = ${line} AND DATE(createdAt) = CURDATE()`))[0] || {};
  return { sent: Number(row.sent || 0), failed: Number(row.failed || 0), skipped: Number(row.skipped || 0) };
}

// ─────────────────────────────────────────────────────────────────────────────
// DB-backed Baileys auth state (mirrors useMultiFileAuthState, but in MySQL)
// ─────────────────────────────────────────────────────────────────────────────
async function authRead(branchId: number, line: WaLine, key: string): Promise<any | null> {
  const d = await db.getDb();
  if (!d) return null;
  const row = rowsOf(await d.execute(sql`SELECT v FROM whatsapp_auth WHERE branchId = ${branchId} AND line = ${line} AND k = ${key} LIMIT 1`))[0];
  if (!row || row.v == null) return null;
  try { return JSON.parse(row.v, BufferJSON.reviver); } catch { return null; }
}
async function authWrite(branchId: number, line: WaLine, key: string, value: any) {
  const d = await db.getDb();
  if (!d) return;
  const v = JSON.stringify(value, BufferJSON.replacer);
  await d.execute(sql`INSERT INTO whatsapp_auth (branchId, line, k, v) VALUES (${branchId}, ${line}, ${key}, ${v})
    ON DUPLICATE KEY UPDATE v = VALUES(v)`);
}
async function authDelete(branchId: number, line: WaLine, key: string) {
  const d = await db.getDb();
  if (!d) return;
  await d.execute(sql`DELETE FROM whatsapp_auth WHERE branchId = ${branchId} AND line = ${line} AND k = ${key}`);
}
export async function clearAuth(branchId: number, line: WaLine = "main") {
  await ensureTables();
  const d = await db.getDb();
  if (!d) return;
  await d.execute(sql`DELETE FROM whatsapp_auth WHERE branchId = ${branchId} AND line = ${line}`);
}
export async function hasSavedSession(branchId: number, line: WaLine = "main") {
  await ensureTables();
  const creds = await authRead(branchId, line, "creds");
  return !!(creds && creds.me?.id);
}

async function useDbAuthState(branchId: number, line: WaLine) {
  await ensureTables();
  const creds: AuthenticationCreds = (await authRead(branchId, line, "creds")) || initAuthCreds();
  const state = {
    creds,
    keys: {
      get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
        const data: { [id: string]: SignalDataTypeMap[T] } = {};
        await Promise.all(ids.map(async (id) => {
          let value = await authRead(branchId, line, `${type}-${id}`);
          if (type === "app-state-sync-key" && value) {
            value = proto.Message.AppStateSyncKeyData.fromObject(value);
          }
          if (value) data[id] = value;
        }));
        return data;
      },
      set: async (data: any) => {
        const tasks: Promise<void>[] = [];
        for (const category of Object.keys(data)) {
          for (const id of Object.keys(data[category])) {
            const value = data[category][id];
            const key = `${category}-${id}`;
            tasks.push(value ? authWrite(branchId, line, key, value) : authDelete(branchId, line, key));
          }
        }
        await Promise.all(tasks);
      },
    },
  };
  const saveCreds = () => authWrite(branchId, line, "creds", state.creds);
  return { state, saveCreds };
}

// ─────────────────────────────────────────────────────────────────────────────
// Connection manager (one socket per branch)
// ─────────────────────────────────────────────────────────────────────────────
type Conn = {
  sock: WASocket | null;
  status: "disconnected" | "connecting" | "qr" | "connected";
  qr: string | null;           // raw QR string
  qrDataUrl: string | null;    // PNG data URL for the UI
  pairingCode: string | null;
  me: string | null;           // linked number
  lastError: string | null;
  updatedAt: number;
  reconnectTimer: NodeJS.Timeout | null;
  wantOpen: boolean;           // user asked to be connected
  queue: Array<{ jid: string; text: string; kind: string; toPhone: string; orderId: number | null; resolve: (r: SendResult) => void }>;
  draining: boolean;
  sentTimestamps: number[];    // for per-minute cap
  onWaCache: Map<string, { ok: boolean; at: number }>;
};
type SendResult = { ok: boolean; skipped?: string; error?: string };

const conns = new Map<string, Conn>();
const logger = pino({ level: "silent" });
const connKey = (branchId: number, line: WaLine) => `${branchId}:${line}`;

function getConn(branchId: number, line: WaLine = "main"): Conn {
  const key = connKey(branchId, line);
  let c = conns.get(key);
  if (!c) {
    c = { sock: null, status: "disconnected", qr: null, qrDataUrl: null, pairingCode: null, me: null, lastError: null,
      updatedAt: Date.now(), reconnectTimer: null, wantOpen: false, queue: [], draining: false, sentTimestamps: [], onWaCache: new Map() };
    conns.set(key, c);
  }
  return c;
}

export function status(branchId: number, line: WaLine = "main") {
  const c = getConn(branchId, line);
  return {
    line, status: c.status, qrDataUrl: c.status === "qr" ? c.qrDataUrl : null, pairingCode: c.pairingCode,
    phone: c.me, lastError: c.lastError, updatedAt: c.updatedAt, queued: c.queue.length,
  };
}

export function isConnected(branchId: number, line: WaLine = "main") {
  return getConn(branchId, line).status === "connected";
}

export async function connect(branchId: number, line: WaLine = "main"): Promise<ReturnType<typeof status>> {
  const c = getConn(branchId, line);
  c.wantOpen = true;
  if (c.sock && (c.status === "connected" || c.status === "connecting" || c.status === "qr")) return status(branchId, line);
  await openSocket(branchId, line);
  return status(branchId, line);
}

async function openSocket(branchId: number, line: WaLine) {
  const c = getConn(branchId, line);
  if (c.reconnectTimer) { clearTimeout(c.reconnectTimer); c.reconnectTimer = null; }
  c.status = "connecting"; c.lastError = null; c.qr = null; c.qrDataUrl = null; c.pairingCode = null; c.updatedAt = Date.now();
  try {
    const { state, saveCreds } = await useDbAuthState(branchId, line);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined as any }));
    const sock = makeWASocket({
      version,
      auth: state,
      logger: logger as any,
      printQRInTerminal: false,
      browser: [line === "followup" ? "Xenon Follow-up" : "Xenon Delivery", "Chrome", "1.0.0"],
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
    });
    c.sock = sock;

    sock.ev.on("creds.update", saveCreds);
    // الرسائل الواردة من الزبائن (والصادرة من الهاتف نفسه) → صندوق الرسائل
    sock.ev.on("messages.upsert", async (u: any) => {
      try {
        if (u?.type && u.type !== "notify" && u.type !== "append") return;
        for (const m of (u?.messages || [])) {
          const jid: string = m?.key?.remoteJid || "";
          if (!jid.endsWith("@s.whatsapp.net")) continue; // تجاهل المجموعات والحالات
          const phone = jid.split("@")[0];
          // فُكّ الأغلفة الشائعة قبل القراءة، وإلا سقطت رسائل الزبائن صمتاً:
          // الرسائل المؤقتة/المختفية (ephemeral) تغلّف كل رسالة، وكذلك «مرة واحدة» والمستند-مع-تعليق.
          const raw: any = m?.message || {};
          const msg: any = raw.ephemeralMessage?.message
            || raw.viewOnceMessageV2?.message || raw.viewOnceMessageV2Extension?.message || raw.viewOnceMessage?.message
            || raw.documentWithCaptionMessage?.message
            || raw.deviceSentMessage?.message
            || raw;
          // موقع من الزبون (لقطة أو موقع مباشر) → أرفقه بطلبه النشط ليتنقّل إليه المندوب مباشرةً
          const locMsg = msg.locationMessage || msg.liveLocationMessage;
          // الموقع يُربط بالطلب من الخط الأساسي فقط — خط المتابعة لا يستقبل طلبات
          if (line === "main" && locMsg && !m?.key?.fromMe && locMsg.degreesLatitude != null && locMsg.degreesLongitude != null) {
            onCustomerLocation(branchId, phone, Number(locMsg.degreesLatitude), Number(locMsg.degreesLongitude))
              .catch((e: any) => console.warn("[whatsapp] location:", e?.message || e));
          }
          const text: string = msg.conversation || msg.extendedTextMessage?.text || msg.imageMessage?.caption || msg.videoMessage?.caption
            || (msg.imageMessage ? "[صورة]" : msg.audioMessage ? "[رسالة صوتية]" : msg.documentMessage ? "[ملف]" : msg.locationMessage ? "[موقع]" : msg.stickerMessage ? "[ملصق]" : msg.contactMessage ? "[جهة اتصال]" : msg.reactionMessage ? ("تفاعل " + (msg.reactionMessage.text || "")) : "");
          if (!text) continue; // إطارات تحكّم فارغة فقط تُتجاهَل الآن
          // خزّن اسم المستخدم الظاهر (pushName) لهذا الرقم + أثرِ سجل الزبون به
          if (!m?.key?.fromMe && m?.pushName) {
            pushNameCache.set(`${branchId}:${line}:${jid}`, m.pushName);
            db.setCustomerWhatsappUsername(waLocalPhone(phone), branchId, m.pushName).catch(() => {});
          }
          await storeMessage(branchId, phone, !!m?.key?.fromMe, text, m?.pushName || "", m?.key?.id || "", line);
        }
      } catch (e: any) { console.warn("[whatsapp] inbound:", e?.message || e); }
    });
    // مكالمات واتساب الواردة (Baileys) → التقط رقم/يوزر المتصل وأثرِ سجل الزبون.
    // الرقم الحقيقي يتوفّر فقط من jid بصيغة @s.whatsapp.net؛ المتصل المخفي (@lid) بلا رقم.
    sock.ev.on("call", async (calls: any[]) => {
      try {
        for (const call of (calls || [])) {
          if (call?.status && call.status !== "offer") continue;
          const from = String(call?.from || "");
          const pushName = pushNameCache.get(`${branchId}:${line}:${from}`) || "";
          if (!from.endsWith("@s.whatsapp.net")) { console.log("[whatsapp] call (hidden/@lid)", pushName || from); continue; }
          const local = waLocalPhone(from);
          if (pushName) db.setCustomerWhatsappUsername(local, branchId, pushName).catch(() => {});
          console.log("[whatsapp] call from", local, pushName ? `(${pushName})` : "");
        }
      } catch (e: any) { console.warn("[whatsapp] call:", e?.message || e); }
    });
    sock.ev.on("connection.update", async (u) => {
      const { connection, lastDisconnect, qr } = u;
      if (qr) {
        c.qr = qr; c.status = "qr"; c.updatedAt = Date.now();
        try { c.qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 320 }); } catch { c.qrDataUrl = null; }
      }
      if (connection === "open") {
        c.status = "connected"; c.qr = null; c.qrDataUrl = null; c.pairingCode = null; c.lastError = null; c.updatedAt = Date.now();
        c.me = (sock.user?.id || "").split(":")[0].split("@")[0] || null;
        console.log(`[whatsapp] branch ${branchId} (${line}) connected as ${c.me}`);
        drain(branchId, line).catch(() => {});
      }
      if (connection === "close") {
        const code = (lastDisconnect?.error as any)?.output?.statusCode;
        const loggedOut = code === DisconnectReason.loggedOut || code === 401;
        c.status = "disconnected"; c.sock = null; c.updatedAt = Date.now();
        c.lastError = loggedOut ? "تم تسجيل الخروج من الهاتف — أعد الربط" : `انقطع الاتصال (${code || "?"})`;
        console.log(`[whatsapp] branch ${branchId} (${line}) closed code=${code} loggedOut=${loggedOut}`);
        if (loggedOut) {
          await clearAuth(branchId, line).catch(() => {});
          c.me = null; c.wantOpen = false;
        } else if (c.wantOpen) {
          // transient → reconnect with backoff
          c.reconnectTimer = setTimeout(() => { openSocket(branchId, line).catch(() => {}); }, 4000);
        }
      }
    });
  } catch (e: any) {
    c.status = "disconnected"; c.sock = null; c.lastError = e?.message || String(e); c.updatedAt = Date.now();
    console.error(`[whatsapp] branch ${branchId} (${line}) open failed:`, e?.message || e);
  }
}

/** رمز ربط رقمي (بدل QR): يُدخله المستخدم في واتساب ← الأجهزة المرتبطة ← ربط برقم الهاتف */
export async function requestPairingCode(branchId: number, phone: string, line: WaLine = "main") {
  const c = getConn(branchId, line);
  c.wantOpen = true;
  if (!c.sock || c.status === "disconnected") await openSocket(branchId, line);
  const sock = c.sock;
  if (!sock) throw new Error("تعذر بدء الاتصال");
  const num = normalizePhone(phone);
  if (!num) throw new Error("رقم غير صحيح");
  // Baileys needs the socket to have started its handshake; small wait
  await new Promise(r => setTimeout(r, 1500));
  const code = await sock.requestPairingCode(num);
  c.pairingCode = code?.match(/.{1,4}/g)?.join("-") || code;
  c.updatedAt = Date.now();
  return c.pairingCode;
}

export async function logout(branchId: number, line: WaLine = "main") {
  const c = getConn(branchId, line);
  c.wantOpen = false;
  if (c.reconnectTimer) { clearTimeout(c.reconnectTimer); c.reconnectTimer = null; }
  try { await c.sock?.logout(); } catch (_) {}
  try { c.sock?.end(undefined as any); } catch (_) {}
  c.sock = null; c.status = "disconnected"; c.qr = null; c.qrDataUrl = null; c.pairingCode = null; c.me = null; c.updatedAt = Date.now();
  await clearAuth(branchId, line).catch(() => {});
}

/** On server boot: reconnect every branch that has a saved session and the feature enabled. */
export async function init() {
  try {
    await ensureTables();
    const d = await db.getDb();
    if (!d) return;
    // الخط الأساسي: يُستعاد متى كانت إشعارات الواتساب مفعّلة للفرع.
    // خط المتابعة: يُستعاد متى كان قسم المتابعة مفعّلاً (جدوله قد لا يكون موجوداً بعد).
    const rows = rowsOf(await d.execute(sql`SELECT a.branchId FROM whatsapp_auth a
      JOIN whatsapp_settings s ON s.branchId = a.branchId AND s.enabled = 1
      WHERE a.k = 'creds' AND a.line = 'main'`));
    let followups: any[] = [];
    try {
      followups = rowsOf(await d.execute(sql`SELECT a.branchId FROM whatsapp_auth a
        JOIN followup_settings f ON f.branchId = a.branchId AND f.enabled = 1
        WHERE a.k = 'creds' AND a.line = 'followup'`));
    } catch (_) { /* قسم المتابعة لم يُهيّأ بعد */ }

    const targets: Array<{ bid: number; line: WaLine }> = [
      ...rows.map((r: any) => ({ bid: Number(r.branchId), line: "main" as WaLine })),
      ...followups.map((r: any) => ({ bid: Number(r.branchId), line: "followup" as WaLine })),
    ];
    for (const t of targets) {
      if (!t.bid) continue;
      getConn(t.bid, t.line).wantOpen = true;
      openSocket(t.bid, t.line).catch(() => {});
      await new Promise(res => setTimeout(res, 1500)); // stagger
    }
    if (targets.length) console.log(`[whatsapp] restoring ${targets.length} session(s)`);
  } catch (e: any) {
    console.warn("[whatsapp] init failed:", e?.message || e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sending + 🛡 نظام Xenon للحماية
// ─────────────────────────────────────────────────────────────────────────────
export function normalizePhone(raw: string): string {
  let d = String(raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("07")) d = "964" + d.slice(1);     // Iraq local → intl
  else if (d.length === 10 && d.startsWith("7")) d = "964" + d;
  return d.length >= 10 ? d : "";
}
const jidOf = (num: string) => `${num}@s.whatsapp.net`;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export async function countToday(branchId: number, line: WaLine = "main", kind?: string, toPhone?: string): Promise<number> {
  const d = await db.getDb();
  if (!d) return 0;
  const row = rowsOf(await d.execute(sql`SELECT COUNT(*) c FROM whatsapp_log
    WHERE branchId = ${branchId} AND line = ${line} AND status = 'sent' AND DATE(createdAt) = CURDATE()
    ${kind ? sql`AND kind = ${kind}` : sql``} ${toPhone ? sql`AND toPhone = ${toPhone}` : sql``}`))[0];
  return Number(row?.c || 0);
}
async function lastSentMinutesAgo(branchId: number, line: WaLine, toPhone: string): Promise<number | null> {
  const d = await db.getDb();
  if (!d) return null;
  const row = rowsOf(await d.execute(sql`SELECT TIMESTAMPDIFF(MINUTE, MAX(createdAt), NOW()) m FROM whatsapp_log
    WHERE branchId = ${branchId} AND line = ${line} AND toPhone = ${toPhone} AND status = 'sent'`))[0];
  return row?.m == null ? null : Number(row.m);
}

// ── توقيع Xenon ─────────────────────────────────────────────────────────────
// يُذيَّل كل رسالة واتساب بتوقيع شركة Xenon. يُحرَّر من لوحة مطوّر الموقع فقط
// (site_settings.whatsapp_footer)؛ صاحب الفرع لا يستطيع تعديله أو حذفه.
export const DEFAULT_FOOTER = "— نظام شركة Xenon 🛡";
export async function getFooter(): Promise<string> {
  try {
    const v = (await db.getSiteSettingValue("whatsapp_footer")).trim();
    return v || DEFAULT_FOOTER;
  } catch { return DEFAULT_FOOTER; }
}
export async function setFooter(text: string) {
  await db.updateSiteSetting("whatsapp_footer", String(text || "").trim() || DEFAULT_FOOTER);
  return getFooter();
}
export async function withFooter(text: string): Promise<string> {
  const f = await getFooter();
  const body = String(text || "").trim();
  return body ? `${body}\n\n${f}` : f;
}

export type SendKind = "courier" | "customer" | "promo" | "reply" | "test" | "followup";

/** Queue a text message (Xenon footer appended automatically). Resolves with the outcome (never throws). */
export function send(branchId: number, phone: string, text: string, kind: SendKind, orderId: number | null = null, line: WaLine = "main"): Promise<SendResult> {
  return new Promise<SendResult>((resolve) => {
    const c = getConn(branchId, line);
    const num = normalizePhone(phone);
    if (!num) { logSend(branchId, line, kind, phone, orderId, "skipped", "رقم غير صالح"); return resolve({ ok: false, skipped: "رقم غير صالح" }); }
    withFooter(text).then((full) => {
      c.queue.push({ jid: jidOf(num), text: full, kind, toPhone: num, orderId, resolve });
      drain(branchId, line).catch(() => {});
    }).catch(() => {
      c.queue.push({ jid: jidOf(num), text, kind, toPhone: num, orderId, resolve });
      drain(branchId, line).catch(() => {});
    });
  });
}

/** هل هذا الرقم على واتساب؟ (مُخزَّن 24 ساعة). عند فشل الفحص نُعيد true كي لا نمنع الإرسال. */
export async function isOnWhatsApp(branchId: number, line: WaLine, phone: string): Promise<boolean> {
  const c = getConn(branchId, line);
  const num = normalizePhone(phone);
  if (!num) return false;
  const cached = c.onWaCache.get(num);
  if (cached && Date.now() - cached.at < 24 * 3600e3) return cached.ok;
  let ok = true;
  try {
    const r = await c.sock?.onWhatsApp(jidOf(num));
    ok = !!(r && r[0] && (r[0] as any).exists);
  } catch { ok = true; }
  c.onWaCache.set(num, { ok, at: Date.now() });
  return ok;
}

/**
 * إرسال فوري بلا طابور وبلا حماية الخط الأساسي — للمستدعي الذي يتولّى الإيقاع بنفسه
 * (قسم المتابعة له نظام حمايته الخاص: فاصل زمني ودفعات واستراحة). يُذيَّل بتوقيع Xenon
 * ويُسجَّل في whatsapp_log كبقية الرسائل.
 */
export async function sendDirect(
  branchId: number, line: WaLine, phone: string, text: string,
  kind: SendKind = "followup", orderId: number | null = null,
): Promise<SendResult> {
  const c = getConn(branchId, line);
  const num = normalizePhone(phone);
  if (!num) {
    await logSend(branchId, line, kind, phone, orderId, "skipped", "رقم غير صالح");
    return { ok: false, skipped: "رقم غير صالح" };
  }
  if (!c.sock || c.status !== "connected") {
    await logSend(branchId, line, kind, num, orderId, "failed", "واتساب غير متصل");
    return { ok: false, error: "واتساب غير متصل" };
  }
  let full = text;
  try { full = await withFooter(text); } catch { /* التوقيع ثانوي */ }
  try {
    const sent: any = await c.sock.sendMessage(jidOf(num), { text: full });
    c.sentTimestamps.push(Date.now());
    await logSend(branchId, line, kind, num, orderId, "sent");
    storeMessage(branchId, num, true, full, "", sent?.key?.id || "", line).catch(() => {});
    return { ok: true };
  } catch (e: any) {
    await logSend(branchId, line, kind, num, orderId, "failed", e?.message || String(e));
    return { ok: false, error: e?.message || String(e) };
  }
}

async function drain(branchId: number, line: WaLine = "main") {
  const c = getConn(branchId, line);
  if (c.draining) return;
  c.draining = true;
  try {
    while (c.queue.length) {
      if (!c.sock || c.status !== "connected") {
        // not connected: fail everything queued (orders must not wait on WhatsApp)
        const item = c.queue.shift()!;
        await logSend(branchId, line, item.kind, item.toPhone, item.orderId, "failed", "واتساب غير متصل");
        item.resolve({ ok: false, error: "واتساب غير متصل" });
        continue;
      }
      const s = await getSettings(branchId);
      const item = c.queue.shift()!;

      // ── 🛡 protection checks ──
      if (s.protectionEnabled && item.kind !== "test") {
        const total = await countToday(branchId, line);
        if (total >= s.dailyCapTotal) {
          await logSend(branchId, line, item.kind, item.toPhone, item.orderId, "skipped", `تجاوز الحد اليومي الكلي (${s.dailyCapTotal})`);
          item.resolve({ ok: false, skipped: "الحد اليومي الكلي" }); continue;
        }
        if (item.kind === "customer") {
          const per = await countToday(branchId, line, "customer", item.toPhone);
          if (per >= s.dailyCapPerCustomer) {
            await logSend(branchId, line, item.kind, item.toPhone, item.orderId, "skipped", `تجاوز حد الزبون اليومي (${s.dailyCapPerCustomer})`);
            item.resolve({ ok: false, skipped: "حد الزبون اليومي" }); continue;
          }
          if (s.customerCooldownMin > 0) {
            const ago = await lastSentMinutesAgo(branchId, line, item.toPhone);
            if (ago != null && ago < s.customerCooldownMin) {
              await logSend(branchId, line, item.kind, item.toPhone, item.orderId, "skipped", `تكرار خلال ${s.customerCooldownMin} د`);
              item.resolve({ ok: false, skipped: "تكرار سريع" }); continue;
            }
          }
          if (s.checkOnWhatsApp) {
            const cached = c.onWaCache.get(item.toPhone);
            let onWa = cached && Date.now() - cached.at < 24 * 3600e3 ? cached.ok : null;
            if (onWa == null) {
              try {
                const r = await c.sock.onWhatsApp(item.jid);
                onWa = !!(r && r[0] && (r[0] as any).exists);
              } catch { onWa = true; } // لا نمنع الإرسال إن فشل الفحص
              c.onWaCache.set(item.toPhone, { ok: onWa, at: Date.now() });
            }
            if (!onWa) {
              await logSend(branchId, line, item.kind, item.toPhone, item.orderId, "skipped", "الرقم ليس على واتساب");
              item.resolve({ ok: false, skipped: "ليس على واتساب" }); continue;
            }
          }
        }
        // per-minute cap
        const now = Date.now();
        c.sentTimestamps = c.sentTimestamps.filter(t => now - t < 60_000);
        if (c.sentTimestamps.length >= s.maxPerMinute) {
          const wait = 60_000 - (now - c.sentTimestamps[0]) + 250;
          await new Promise(r => setTimeout(r, wait));
        }
        // random human-like delay
        await new Promise(r => setTimeout(r, rand(s.minDelaySec, s.maxDelaySec) * 1000));
      } else {
        await new Promise(r => setTimeout(r, 700));
      }

      try {
        // خزّن الرسالة الصادرة بمعرّفها الحقيقي (key.id) كي يُتعرّف على صداها القادم
        // من messages.upsert كنسخة مكرّرة فيُهمَل — وإلا ظهرت الرسالة (مثل «تم استلام الطلب») مرتين.
        const sent: any = await c.sock!.sendMessage(item.jid, { text: item.text });
        c.sentTimestamps.push(Date.now());
        await logSend(branchId, line, item.kind, item.toPhone, item.orderId, "sent");
        storeMessage(branchId, item.toPhone, true, item.text, "", sent?.key?.id || "", line).catch(() => {});
        item.resolve({ ok: true });
      } catch (e: any) {
        await logSend(branchId, line, item.kind, item.toPhone, item.orderId, "failed", e?.message || String(e));
        item.resolve({ ok: false, error: e?.message || String(e) });
      }
    }
  } finally {
    c.draining = false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Order notifications (templates)
// ─────────────────────────────────────────────────────────────────────────────
function itemsFromNote(note: string | null | undefined): string {
  const lines = String(note || "").split("\n").map(l => l.trim()).filter(l => l.startsWith("•"));
  return lines.join("\n");
}
function cleanNote(note: string | null | undefined): string {
  // the POS puts a structured block in the note; keep only the courier note line (📝 …) if present
  const m = String(note || "").split("\n").find(l => l.trim().startsWith("📝"));
  return m ? m.replace(/^📝\s*/, "").trim() : "";
}
export function renderTemplate(tpl: string, vars: Record<string, string | number | null | undefined>) {
  const val = (k: string) => { const v = vars[k]; return v == null ? "" : String(v); };
  const outLines: string[] = [];
  for (const line of String(tpl || "").split("\n")) {
    const placeholders = Array.from(line.matchAll(/\{([a-zA-Z]+)\}/g)).map(m => m[1]);
    let rendered = line;
    for (const k of placeholders) rendered = rendered.split(`{${k}}`).join(val(k));
    if (placeholders.length > 0) {
      // سطر متغيراته كلها فارغة يُحذف فقط إن كان نصّه الثابت مجرد عنوان/رمز
      // ("📍 العنوان: {address}" أو "📝 {note}") — أما "شكراً لاختيارك 🌹{ratingLink}"
      // فيبقى بنصّه. السطر بلا متغيرات (مثل "🍔 الطلب:") يبقى دائماً.
      const allEmpty = placeholders.every(k => val(k).trim() === "");
      if (allEmpty) {
        const staticText = line.replace(/\{[a-zA-Z]+\}/g, "").trim();
        const labelOnly = /:\s*$/.test(staticText) || !/[A-Za-z0-9؀-ۿ]/.test(staticText);
        if (labelOnly) continue;
        rendered = staticText;
      }
    }
    outLines.push(rendered);
  }
  return outLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function orderVars(branchId: number, orderId: number) {
  const order: any = await db.getOrderById(orderId);
  if (!order) return null;
  const [branch, region, courier] = await Promise.all([
    db.getBranchById(branchId).catch(() => undefined),
    order.regionId ? db.getRegionById(order.regionId).catch(() => undefined) : Promise.resolve(undefined),
    order.deliveryPersonId ? db.getUserById(order.deliveryPersonId).catch(() => undefined) : Promise.resolve(undefined),
  ]);
  const items = itemsFromNote(order.note);
  return {
    order, courier,
    vars: {
      order: order.id, name: order.customerName || "", phone: order.customerPhone || "",
      area: (region as any)?.name || "", address: order.address || "",
      items: items || "—", total: Math.round(Number(order.price) || 0).toLocaleString("en-US"),
      note: cleanNote(order.note), driver: (courier as any)?.name || "", driverPhone: (courier as any)?.phone || "",
      branch: (branch as any)?.name || "", ratingLink: "", // ميزة التقييم لاحقاً
    },
  };
}

/** New order created (or transferred): notify courier and (on creation) the customer. */
export async function onOrderCreated(branchId: number, orderId: number) {
  try {
    const s = await getSettings(branchId);
    if (!s.enabled) return;
    const ctx = await orderVars(branchId, orderId);
    if (!ctx) return;
    if (s.notifyCourier && ctx.courier?.phone) {
      send(branchId, ctx.courier.phone, renderTemplate(s.courierTemplate, ctx.vars), "courier", orderId).catch(() => {});
    }
    if (s.notifyCustomer && ctx.vars.phone) {
      send(branchId, String(ctx.vars.phone), renderTemplate(s.customerTemplate, ctx.vars), "customer", orderId).catch(() => {});
    }
  } catch (e: any) { console.warn("[whatsapp] onOrderCreated:", e?.message || e); }
}

/** Customer sent a WhatsApp location → attach it to their active order (so the courier navigates
 *  there) + remember it as their last delivery location + DM the assigned courier. */
export async function onCustomerLocation(branchId: number, phone: string, lat: number, lng: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return; // إحداثيات غير صالحة
  // رقم الواتساب يصل بصيغة دولية (964…) لكن أرقام الزبائن مخزّنة محليًا (07…)،
  // وgetCustomerByPhone مطابقة حرفية — لذا جرّب الصيغتين وإلا فشل الربط دائمًا.
  const intl = normalizePhone(phone);
  if (!intl) return;
  const local = intl.startsWith("964") ? "0" + intl.slice(3) : intl;
  const cust = (await db.getCustomerByPhone(local, branchId)) || (await db.getCustomerByPhone(intl, branchId));
  if (!cust) return; // زبون غير معروف — لا شيء لربطه
  const url = `https://maps.google.com/?q=${lat},${lng}`;
  await db.updateCustomerLocation((cust as any).id, branchId, url);
  const order = await db.getActiveOrderByCustomer((cust as any).id, branchId);
  if (!order) return; // لا طلب مفتوح — حُفظ كآخر موقع فقط
  await db.updateOrder((order as any).id, { locationLink: url });
  if ((order as any).deliveryPersonId) {
    try {
      const courier = await db.getUserById((order as any).deliveryPersonId);
      if ((courier as any)?.phone) {
        await send(branchId, (courier as any).phone, `📍 وصل موقع الزبون للطلب #${(order as any).id}:\n${url}`, "courier", (order as any).id);
      }
    } catch { /* تجاهل فشل إبلاغ المندوب */ }
  }
}

/** Order moved to another courier: notify the NEW courier only. */
export async function onOrderReassigned(branchId: number, orderId: number) {
  try {
    const s = await getSettings(branchId);
    if (!s.enabled || !s.notifyCourier) return;
    const ctx = await orderVars(branchId, orderId);
    if (!ctx?.courier?.phone) return;
    const text = "🔁 طلب محوّل إليك\n" + renderTemplate(s.courierTemplate, ctx.vars);
    send(branchId, ctx.courier.phone, text, "courier", orderId).catch(() => {});
  } catch (e: any) { console.warn("[whatsapp] onOrderReassigned:", e?.message || e); }
}

// ─────────────────────────────────────────────────────────────────────────────
// 📥 صندوق رسائل الزبائن — نظام شركة Xenon للاتصالات
// ─────────────────────────────────────────────────────────────────────────────
export async function storeMessage(branchId: number, phone: string, fromMe: boolean, text: string, pushName = "", waId = "", line: WaLine = "main") {
  await ensureTables();
  const d = await db.getDb();
  if (!d) return;
  const num = normalizePhone(phone) || phone;
  if (waId) {
    const dup = rowsOf(await d.execute(sql`SELECT id FROM whatsapp_messages WHERE branchId = ${branchId} AND line = ${line} AND waId = ${waId} LIMIT 1`))[0];
    if (dup) return;
  }
  await d.execute(sql`INSERT INTO whatsapp_messages (branchId, line, phone, fromMe, text, pushName, waId)
    VALUES (${branchId}, ${line}, ${num}, ${fromMe ? 1 : 0}, ${text.slice(0, 4000)}, ${pushName.slice(0, 190)}, ${waId.slice(0, 190)})`);
  await d.execute(sql`INSERT INTO whatsapp_conversations (branchId, line, phone, name, lastText, lastAt, unread, summaryDirty)
    VALUES (${branchId}, ${line}, ${num}, ${fromMe ? "" : pushName.slice(0, 190)}, ${text.slice(0, 500)}, NOW(), ${fromMe ? 0 : 1}, 1)
    ON DUPLICATE KEY UPDATE
      name = CASE WHEN ${fromMe ? 1 : 0} = 0 AND ${pushName.slice(0, 190)} <> '' THEN ${pushName.slice(0, 190)} ELSE name END,
      lastText = VALUES(lastText), lastAt = NOW(),
      unread = unread + ${fromMe ? 0 : 1}, summaryDirty = 1`);
}

export async function listConversations(branchId: number, limit = 200, line: WaLine = "main") {
  await ensureTables();
  const d = await db.getDb();
  if (!d) return [];
  return rowsOf(await d.execute(sql`SELECT * FROM whatsapp_conversations WHERE branchId = ${branchId} AND line = ${line}
    ORDER BY lastAt DESC LIMIT ${sql.raw(String(Math.min(Math.max(limit, 1), 500)))}`));
}

export async function getMessages(branchId: number, phone: string, limit = 300, line: WaLine = "main") {
  await ensureTables();
  const d = await db.getDb();
  if (!d) return [];
  const num = normalizePhone(phone) || phone;
  const rows = rowsOf(await d.execute(sql`SELECT * FROM whatsapp_messages WHERE branchId = ${branchId} AND line = ${line} AND phone = ${num}
    ORDER BY id DESC LIMIT ${sql.raw(String(Math.min(Math.max(limit, 1), 1000)))}`));
  return rows.reverse();
}

export async function markRead(branchId: number, phone: string, line: WaLine = "main") {
  await ensureTables();
  const d = await db.getDb();
  if (!d) return;
  const num = normalizePhone(phone) || phone;
  await d.execute(sql`UPDATE whatsapp_conversations SET unread = 0 WHERE branchId = ${branchId} AND line = ${line} AND phone = ${num}`);
}

/** رد من النظام على زبون — يمرّ عبر الحماية (التأخير والحد الكلي) ويُذيَّل بتوقيع Xenon */
export async function reply(branchId: number, phone: string, text: string, line: WaLine = "main") {
  const c = getConn(branchId, line);
  if (c.status !== "connected") return { ok: false, error: "واتساب الفرع غير متصل" } as SendResult;
  return send(branchId, phone, text, "reply", null, line);
}

/** ملخص ذكي للمحادثة (Xenon AI). يُعاد الملخص المحفوظ ما لم يكن قديماً (رسائل جديدة) أو force=true. */
export async function summarize(branchId: number, phone: string, force = false, line: WaLine = "main") {
  await ensureTables();
  const d = await db.getDb();
  if (!d) throw new Error("Database not available");
  const num = normalizePhone(phone) || phone;
  const conv = rowsOf(await d.execute(sql`SELECT * FROM whatsapp_conversations WHERE branchId = ${branchId} AND line = ${line} AND phone = ${num} LIMIT 1`))[0];
  if (!conv) throw new Error("لا توجد محادثة");
  if (!force && conv.summary && !Number(conv.summaryDirty)) return { summary: conv.summary, summaryAt: conv.summaryAt, cached: true };

  const cfg = await db.getXenonAiForBranch(branchId);
  if (!cfg.enabled || !cfg.key) throw new Error("Xenon AI غير مفعّل لهذا الفرع — فعّله من لوحة المطوّر");
  const model = (cfg.model && cfg.model !== "gemini-3.6-flash") ? cfg.model : "gemini-3.5-flash";
  const msgs = await getMessages(branchId, num, 80, line);
  if (!msgs.length) throw new Error("لا توجد رسائل");
  const transcript = msgs.map((m: any) => `${Number(m.fromMe) ? "المطعم" : (conv.name || "الزبون")}: ${String(m.text || "").replace(/\s+/g, " ").slice(0, 400)}`).join("\n");
  const prompt = [
    "أنت مساعد لمطعم/شركة توصيل. لخّص محادثة واتساب التالية بين المطعم والزبون بالعربية في 3 إلى 6 أسطر قصيرة جداً:",
    "١) من هو الزبون وماذا يريد (طلب/استفسار/شكوى). ٢) أي تفاصيل مهمة (عنوان، منطقة، أصناف، مبلغ، موعد). ٣) الحالة الآن (هل رُدّ عليه؟ ما المطلوب منا؟). ٤) إجراء مقترح في سطر واحد.",
    "لا تخترع معلومات غير موجودة في المحادثة. اكتب نصاً عادياً بلا JSON.",
    "— المحادثة —",
    transcript,
  ].join("\n");
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cfg.key}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2 } }),
  });
  const txt = await res.text();
  if (!res.ok) { throw xenonAiError(res.status, txt); } // لا يتسرّب نص المزوّد للعميل
  let data: any = {}; try { data = JSON.parse(txt); } catch {}
  const summary = String(data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "").trim().slice(0, 2000);
  if (!summary) throw new Error("لم يُعِد Xenon AI ملخصاً");
  await d.execute(sql`UPDATE whatsapp_conversations SET summary = ${summary}, summaryAt = NOW(), summaryDirty = 0 WHERE branchId = ${branchId} AND line = ${line} AND phone = ${num}`);
  return { summary, summaryAt: new Date().toISOString(), cached: false };
}

export async function inboxStats(branchId: number, line: WaLine = "main") {
  await ensureTables();
  const d = await db.getDb();
  if (!d) return { conversations: 0, unread: 0 };
  const row = rowsOf(await d.execute(sql`SELECT COUNT(*) c, COALESCE(SUM(unread),0) u FROM whatsapp_conversations WHERE branchId = ${branchId} AND line = ${line}`))[0] || {};
  return { conversations: Number(row.c || 0), unread: Number(row.u || 0) };
}
