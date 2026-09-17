/**
 * Xenon ERP Connector (/api/erp)
 * ==============================
 * Uniform connector consumed by the central Xenon ERP platform (see
 * E:\ERP Harth\docs\ARCHITECTURE.md §5). Unlike the per-branch keys of
 * /api/v1 (public-api.ts), this router is guarded by ONE cross-branch
 * MASTER key stored in the `settings` table under `erp_api_key`.
 *
 * Key management: on boot, if no key is stored, an `erp_<40 hex>` key is
 * generated, persisted, and logged clearly (`[ERP] API key: ...`) so the
 * owner can paste it into the ERP developer panel.
 *
 * Endpoints (all JSON):
 *   GET  /api/erp/health
 *   GET  /api/erp/branches
 *   GET  /api/erp/summary?branch_id=&from=YYYY-MM-DD&to=YYYY-MM-DD
 *   GET  /api/erp/details?branch_id=&kind=&from=&to=&limit=&offset=&status=
 *          kinds: orders | delegates | customers_top | regions
 *   POST /api/erp/action        { branch_id, action, payload }
 *          actions: cancel_order { order_id }
 *                   reassign_order { order_id, delivery_person_id }
 *   POST /api/erp/sso-ticket    { branch_id } → { ok, url }
 *
 * SSO (no API key — consumed by the manager's browser):
 *   GET  /api/sso/consume?ticket=   sets the native session cookie exactly
 *   like tRPC auth.login does, then 302 → /admin. Tickets are in-memory,
 *   single-use, 60s TTL.
 */
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { Router, type Request, type Response, type NextFunction } from "express";
import * as db from "./db";
import * as whatsapp from "./whatsapp";
import { createSession } from "./routers";
import { toSqlDatetime } from "./dateUtils";

export const erpApiRouter = Router();

const ERP_KEY_SETTING = "erp_api_key";
const SYSTEM_KEY = "delegates";

// ---- master key management --------------------------------------------------

let erpKeyPromise: Promise<string | null> | null = null;

async function loadOrCreateErpKey(): Promise<string | null> {
  const row = await db.getSetting(ERP_KEY_SETTING);
  if (row && row.value) return row.value;

  // No stored key → generate and persist. Only treat the key as valid once it
  // is actually stored, so a DB outage never strands an unlogged key.
  const fresh = "erp_" + randomBytes(20).toString("hex");
  const saved = await db.upsertSetting(ERP_KEY_SETTING, fresh);
  if (!saved) return null;
  console.log(`[ERP] API key generated: ${fresh}`);
  return fresh;
}

function getErpKey(): Promise<string | null> {
  if (!erpKeyPromise) {
    erpKeyPromise = loadOrCreateErpKey()
      .catch(e => {
        console.warn("[ERP] key load failed:", e?.message || e);
        return null;
      })
      .then(key => {
        if (!key) erpKeyPromise = null; // retry lazily on the next request
        return key;
      });
  }
  return erpKeyPromise;
}

/** Ensure the master key exists and log it on boot (best-effort). */
export async function initErpApiKey(): Promise<void> {
  const key = await getErpKey();
  if (key) {
    console.log(`[ERP] API key: ${key}`);
  } else {
    console.warn("[ERP] API key not available yet (database unreachable?) — will retry on first request");
  }
}

// Constant-time compare via sha256 digests (equal-length buffers)
function safeKeyEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Validate a provided key against the stored ERP master key (constant-time).
 * Shared with /api/v1 (public-api.ts) so the cross-branch master key can also
 * drive the external control API with an explicit branch. Returns false —
 * never throws — when the key is missing/malformed or the master key can't be
 * loaded (e.g. database unreachable), so callers stay defensive.
 */
export async function verifyErpMasterKey(provided: string | undefined | null): Promise<boolean> {
  if (!provided || !provided.startsWith("erp_")) return false;
  try {
    const expected = await getErpKey();
    if (!expected) return false;
    return safeKeyEqual(provided, expected);
  } catch {
    return false;
  }
}

// ---- light in-memory rate limit (60 req/min per key/ip) ---------------------

