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
