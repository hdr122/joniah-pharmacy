/**
 * Xenon External API (v1)
 * ======================
 * REST API for integrating a branch with external systems.
 *
 * Authentication: every request must carry the branch API key
 *   Header:  X-API-Key: xn_xxxxxxxx...   (or  Authorization: Bearer xn_...)
 * Keys are created from the developer panel (branch card → "مفاتيح API").
 *
 * Endpoints (all JSON, scoped to the key's branch):
 *   GET  /api/v1/branch                 branch info
 *   GET  /api/v1/delivery-persons      delivery persons + live status
 *                                       (online/offline, delivering/idle,
 *                                        activeOrders, last location)
 *   GET  /api/v1/regions               regions (id, name, provinceId)
 *   GET  /api/v1/orders                orders (query: status, limit, offset)
 *   GET  /api/v1/orders/:id            single order
 *   POST /api/v1/orders                create order
 *        body: { deliveryPersonId, regionId, price,
 *                address?, note?, locationLink?,
 *                customerName?, customerPhone? }
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import * as db from "./db";

export const publicApiRouter = Router();

// ---- auth -----------------------------------------------------------------

interface ApiRequest extends Request {
  apiBranchId?: number;
  apiKeyName?: string;
}

async function authenticateApiKey(req: ApiRequest, res: Response, next: NextFunction) {
  const header = req.header("x-api-key")
    || (req.header("authorization")?.startsWith("Bearer ")
      ? req.header("authorization")!.slice(7)
      : undefined);

  if (!header || !header.startsWith("xn_")) {
    return res.status(401).json({ error: "missing_api_key", message: "أرسل مفتاح API في الترويسة X-API-Key" });
  }

  const key = await db.resolveApiKey(header);
  if (!key) {
    return res.status(401).json({ error: "invalid_api_key", message: "مفتاح API غير صحيح أو ملغى" });
  }

  req.apiBranchId = key.branchId;
  req.apiKeyName = key.name;
  next();
}

publicApiRouter.use(authenticateApiKey);

// ---- endpoints ------------------------------------------------------------

// Xenon AI config for this branch (POS calls this with its X-API-Key).
// Returns the key only when Xenon AI is enabled for the branch by super-admin.
publicApiRouter.get("/ai-config", async (req: ApiRequest, res: Response) => {
  try {
    const cfg = await db.getXenonAiForBranch(req.apiBranchId!);
    res.json(cfg);
  } catch (e) {
    console.error("[API v1] ai-config error:", e);
    res.status(500).json({ error: "internal_error" });
  }
});

publicApiRouter.get("/branch", async (req: ApiRequest, res: Response) => {
  try {
    const branch = await db.getBranchById(req.apiBranchId!);
    if (!branch) return res.status(404).json({ error: "branch_not_found" });
    res.json({
      id: branch.id,
      name: branch.name,
      code: branch.code,
      address: branch.address,
      phone: branch.phone,
      isActive: branch.isActive === 1,
    });
  } catch (e) {
    console.error("[API v1] branch error:", e);
    res.status(500).json({ error: "internal_error" });
  }
});

publicApiRouter.get("/delivery-persons", async (req: ApiRequest, res: Response) => {
  try {
    const persons = await db.getDeliveryPersonsWithStatus(req.apiBranchId!);
    res.json({ deliveryPersons: persons });
  } catch (e) {
    console.error("[API v1] delivery-persons error:", e);
    res.status(500).json({ error: "internal_error" });
  }
});

// ---- POS integration additions (نظام زينون للمطاعم) ----------------------

// إنشاء مندوب جديد من نظام المطعم — يظهر فوراً في تطبيق المندوب
publicApiRouter.post("/delivery-persons", async (req: ApiRequest, res: Response) => {
  try {
    const { username, password, name, phone, profileImage } = req.body || {};
    if (!username || String(username).length < 3 || !password || String(password).length < 4 || !name || String(name).length < 2) {
      return res.status(400).json({ error: "missing_fields", message: "الحقول المطلوبة: username(3+), password(4+), name(2+)" });
    }
    const existing = await db.getUserByUsername(String(username));
    if (existing) return res.status(400).json({ error: "username_taken", message: "اسم المستخدم محجوز" });
    const created = await db.createUser({
      username: String(username), password: String(password), name: String(name),
      role: "delivery", phone: phone ? String(phone) : undefined,
      profileImage: profileImage ? String(profileImage) : undefined,
      branchId: req.apiBranchId!,
    });
    res.status(201).json({ id: created.id, username, name });
  } catch (e) {
    console.error("[API v1] create delivery-person error:", e);
    res.status(500).json({ error: "internal_error" });
  }
});

// البحث عن زبون برقم الهاتف
publicApiRouter.get("/customers", async (req: ApiRequest, res: Response) => {
  try {
    const phone = String(req.query.phone || "").trim();
    if (!phone) return res.status(400).json({ error: "missing_phone" });
    const customer = await db.getCustomerByPhone(phone, req.apiBranchId!);
    res.json({ customer: customer || null });
  } catch (e) {
    console.error("[API v1] customers lookup error:", e);
    res.status(500).json({ error: "internal_error" });
  }
});

// إنشاء/تحديث زبون مباشرةً (بلا طلب) — مطابقة بالهاتف
publicApiRouter.post("/customers", async (req: ApiRequest, res: Response) => {
  try {
    const { name, phone, address1, notes, regionId } = req.body || {};
    if (!phone) return res.status(400).json({ error: "missing_phone", message: "رقم الهاتف مطلوب" });
    const existing = await db.getCustomerByPhone(String(phone), req.apiBranchId!);
    if (existing) {
      await db.updateCustomer(existing.id, {
        name: name ? String(name) : undefined,
        address1: address1 ? String(address1) : undefined,
        notes: notes ? String(notes) : undefined,
        regionId: regionId ? Number(regionId) : undefined,
      });
      return res.json({ id: existing.id, updated: true });
    }
    const created = await db.createCustomer({
      branchId: req.apiBranchId!,
      name: name ? String(name) : undefined,
      phone: String(phone),
      address1: address1 ? String(address1) : undefined,
      notes: notes ? String(notes) : undefined,
      regionId: regionId ? Number(regionId) : null,
    });
    res.status(201).json({ id: created.id, created: true });
  } catch (e) {
    console.error("[API v1] customers create error:", e);
    res.status(500).json({ error: "internal_error" });
  }
});

publicApiRouter.get("/regions", async (req: ApiRequest, res: Response) => {
  try {
    const regions = await db.getAllRegions(req.apiBranchId!);
    res.json({
      regions: regions.map((r: any) => ({ id: r.id, name: r.name, provinceId: r.provinceId })),
    });
  } catch (e) {
    console.error("[API v1] regions error:", e);
    res.status(500).json({ error: "internal_error" });
  }
});

// قائمة المحافظات
publicApiRouter.get("/provinces", async (req: ApiRequest, res: Response) => {
  try {
    const provinces = await db.getAllProvinces(req.apiBranchId!);
    res.json({ provinces: provinces.map((p: any) => ({ id: p.id, name: p.name })) });
  } catch (e) {
    console.error("[API v1] provinces error:", e);
    res.status(500).json({ error: "internal_error" });
  }
});

// إنشاء منطقة توصيل جديدة — تظهر فوراً في نظام المطعم وفي نظام المندوبين
// مسار توصيل طلب (نقاط GPS) — لعرضه على الخريطة في نظام المطعم
publicApiRouter.get("/orders/:id/route", async (req: ApiRequest, res: Response) => {
  try {
    const orderId = Number(req.params.id);
    if (!orderId) return res.status(400).json({ error: "invalid_id" });
    const order = await db.getOrderById(orderId);
    if (!order || order.branchId !== req.apiBranchId) return res.status(404).json({ error: "order_not_found" });
    const points = await db.getOrderRoutePoints(orderId);
    res.json({
      orderId,
      status: order.status,
      points: (points || []).map((p: any) => ({
        latitude: parseFloat(p.latitude),
        longitude: parseFloat(p.longitude),
        timestamp: p.timestamp || p.createdAt,
      })).filter((p: any) => !isNaN(p.latitude) && !isNaN(p.longitude)),
    });
  } catch (e) {
    console.error("[API v1] order route error:", e);
    res.status(500).json({ error: "internal_error" });
  }
});

publicApiRouter.post("/regions", async (req: ApiRequest, res: Response) => {
  try {
    const branchId = req.apiBranchId!;
    const name = String((req.body && req.body.name) || "").trim();
    if (!name || name.length < 2) return res.status(400).json({ error: "missing_name", message: "اسم المنطقة مطلوب (حرفان على الأقل)" });
    // تفادي التكرار داخل نفس الفرع
    const existingRegions = await db.getAllRegions(branchId);
    const dup = existingRegions.find((r: any) => String(r.name).trim() === name);
    if (dup) return res.status(200).json({ id: dup.id, name: dup.name, provinceId: dup.provinceId, existed: true });
    // المنطقة تحتاج محافظة — استخدم المُعطاة أو أول محافظة أو أنشئ واحدة افتراضية
    let provinceId = Number((req.body && req.body.provinceId) || 0) || 0;
    let provinces = await db.getAllProvinces(branchId);
    if (provinceId) {
      if (!provinces.find((p: any) => p.id === provinceId)) return res.status(400).json({ error: "invalid_province" });
    } else if (provinces.length > 0) {
      provinceId = provinces[0].id;
    } else {
      await db.createProvince("المحافظة", branchId);
      provinces = await db.getAllProvinces(branchId);
      provinceId = provinces[0].id;
    }
    await db.createRegion(name, provinceId, branchId);
    const after = await db.getAllRegions(branchId);
    const created = after.find((r: any) => String(r.name).trim() === name) || after[0];
    res.status(201).json({ id: created.id, name: created.name, provinceId: created.provinceId });
  } catch (e) {
    console.error("[API v1] create region error:", e);
    res.status(500).json({ error: "internal_error" });
  }
});

// إنشاء محافظة جديدة (اختياري)
publicApiRouter.post("/provinces", async (req: ApiRequest, res: Response) => {
  try {
    const branchId = req.apiBranchId!;
    const name = String((req.body && req.body.name) || "").trim();
    if (!name || name.length < 2) return res.status(400).json({ error: "missing_name" });
    const existing = await db.getAllProvinces(branchId);
    const dup = existing.find((p: any) => String(p.name).trim() === name);
    if (dup) return res.status(200).json({ id: dup.id, name: dup.name, existed: true });
    await db.createProvince(name, branchId);
    const after = await db.getAllProvinces(branchId);
    const created = after.find((p: any) => String(p.name).trim() === name) || after[0];
    res.status(201).json({ id: created.id, name: created.name });
  } catch (e) {
    console.error("[API v1] create province error:", e);
    res.status(500).json({ error: "internal_error" });
  }
});

publicApiRouter.get("/orders", async (req: ApiRequest, res: Response) => {
  try {
    const { status, limit, offset } = req.query;
    const orders = await db.getAllOrders({
      branchId: req.apiBranchId!,
      statuses: typeof status === "string" ? status.split(",") : undefined,
      limit: limit ? Math.min(parseInt(String(limit), 10) || 50, 200) : 50,
      offset: offset ? parseInt(String(offset), 10) || 0 : 0,
    });
    res.json({ orders });
  } catch (e) {
    console.error("[API v1] orders list error:", e);
    res.status(500).json({ error: "internal_error" });
  }
});

publicApiRouter.get("/orders/:id", async (req: ApiRequest, res: Response) => {
  try {
    const order = await db.getOrderById(parseInt(req.params.id, 10));
    if (!order || order.branchId !== req.apiBranchId) {
      return res.status(404).json({ error: "order_not_found" });
    }
    res.json({ order });
  } catch (e) {
    console.error("[API v1] order get error:", e);
    res.status(500).json({ error: "internal_error" });
  }
});

publicApiRouter.post("/orders", async (req: ApiRequest, res: Response) => {
  try {
    const {
      deliveryPersonId, regionId, price,
      address, note, locationLink,
      customerName, customerPhone,
    } = req.body || {};

    if (!deliveryPersonId || !regionId || price == null) {
      return res.status(400).json({
        error: "missing_fields",
        message: "الحقول المطلوبة: deliveryPersonId, regionId, price",
      });
    }

    // The delivery person and region must belong to the key's branch
    const person = await db.getUserById(Number(deliveryPersonId));
    if (!person || person.role !== "delivery" || person.branchId !== req.apiBranchId) {
      return res.status(400).json({ error: "invalid_delivery_person", message: "المندوب غير موجود في هذا الفرع" });
    }
    const region = await db.getRegionById(Number(regionId));
    if (!region || region.branchId !== req.apiBranchId) {
      return res.status(400).json({ error: "invalid_region", message: "المنطقة غير موجودة في هذا الفرع" });
    }

    // Optional customer
    let customerId: number | undefined;
    if (customerPhone) {
      const existing = await db.getCustomerByPhone(String(customerPhone), req.apiBranchId!);
      if (existing) {
        customerId = existing.id;
      } else {
        const created = await db.createCustomer({
          branchId: req.apiBranchId!,
          name: customerName ? String(customerName) : undefined,
          phone: String(customerPhone),
        });
        customerId = created.id;
      }
    }

    const order = await db.createOrder({
      branchId: req.apiBranchId!,
      deliveryPersonId: Number(deliveryPersonId),
      regionId: Number(regionId),
      provinceId: region.provinceId,
      price: Number(price),
      address: address ? String(address) : undefined,
      note: note ? String(note) : undefined,
      locationLink: locationLink ? String(locationLink) : undefined,
      customerId,
    });

    res.status(201).json({ order });
  } catch (e) {
    console.error("[API v1] order create error:", e);
    res.status(500).json({ error: "internal_error" });
  }
});

// استقبال مكالمة محللة من نظام المطعم (النص + بيانات الزبون المستخرجة) بعد تحليل الذكاء الاصطناعي
publicApiRouter.post("/call-recording", async (req: ApiRequest, res: Response) => {
  try {
    const { phone, callerName, customerName, area, address, items, notes, transcript, source, audioBase64, mimeType } = req.body || {};
    const { id } = await db.saveCallRecording(req.apiBranchId!, {
      phone: phone != null ? String(phone) : undefined,
      callerName: callerName != null ? String(callerName) : undefined,
      customerName: customerName != null ? String(customerName) : undefined,
      area: area != null ? String(area) : undefined,
      address: address != null ? String(address) : undefined,
      items: items != null ? String(items) : undefined,
      notes: notes != null ? String(notes) : undefined,
      transcript: transcript != null ? String(transcript) : undefined,
      source: source != null ? String(source) : undefined,
      audioBase64: audioBase64 != null ? String(audioBase64) : undefined,
      mimeType: mimeType != null ? String(mimeType) : undefined,
    });
    res.json({ ok: true, id });
  } catch (e) {
    console.error("[API v1] call-recording error:", e);
    res.status(500).json({ error: "internal_error" });
  }
});