const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimited(id: string): boolean {
  const now = Date.now();
  if (rateBuckets.size > 1000) {
    rateBuckets.forEach((v, k) => { if (v.resetAt <= now) rateBuckets.delete(k); });
  }
  const bucket = rateBuckets.get(id);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(id, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT;
}

// ---- auth middleware ---------------------------------------------------------

async function authenticateErpKey(req: Request, res: Response, next: NextFunction) {
  const provided = req.header("x-api-key")
    || (req.header("authorization")?.startsWith("Bearer ")
      ? req.header("authorization")!.slice(7)
      : undefined);

  if (rateLimited(provided || req.ip || "anon")) {
    return res.status(429).json({ error: "RATE_LIMITED", message: "طلبات كثيرة — انتظر دقيقة" });
  }

  if (!provided || !provided.startsWith("erp_")) {
    return res.status(401).json({ error: "MISSING_API_KEY", message: "أرسل مفتاح ERP في الترويسة X-API-Key" });
  }

  const expected = await getErpKey();
  if (!expected) {
    return res.status(503).json({ error: "KEY_UNAVAILABLE", message: "تعذر تحميل مفتاح ERP (قاعدة البيانات غير متاحة)" });
  }
  if (!safeKeyEqual(provided, expected)) {
    return res.status(401).json({ error: "INVALID_API_KEY", message: "مفتاح ERP غير صحيح" });
  }
  next();
}

erpApiRouter.use(authenticateErpKey);

// ---- helpers -----------------------------------------------------------------

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseBranchId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Start of the business day (dayStartHour, default 05:00) for YYYY-MM-DD. */
function businessDayStart(dateStr: string, dayStartHour: number): Date | null {
  const m = DATE_ONLY_RE.exec(dateStr);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), dayStartHour, 0, 0, 0);
}

/** End of the business day: next day at dayStartHour minus 1 second. */
function businessDayEnd(dateStr: string, dayStartHour: number): Date | null {
  const m = DATE_ONLY_RE.exec(dateStr);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1, dayStartHour, 0, -1, 0);
}

/** Business date (YYYY-MM-DD) an order belongs to, given the day-start hour. */
function businessDateOf(createdAt: string | Date, dayStartHour: number): string {
  const d = new Date(createdAt);
  d.setHours(d.getHours() - dayStartHour);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today's business date string, given the day-start hour. */
function currentBusinessDate(dayStartHour: number): string {
  return businessDateOf(new Date(), dayStartHour);
}

type BranchRow = NonNullable<Awaited<ReturnType<typeof db.getBranchById>>>;

function subscriptionOf(branch: BranchRow) {
  const end = branch.subscriptionEndDate ? new Date(branch.subscriptionEndDate) : null;
  const now = new Date();
  const expired = !!(end && !isNaN(end.getTime()) && end.getTime() < now.getTime());
  const daysLeft = end && !isNaN(end.getTime())
    ? Math.ceil((end.getTime() - now.getTime()) / 86_400_000)
    : null;
  return {
    start: branch.subscriptionStartDate || null,
    end: branch.subscriptionEndDate || null,
    active: branch.isActive === 1 && !expired,
    days_left: daysLeft,
    expired,
  };
}

/** Resolve + validate branch_id; sends the error response itself on failure. */
async function requireBranch(branchIdRaw: unknown, res: Response): Promise<BranchRow | null> {
  const branchId = parseBranchId(branchIdRaw);
  if (!branchId) {
    res.status(400).json({ error: "MISSING_BRANCH_ID", message: "branch_id مطلوب" });
    return null;
  }
  const branch = await db.getBranchById(branchId);
  if (!branch) {
    res.status(404).json({ error: "BRANCH_NOT_FOUND", message: "الفرع غير موجود" });
    return null;
  }
  if (subscriptionOf(branch).expired) {
    res.status(403).json({ error: "SUBSCRIPTION_EXPIRED", message: "اشتراك الفرع منتهي" });
    return null;
  }
  return branch;
}

// ---- endpoints ----------------------------------------------------------------

erpApiRouter.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, system: SYSTEM_KEY, version: process.env.npm_package_version || undefined, time: new Date().toISOString() });
});

