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
    k VARCHAR(191) NOT NULL,
    v LONGTEXT,
    PRIMARY KEY (branchId, k)
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
    kind VARCHAR(20) NOT NULL,
    toPhone VARCHAR(30) DEFAULT '',
    orderId INT NULL,
    status VARCHAR(20) NOT NULL,
    error TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX branch_created (branchId, createdAt),
    INDEX branch_phone (branchId, toPhone)
  )`);
  tablesReady = true;
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

async function logSend(branchId: number, kind: string, toPhone: string, orderId: number | null, status: string, error = "") {
  try {
    await ensureTables();
    const d = await db.getDb();
    if (!d) return;
    await d.execute(sql`INSERT INTO whatsapp_log (branchId, kind, toPhone, orderId, status, error)
      VALUES (${branchId}, ${kind}, ${toPhone}, ${orderId}, ${status}, ${error.slice(0, 500)})`);
  } catch (_) { /* logging is secondary */ }
}

export async function getLogs(branchId: number, limit = 100) {
  await ensureTables();
  const d = await db.getDb();
  if (!d) return [];
  return rowsOf(await d.execute(sql`SELECT * FROM whatsapp_log WHERE branchId = ${branchId} ORDER BY id DESC LIMIT ${Math.min(Math.max(limit, 1), 500)}`));
}

export async function getTodayStats(branchId: number) {
  await ensureTables();
  const d = await db.getDb();
  if (!d) return { sent: 0, failed: 0, skipped: 0 };
  const row = rowsOf(await d.execute(sql`SELECT
      SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END) sent,
      SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) failed,
      SUM(CASE WHEN status='skipped' THEN 1 ELSE 0 END) skipped
    FROM whatsapp_log WHERE branchId = ${branchId} AND DATE(createdAt) = CURDATE()`))[0] || {};
  return { sent: Number(row.sent || 0), failed: Number(row.failed || 0), skipped: Number(row.skipped || 0) };
}

// ─────────────────────────────────────────────────────────────────────────────
// DB-backed Baileys auth state (mirrors useMultiFileAuthState, but in MySQL)
// ─────────────────────────────────────────────────────────────────────────────
async function authRead(branchId: number, key: string): Promise<any | null> {
  const d = await db.getDb();
  if (!d) return null;
  const row = rowsOf(await d.execute(sql`SELECT v FROM whatsapp_auth WHERE branchId = ${branchId} AND k = ${key} LIMIT 1`))[0];
  if (!row || row.v == null) return null;
  try { return JSON.parse(row.v, BufferJSON.reviver); } catch { return null; }
}
async function authWrite(branchId: number, key: string, value: any) {
  const d = await db.getDb();
  if (!d) return;
  const v = JSON.stringify(value, BufferJSON.replacer);
  await d.execute(sql`INSERT INTO whatsapp_auth (branchId, k, v) VALUES (${branchId}, ${key}, ${v})
    ON DUPLICATE KEY UPDATE v = VALUES(v)`);
}
async function authDelete(branchId: number, key: string) {
  const d = await db.getDb();
  if (!d) return;
  await d.execute(sql`DELETE FROM whatsapp_auth WHERE branchId = ${branchId} AND k = ${key}`);
}
export async function clearAuth(branchId: number) {
  await ensureTables();
  const d = await db.getDb();
  if (!d) return;
  await d.execute(sql`DELETE FROM whatsapp_auth WHERE branchId = ${branchId}`);
}
export async function hasSavedSession(branchId: number) {
  await ensureTables();
  const creds = await authRead(branchId, "creds");
  return !!(creds && creds.me?.id);
}

async function useDbAuthState(branchId: number) {
  await ensureTables();
  const creds: AuthenticationCreds = (await authRead(branchId, "creds")) || initAuthCreds();
  const state = {
    creds,
    keys: {
      get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
        const data: { [id: string]: SignalDataTypeMap[T] } = {};
        await Promise.all(ids.map(async (id) => {
          let value = await authRead(branchId, `${type}-${id}`);
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
            tasks.push(value ? authWrite(branchId, key, value) : authDelete(branchId, key));
          }
        }
        await Promise.all(tasks);
      },
    },
  };
  const saveCreds = () => authWrite(branchId, "creds", state.creds);
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

const conns = new Map<number, Conn>();
const logger = pino({ level: "silent" });

function getConn(branchId: number): Conn {
  let c = conns.get(branchId);
  if (!c) {
    c = { sock: null, status: "disconnected", qr: null, qrDataUrl: null, pairingCode: null, me: null, lastError: null,
      updatedAt: Date.now(), reconnectTimer: null, wantOpen: false, queue: [], draining: false, sentTimestamps: [], onWaCache: new Map() };
    conns.set(branchId, c);
  }
  return c;
}

export function status(branchId: number) {
  const c = getConn(branchId);
  return {
    status: c.status, qrDataUrl: c.status === "qr" ? c.qrDataUrl : null, pairingCode: c.pairingCode,
    phone: c.me, lastError: c.lastError, updatedAt: c.updatedAt, queued: c.queue.length,
  };
}

export async function connect(branchId: number): Promise<ReturnType<typeof status>> {
  const c = getConn(branchId);
  c.wantOpen = true;
  if (c.sock && (c.status === "connected" || c.status === "connecting" || c.status === "qr")) return status(branchId);
  await openSocket(branchId);
  return status(branchId);
}

async function openSocket(branchId: number) {
  const c = getConn(branchId);
  if (c.reconnectTimer) { clearTimeout(c.reconnectTimer); c.reconnectTimer = null; }
  c.status = "connecting"; c.lastError = null; c.qr = null; c.qrDataUrl = null; c.pairingCode = null; c.updatedAt = Date.now();
  try {
    const { state, saveCreds } = await useDbAuthState(branchId);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined as any }));
    const sock = makeWASocket({
      version,
      auth: state,
      logger: logger as any,
      printQRInTerminal: false,
      browser: ["Xenon Delivery", "Chrome", "1.0.0"],
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
    });
    c.sock = sock;

    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("connection.update", async (u) => {
      const { connection, lastDisconnect, qr } = u;
      if (qr) {
        c.qr = qr; c.status = "qr"; c.updatedAt = Date.now();
        try { c.qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 320 }); } catch { c.qrDataUrl = null; }
      }
      if (connection === "open") {
        c.status = "connected"; c.qr = null; c.qrDataUrl = null; c.pairingCode = null; c.lastError = null; c.updatedAt = Date.now();
        c.me = (sock.user?.id || "").split(":")[0].split("@")[0] || null;
        console.log(`[whatsapp] branch ${branchId} connected as ${c.me}`);
        drain(branchId).catch(() => {});
      }
      if (connection === "close") {
        const code = (lastDisconnect?.error as any)?.output?.statusCode;
        const loggedOut = code === DisconnectReason.loggedOut || code === 401;
        c.status = "disconnected"; c.sock = null; c.updatedAt = Date.now();
        c.lastError = loggedOut ? "تم تسجيل الخروج من الهاتف — أعد الربط" : `انقطع الاتصال (${code || "?"})`;
        console.log(`[whatsapp] branch ${branchId} closed code=${code} loggedOut=${loggedOut}`);
        if (loggedOut) {
          await clearAuth(branchId).catch(() => {});
          c.me = null; c.wantOpen = false;
        } else if (c.wantOpen) {
          // transient → reconnect with backoff
          c.reconnectTimer = setTimeout(() => { openSocket(branchId).catch(() => {}); }, 4000);
        }
      }
    });
  } catch (e: any) {
    c.status = "disconnected"; c.sock = null; c.lastError = e?.message || String(e); c.updatedAt = Date.now();
    console.error(`[whatsapp] branch ${branchId} open failed:`, e?.message || e);
  }
}

/** رمز ربط رقمي (بدل QR): يُدخله المستخدم في واتساب ← الأجهزة المرتبطة ← ربط برقم الهاتف */
export async function requestPairingCode(branchId: number, phone: string) {
  const c = getConn(branchId);
  c.wantOpen = true;
  if (!c.sock || c.status === "disconnected") await openSocket(branchId);
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

export async function logout(branchId: number) {
  const c = getConn(branchId);
  c.wantOpen = false;
  if (c.reconnectTimer) { clearTimeout(c.reconnectTimer); c.reconnectTimer = null; }
  try { await c.sock?.logout(); } catch (_) {}
  try { c.sock?.end(undefined as any); } catch (_) {}
  c.sock = null; c.status = "disconnected"; c.qr = null; c.qrDataUrl = null; c.pairingCode = null; c.me = null; c.updatedAt = Date.now();
  await clearAuth(branchId).catch(() => {});
}

/** On server boot: reconnect every branch that has a saved session and the feature enabled. */
export async function init() {
  try {
    await ensureTables();
    const d = await db.getDb();
    if (!d) return;
    const rows = rowsOf(await d.execute(sql`SELECT a.branchId FROM whatsapp_auth a
      JOIN whatsapp_settings s ON s.branchId = a.branchId AND s.enabled = 1
      WHERE a.k = 'creds'`));
    for (const r of rows) {
      const bid = Number(r.branchId);
      if (!bid) continue;
      getConn(bid).wantOpen = true;
      openSocket(bid).catch(() => {});
      await new Promise(res => setTimeout(res, 1500)); // stagger
    }
    if (rows.length) console.log(`[whatsapp] restoring ${rows.length} branch session(s)`);
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

async function countToday(branchId: number, kind?: string, toPhone?: string): Promise<number> {
  const d = await db.getDb();
  if (!d) return 0;
  const row = rowsOf(await d.execute(sql`SELECT COUNT(*) c FROM whatsapp_log
    WHERE branchId = ${branchId} AND status = 'sent' AND DATE(createdAt) = CURDATE()
    ${kind ? sql`AND kind = ${kind}` : sql``} ${toPhone ? sql`AND toPhone = ${toPhone}` : sql``}`))[0];
  return Number(row?.c || 0);
}
async function lastSentMinutesAgo(branchId: number, toPhone: string): Promise<number | null> {
  const d = await db.getDb();
  if (!d) return null;
  const row = rowsOf(await d.execute(sql`SELECT TIMESTAMPDIFF(MINUTE, MAX(createdAt), NOW()) m FROM whatsapp_log
    WHERE branchId = ${branchId} AND toPhone = ${toPhone} AND status = 'sent'`))[0];
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

export type SendKind = "courier" | "customer" | "promo" | "test";

/** Queue a text message (Xenon footer appended automatically). Resolves with the outcome (never throws). */
export function send(branchId: number, phone: string, text: string, kind: SendKind, orderId: number | null = null): Promise<SendResult> {
  return new Promise<SendResult>((resolve) => {
    const c = getConn(branchId);
    const num = normalizePhone(phone);
    if (!num) { logSend(branchId, kind, phone, orderId, "skipped", "رقم غير صالح"); return resolve({ ok: false, skipped: "رقم غير صالح" }); }
    withFooter(text).then((full) => {
      c.queue.push({ jid: jidOf(num), text: full, kind, toPhone: num, orderId, resolve });
      drain(branchId).catch(() => {});
    }).catch(() => {
      c.queue.push({ jid: jidOf(num), text, kind, toPhone: num, orderId, resolve });
      drain(branchId).catch(() => {});
    });
  });
}

async function drain(branchId: number) {
  const c = getConn(branchId);
  if (c.draining) return;
  c.draining = true;
  try {
    while (c.queue.length) {
      if (!c.sock || c.status !== "connected") {
        // not connected: fail everything queued (orders must not wait on WhatsApp)
        const item = c.queue.shift()!;
        await logSend(branchId, item.kind, item.toPhone, item.orderId, "failed", "واتساب غير متصل");
        item.resolve({ ok: false, error: "واتساب غير متصل" });
        continue;
      }
      const s = await getSettings(branchId);
      const item = c.queue.shift()!;

      // ── 🛡 protection checks ──
      if (s.protectionEnabled && item.kind !== "test") {
        const total = await countToday(branchId);
        if (total >= s.dailyCapTotal) {
          await logSend(branchId, item.kind, item.toPhone, item.orderId, "skipped", `تجاوز الحد اليومي الكلي (${s.dailyCapTotal})`);
          item.resolve({ ok: false, skipped: "الحد اليومي الكلي" }); continue;
        }
        if (item.kind === "customer") {
          const per = await countToday(branchId, "customer", item.toPhone);
          if (per >= s.dailyCapPerCustomer) {
            await logSend(branchId, item.kind, item.toPhone, item.orderId, "skipped", `تجاوز حد الزبون اليومي (${s.dailyCapPerCustomer})`);
            item.resolve({ ok: false, skipped: "حد الزبون اليومي" }); continue;
          }
          if (s.customerCooldownMin > 0) {
            const ago = await lastSentMinutesAgo(branchId, item.toPhone);
            if (ago != null && ago < s.customerCooldownMin) {
              await logSend(branchId, item.kind, item.toPhone, item.orderId, "skipped", `تكرار خلال ${s.customerCooldownMin} د`);
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
              await logSend(branchId, item.kind, item.toPhone, item.orderId, "skipped", "الرقم ليس على واتساب");
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
        await c.sock!.sendMessage(item.jid, { text: item.text });
        c.sentTimestamps.push(Date.now());
        await logSend(branchId, item.kind, item.toPhone, item.orderId, "sent");
        item.resolve({ ok: true });
      } catch (e: any) {
        await logSend(branchId, item.kind, item.toPhone, item.orderId, "failed", e?.message || String(e));
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