erpApiRouter.get("/branches", async (_req: Request, res: Response) => {
  try {
    const branches = await db.getAllBranches();
    res.json({
      ok: true,
      system: SYSTEM_KEY,
      branches: branches.map((b: any) => {
        const sub = subscriptionOf(b);
        return {
          id: b.id,
          name: b.name,
          code: b.code,
          active: b.isActive === 1,
          subscription: { start: sub.start, end: sub.end },
        };
      }),
    });
  } catch (e) {
    console.error("[ERP] branches error:", e);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

erpApiRouter.get("/summary", async (req: Request, res: Response) => {
  try {
    const branch = await requireBranch(req.query.branch_id, res);
    if (!branch) return;

    const dayStartHour = await db.getDayStartHour();
    const today = currentBusinessDate(dayStartHour);
    const fromStr = typeof req.query.from === "string" && DATE_ONLY_RE.test(req.query.from)
      ? req.query.from
      : (typeof req.query.to === "string" && DATE_ONLY_RE.test(req.query.to) ? req.query.to : today);
    const toStr = typeof req.query.to === "string" && DATE_ONLY_RE.test(req.query.to)
      ? req.query.to
      : fromStr;

    const start = businessDayStart(fromStr, dayStartHour)!;
    const end = businessDayEnd(toStr, dayStartHour)!;
    if (end.getTime() < start.getTime()) {
      return res.status(400).json({ error: "INVALID_RANGE", message: "المدى الزمني غير صحيح (from بعد to)" });
    }

    // Same source of truth as the admin dashboard (stats.custom / stats.byDateRange)
    const stats = await db.getCustomStats({
      startDate: toSqlDatetime(start),
      endDate: toSqlDatetime(end),
      branchId: branch.id,
    });
    if (!stats) {
      return res.status(503).json({ error: "DB_UNAVAILABLE", message: "قاعدة البيانات غير متاحة" });
    }

    const deliveredOrders = stats.orders.filter(o => o.status === "delivered");
    const revenue = stats.totalRevenue; // SUM(price) of delivered in range
    const profit = deliveredOrders.reduce((sum, o) => sum + (o.deliveryProfit || 0), 0);

    // Daily series (delivered revenue/count, bucketed by business day)
    const dailyMap = new Map<string, { revenue: number; count: number }>();
    for (const order of deliveredOrders) {
      const date = businessDateOf(order.createdAt, dayStartHour);
      const bucket = dailyMap.get(date) || { revenue: 0, count: 0 };
      bucket.revenue += order.price;
      bucket.count += 1;
      dailyMap.set(date, bucket);
    }
    const daily = Array.from(dailyMap.entries())
      .map(([date, v]) => ({ date, revenue: v.revenue, count: v.count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Per-delegate table (all-time counts, same as the admin "المندوبين" stats)
    const [delegateStats, delegateUsers] = await Promise.all([
      db.getAllDeliveryPersonsStats(branch.id),
      db.getDeliveryPersons(branch.id),
    ]);
    const nameById = new Map(delegateUsers.map((u: any) => [u.id, { name: u.name, username: u.username }]));
    const byDelegate = delegateStats.map((s: any) => ({
      delivery_person_id: s.deliveryPersonId,
      name: nameById.get(s.deliveryPersonId)?.name ?? null,
      username: nameById.get(s.deliveryPersonId)?.username ?? null,
      total: Number(s.total) || 0,
      delivered: Number(s.delivered) || 0,
      pending: Number(s.pending) || 0,
      postponed: Number(s.postponed) || 0,
      cancelled: Number(s.cancelled) || 0,
    }));

    const sub = subscriptionOf(branch);
    res.json({
      ok: true,
      system: SYSTEM_KEY,
      branch: { id: String(branch.id), name: branch.name, sub_id: null },
      range: { from: fromStr, to: toStr },
      currency: "IQD",
      kpis: {
        revenue,
        cost: null,
        profit,
        count_primary: stats.byStatus.delivered, // delivered orders
        count_secondary: stats.totalOrders,       // all orders in range
        pending: stats.byStatus.pending,
      },
      daily,
      breakdown: {
        pending: stats.byStatus.pending,
        postponed: stats.byStatus.postponed,
        returned: stats.byStatus.returned,
        cancelled: stats.byStatus.cancelled,
        by_delegate: byDelegate,
        by_delegate_range: stats.byDeliveryPerson,
        by_region: stats.byRegion,
      },
      subscription: { start: sub.start, end: sub.end, active: sub.active, days_left: sub.days_left },
      freshness: { generated_at: new Date().toISOString(), last_sync_at: null },
    });
  } catch (e) {
    console.error("[ERP] summary error:", e);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

const ORDER_STATUSES = ["pending_approval", "pending", "delivered", "postponed", "cancelled", "returned"];

erpApiRouter.get("/details", async (req: Request, res: Response) => {
  try {
    const branch = await requireBranch(req.query.branch_id, res);
    if (!branch) return;

    const kind = String(req.query.kind || "");
    const limit = Math.min(parseInt(String(req.query.limit || ""), 10) || 50, 200);
    const offset = parseInt(String(req.query.offset || ""), 10) || 0;

    if (kind === "orders") {
      const dayStartHour = await db.getDayStartHour();
      const statuses = typeof req.query.status === "string" && req.query.status
        ? req.query.status.split(",").map(s => s.trim()).filter(s => ORDER_STATUSES.includes(s))
        : undefined;
      const from = typeof req.query.from === "string" && DATE_ONLY_RE.test(req.query.from)
        ? toSqlDatetime(businessDayStart(req.query.from, dayStartHour)!)
        : undefined;
      const to = typeof req.query.to === "string" && DATE_ONLY_RE.test(req.query.to)
        ? toSqlDatetime(businessDayEnd(req.query.to, dayStartHour)!)
        : undefined;
      const rows = await db.getAllOrders({
        branchId: branch.id,
        statuses: statuses && statuses.length > 0 ? statuses : undefined,
        startDate: from,
        endDate: to,
        limit,
        offset,
      });
      return res.json({ ok: true, kind, rows });
    }

    if (kind === "delegates") {
      const rows = await db.getDeliveryPersonsWithStatus(branch.id);
      return res.json({ ok: true, kind, rows });
    }

    if (kind === "customers_top") {
      const rows = await db.getCustomersByOrderCount({ operator: "gte", count: 1 }, branch.id);
      return res.json({ ok: true, kind, rows: (rows as any[]).slice(offset, offset + limit) });
    }

    if (kind === "regions") {
      const [stats, regions] = await Promise.all([
        db.getOrderStatsByRegion(branch.id),
        db.getAllRegions(branch.id),
      ]);
      const regionById = new Map(regions.map((r: any) => [r.id, r]));
      const rows = stats.map((s: any) => ({
        region_id: s.regionId,
        name: regionById.get(s.regionId)?.name ?? null,
        province_id: regionById.get(s.regionId)?.provinceId ?? null,
        delivered_orders: Number(s.deliveredOrders) || 0,
        total_revenue: Number(s.totalRevenue) || 0,
      }));
      return res.json({ ok: true, kind, rows });
    }

    res.status(400).json({ error: "UNKNOWN_KIND", message: "kind يجب أن يكون: orders | delegates | customers_top | regions" });
  } catch (e) {
    console.error("[ERP] details error:", e);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

erpApiRouter.post("/action", async (req: Request, res: Response) => {
  try {
    const { branch_id, action, payload } = req.body || {};
    const branch = await requireBranch(branch_id, res);
    if (!branch) return;

    // نفس دوال قاعدة البيانات المستخدمة في PUT /api/v1/orders/:id (public-api.ts)
    if (action === "cancel_order") {
      const orderId = Number(payload?.order_id);
      if (!orderId) return res.status(400).json({ error: "MISSING_ORDER_ID", message: "payload.order_id مطلوب" });
      const order = await db.getOrderById(orderId);
      if (!order || order.branchId !== branch.id) {
        return res.status(404).json({ error: "ORDER_NOT_FOUND", message: "الطلب غير موجود في هذا الفرع" });
      }
      if (order.status === "delivered") {
        return res.status(400).json({ error: "ALREADY_DELIVERED", message: "الطلب مُسلَّم — لا يمكن إلغاؤه" });
      }
      await db.updateOrderFieldsExternal(orderId, { status: "cancelled" });
      const updated = await db.getOrderById(orderId);
      return res.json({ ok: true, result: { order: updated } });
    }

    if (action === "reassign_order") {
      const orderId = Number(payload?.order_id);
      const deliveryPersonId = Number(payload?.delivery_person_id);
      if (!orderId || !deliveryPersonId) {
        return res.status(400).json({ error: "MISSING_FIELDS", message: "payload.order_id و payload.delivery_person_id مطلوبان" });
      }
      const order = await db.getOrderById(orderId);
      if (!order || order.branchId !== branch.id) {
        return res.status(404).json({ error: "ORDER_NOT_FOUND", message: "الطلب غير موجود في هذا الفرع" });
      }
      if (order.status === "delivered") {
        return res.status(400).json({ error: "ALREADY_DELIVERED", message: "الطلب مُسلَّم — لا يمكن تعديله" });
      }
      const person = await db.getUserById(deliveryPersonId);
      if (!person || person.role !== "delivery" || person.branchId !== branch.id) {
        return res.status(400).json({ error: "INVALID_DELIVERY_PERSON", message: "المندوب غير موجود في هذا الفرع" });
      }
      // المندوب الجديد يوافق من جديد (نفس سلوك تحويل الطلب من نظام المطعم)
      await db.updateOrderFieldsExternal(orderId, {
        deliveryPersonId,
        status: "pending_approval",
        acceptedAt: null,
      });
      // إشعار المندوب الجديد (best-effort)
      try {
        await db.createNotification({
          branchId: branch.id,
          userId: deliveryPersonId,
          title: "طلب محوّل إليك",
          message: `تم تحويل الطلب #${orderId} إليك من لوحة ERP — بانتظار موافقتك`,
          type: "order_assigned",
          orderId,
        });
      } catch (_) { /* الإشعار ثانوي */ }
      whatsapp.onOrderReassigned(branch.id, orderId).catch(() => {});
      const updated = await db.getOrderById(orderId);
      return res.json({ ok: true, result: { order: updated } });
    }

    res.status(400).json({ error: "UNKNOWN_ACTION", message: "action يجب أن يكون: cancel_order | reassign_order" });
  } catch (e) {
    console.error("[ERP] action error:", e);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

// ---- SSO (one-time in-memory tickets, §8) --------------------------------------

const SSO_TICKET_TTL_MS = 60_000;
const ssoTickets = new Map<string, { branchId: number; expires: number; used: boolean }>();

function purgeExpiredTickets() {
  const now = Date.now();
  ssoTickets.forEach((t, token) => {
    if (t.expires <= now || t.used) ssoTickets.delete(token);
  });
}

erpApiRouter.post("/sso-ticket", async (req: Request, res: Response) => {
  try {
    const branch = await requireBranch(req.body?.branch_id, res);
    if (!branch) return;

    purgeExpiredTickets();
    const token = randomBytes(24).toString("hex"); // 48 hex chars
    ssoTickets.set(token, { branchId: branch.id, expires: Date.now() + SSO_TICKET_TTL_MS, used: false });

    const base = (process.env.PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
    res.json({ ok: true, url: `${base}/api/sso/consume?ticket=${token}` });
  } catch (e) {
    console.error("[ERP] sso-ticket error:", e);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

/**
 * GET /api/sso/consume?ticket=  (plain Express route, mounted in _core/index.ts)
 * Validates the one-time ticket, ensures the branch service user
 * (role admin — branch-scoped, passes the existing adminProcedure guard;
 *  username erp_sso_<branchId>, random bcrypt password),
 * creates the native session cookie exactly like tRPC auth.login
 * (same createSession helper), then redirects to /admin.
 */
export async function handleErpSsoConsume(req: Request, res: Response) {
  try {
    const token = String(req.query.ticket || "");
    const ticket = token ? ssoTickets.get(token) : undefined;
    if (token) ssoTickets.delete(token); // single-use — purged on read

    if (!ticket || ticket.used || ticket.expires <= Date.now()) {
      return res.status(403).json({ error: "INVALID_TICKET", message: "تذكرة الدخول غير صالحة أو منتهية — أعد المحاولة من لوحة ERP" });
    }
    ticket.used = true;

    const branch = await db.getBranchById(ticket.branchId);
    if (!branch) {
      return res.status(404).json({ error: "BRANCH_NOT_FOUND", message: "الفرع غير موجود" });
    }

    const username = `erp_sso_${branch.id}`;
    let user = await db.getUserByUsername(username);
    if (!user) {
      await db.createUser({
        username,
        password: randomBytes(24).toString("hex"), // never used to log in directly
        name: `ERP - ${branch.name}`,
        role: "admin",
        branchId: branch.id,
      });
      user = await db.getUserByUsername(username);
    }
    if (!user) {
      return res.status(500).json({ error: "INTERNAL_ERROR", message: "تعذر إنشاء مستخدم الخدمة" });
    }
    if (!user.isActive) {
      return res.status(403).json({ error: "USER_INACTIVE", message: "حساب خدمة ERP معطّل" });
    }

    // نفس آلية إنشاء الجلسة في tRPC auth.login
    await createSession(user.id, user.branchId ?? branch.id, res, req);
    res.redirect(302, "/admin");
  } catch (e) {
    console.error("[ERP] sso consume error:", e);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
}
