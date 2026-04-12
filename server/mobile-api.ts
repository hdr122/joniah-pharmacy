/**
 * Mobile REST API for Delivery Person Native App
 * These endpoints are used by the Capacitor mobile app
 */
import { Router, Request, Response } from "express";
import * as db from "./db";
import { storagePut } from "./storage";
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./_core/env";
import * as oneSignal from "./onesignal";

const mobileRouter = Router();

// JWT Secret
const getSecret = () => new TextEncoder().encode(ENV.cookieSecret);

// Middleware: Authenticate mobile token
async function authenticateMobile(req: Request, res: Response, next: Function) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "غير مصرح - يرجى تسجيل الدخول" });
    }

    const token = authHeader.split(" ")[1];
    const { payload } = await jwtVerify(token, getSecret());
    
    const userId = payload.userId as number;
    const user = await db.getUserById(userId);
    
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "الحساب غير نشط أو غير موجود" });
    }

    (req as any).user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: "جلسة منتهية - يرجى تسجيل الدخول مرة أخرى" });
  }
}

// Helper
function getBranchId(user: any): number {
  return user.branchId || 1;
}

// ==========================================
// AUTH ENDPOINTS
// ==========================================

// POST /api/mobile/login
mobileRouter.post("/login", async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: "يرجى إدخال اسم المستخدم وكلمة المرور" });
    }

    const user = await db.getUserByUsername(username);
    
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: "هذا الحساب غير نشط" });
    }

    const isValid = await db.verifyPassword(user.passwordHash, password);
    if (!isValid) {
      return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    }

    // Create JWT token for mobile (long-lived - 90 days)
    const token = await new SignJWT({ userId: user.id, branchId: user.branchId })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("90d")
      .sign(getSecret());

    // Log activity
    await db.logActivity({
      branchId: getBranchId(user),
      userId: user.id,
      activityType: "login",
      description: `تسجيل دخول المندوب ${user.name || user.username} من التطبيق`,
    });

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        phone: user.phone,
        profileImage: user.profileImage,
        branchId: user.branchId,
      },
    });
  } catch (error) {
    console.error("[Mobile API] Login error:", error);
    return res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// GET /api/mobile/me
mobileRouter.get("/me", authenticateMobile, async (req: Request, res: Response) => {
  const user = (req as any).user;
  return res.json({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    phone: user.phone,
    profileImage: user.profileImage,
    branchId: user.branchId,
  });
});

// ==========================================
// ORDERS ENDPOINTS
// ==========================================

// GET /api/mobile/orders - Get delivery person's orders
mobileRouter.get("/orders", authenticateMobile, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const status = req.query.status as string | undefined;
    
    const orders = await db.getOrdersByDeliveryPerson(user.id);
    
    // Filter by status if provided
    let filteredOrders = orders;
    if (status) {
      filteredOrders = orders.filter((o: any) => o.status === status);
    }

    return res.json({ orders: filteredOrders });
  } catch (error) {
    console.error("[Mobile API] Orders error:", error);
    return res.status(500).json({ error: "حدث خطأ في جلب الطلبات" });
  }
});

// GET /api/mobile/orders/:id - Get order details
mobileRouter.get("/orders/:id", authenticateMobile, async (req: Request, res: Response) => {
  try {
    const orderId = parseInt(req.params.id);
    const order = await db.getOrderById(orderId);
    
    if (!order) {
      return res.status(404).json({ error: "الطلب غير موجود" });
    }

    return res.json({ order });
  } catch (error) {
    console.error("[Mobile API] Order detail error:", error);
    return res.status(500).json({ error: "حدث خطأ في جلب تفاصيل الطلب" });
  }
});

// POST /api/mobile/orders/:id/accept - Accept order
mobileRouter.post("/orders/:id/accept", authenticateMobile, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orderId = parseInt(req.params.id);
    const { latitude, longitude, accuracy } = req.body;

    const order = await db.getOrderById(orderId);
    if (!order) {
      return res.status(404).json({ error: "الطلب غير موجود" });
    }

    if (order.status !== "pending_approval") {
      return res.status(400).json({ error: "لا يمكن قبول هذا الطلب - الحالة الحالية: " + order.status });
    }

    await db.updateOrderStatus(orderId, "pending", { acceptedAt: new Date() });

    // Save accept location
    if (latitude && longitude) {
      await db.saveOrderLocation({
        branchId: getBranchId(user),
        orderId,
        deliveryPersonId: user.id,
        locationType: "accept",
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        accuracy: accuracy?.toString(),
      });
    }

    // Create notification
    await db.createNotification({
      branchId: getBranchId(user),
      userId: user.id,
      title: "تم قبول الطلب",
      message: `تم قبول الطلب #${orderId}`,
      type: "order_accepted",
    });

    return res.json({ success: true, message: "تم قبول الطلب بنجاح" });
  } catch (error) {
    console.error("[Mobile API] Accept order error:", error);
    return res.status(500).json({ error: "حدث خطأ في قبول الطلب" });
  }
});

// POST /api/mobile/orders/:id/deliver - Mark as delivered
mobileRouter.post("/orders/:id/deliver", authenticateMobile, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orderId = parseInt(req.params.id);
    const { deliveryNote, deliveryLocationName, deliveryLocationUrl, latitude, longitude, accuracy } = req.body;

    const order = await db.getOrderById(orderId);
    if (!order) {
      return res.status(404).json({ error: "الطلب غير موجود" });
    }

    const deliveredAt = new Date();
    const updateData: any = {
      deliveryNote,
      deliveryLocationName,
      deliveredAt,
    };

    // Calculate delivery duration
    if (order.acceptedAt) {
      const acceptedTime = new Date(order.acceptedAt).getTime();
      const deliveredTime = deliveredAt.getTime();
      const durationMs = deliveredTime - acceptedTime;
      updateData.deliveryDuration = Math.floor(durationMs / (1000 * 60));
    }

    // Calculate total duration
    const createdTime = new Date(order.createdAt).getTime();
    const totalMs = deliveredAt.getTime() - createdTime;
    updateData.totalDuration = Math.floor(totalMs / (1000 * 60));

    await db.updateOrderStatus(orderId, "delivered", updateData);

    // Save delivery location
    if (latitude && longitude) {
      await db.saveOrderLocation({
        branchId: getBranchId(user),
        orderId,
        deliveryPersonId: user.id,
        locationType: "deliver",
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        accuracy: accuracy?.toString(),
      });
    }

    // Update customer's last delivery location
    if (order.customerId && deliveryLocationUrl) {
      await db.updateCustomer(order.customerId, {
        lastDeliveryLocation: deliveryLocationUrl,
        lastDeliveryAt: new Date(),
      });
    }

    return res.json({ success: true, message: "تم تسليم الطلب بنجاح" });
  } catch (error) {
    console.error("[Mobile API] Deliver order error:", error);
    return res.status(500).json({ error: "حدث خطأ في تسليم الطلب" });
  }
});

// POST /api/mobile/orders/:id/deliver-image - Upload delivery proof image
mobileRouter.post("/orders/:id/deliver-image", authenticateMobile, async (req: Request, res: Response) => {
  try {
    const orderId = parseInt(req.params.id);
    const { imageBase64, mimeType } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "يرجى إرفاق صورة إثبات التسليم" });
    }

    // Remove data:image/... prefix if present
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const ext = (mimeType || "image/jpeg").split("/")[1] || "jpg";
    const fileKey = `delivery-proofs/${orderId}-${Date.now()}.${ext}`;
    
    const { url } = await storagePut(fileKey, buffer, mimeType || "image/jpeg");
    
    await db.updateOrderStatus(orderId, "delivered", { deliveryImage: url });

    return res.json({ success: true, url });
  } catch (error) {
    console.error("[Mobile API] Upload delivery image error:", error);
    return res.status(500).json({ error: "حدث خطأ في رفع الصورة" });
  }
});

// POST /api/mobile/orders/:id/postpone - Postpone order
mobileRouter.post("/orders/:id/postpone", authenticateMobile, async (req: Request, res: Response) => {
  try {
    const orderId = parseInt(req.params.id);
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: "يرجى إدخال سبب التأجيل" });
    }

    await db.updateOrderStatus(orderId, "postponed", { postponeReason: reason });

    return res.json({ success: true, message: "تم تأجيل الطلب" });
  } catch (error) {
    console.error("[Mobile API] Postpone order error:", error);
    return res.status(500).json({ error: "حدث خطأ في تأجيل الطلب" });
  }
});

// POST /api/mobile/orders/:id/return - Return order
mobileRouter.post("/orders/:id/return", authenticateMobile, async (req: Request, res: Response) => {
  try {
    const orderId = parseInt(req.params.id);
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: "يرجى إدخال سبب الإرجاع" });
    }

    await db.updateOrderStatus(orderId, "returned", { returnReason: reason });

    return res.json({ success: true, message: "تم إرجاع الطلب" });
  } catch (error) {
    console.error("[Mobile API] Return order error:", error);
    return res.status(500).json({ error: "حدث خطأ في إرجاع الطلب" });
  }
});

// ==========================================
// LOCATION TRACKING ENDPOINTS
// ==========================================

// POST /api/mobile/location - Update delivery person location
mobileRouter.post("/location", authenticateMobile, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { latitude, longitude, accuracy, speed, heading, battery } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: "يرجى إرسال الإحداثيات" });
    }

    // Save to delivery_locations table
    await db.saveDeliveryLocation({
      branchId: getBranchId(user),
      deliveryPersonId: user.id,
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      accuracy: accuracy?.toString(),
      speed: speed?.toString(),
      heading: heading?.toString(),
      battery: battery?.toString(),
    });

    // Also update user's last known location
    await db.updateUser(user.id, {
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      lastLocationUpdate: new Date(),
    } as any);

    return res.json({ success: true });
  } catch (error) {
    console.error("[Mobile API] Location update error:", error);
    return res.status(500).json({ error: "حدث خطأ في تحديث الموقع" });
  }
});

// POST /api/mobile/location/batch - Batch location updates (for offline sync)
mobileRouter.post("/location/batch", authenticateMobile, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { locations } = req.body;

    if (!locations || !Array.isArray(locations)) {
      return res.status(400).json({ error: "يرجى إرسال قائمة المواقع" });
    }

    for (const loc of locations) {
      await db.saveDeliveryLocation({
        branchId: getBranchId(user),
        deliveryPersonId: user.id,
        latitude: loc.latitude.toString(),
        longitude: loc.longitude.toString(),
        accuracy: loc.accuracy?.toString(),
        speed: loc.speed?.toString(),
        heading: loc.heading?.toString(),
        battery: loc.battery?.toString(),
      });
    }

    // Update last known location with most recent
    const lastLoc = locations[locations.length - 1];
    if (lastLoc) {
      await db.updateUser(user.id, {
        latitude: lastLoc.latitude.toString(),
        longitude: lastLoc.longitude.toString(),
        lastLocationUpdate: new Date(),
      } as any);
    }

    return res.json({ success: true, count: locations.length });
  } catch (error) {
    console.error("[Mobile API] Batch location error:", error);
    return res.status(500).json({ error: "حدث خطأ في تحديث المواقع" });
  }
});

// POST /api/mobile/route-point - Save route tracking point for active order
mobileRouter.post("/route-point", authenticateMobile, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { orderId, latitude, longitude, accuracy, speed, heading, deviationFromRoute, isOffRoute } = req.body;

    if (!orderId || !latitude || !longitude) {
      return res.status(400).json({ error: "بيانات ناقصة" });
    }

    await db.saveOrderRoutePoint({
      branchId: getBranchId(user),
      orderId,
      deliveryPersonId: user.id,
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      accuracy: accuracy?.toString(),
      speed: speed?.toString(),
      heading: heading?.toString(),
      deviationFromRoute,
      isOffRoute,
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("[Mobile API] Route point error:", error);
    return res.status(500).json({ error: "حدث خطأ في حفظ نقطة المسار" });
  }
});

// ==========================================
// NOTIFICATIONS ENDPOINTS
// ==========================================

// GET /api/mobile/notifications - Get notifications
mobileRouter.get("/notifications", authenticateMobile, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const notifications = await db.getUserNotifications(user.id);
    return res.json({ notifications });
  } catch (error) {
    console.error("[Mobile API] Notifications error:", error);
    return res.status(500).json({ error: "حدث خطأ في جلب الإشعارات" });
  }
});

// POST /api/mobile/notifications/:id/read - Mark notification as read
mobileRouter.post("/notifications/:id/read", authenticateMobile, async (req: Request, res: Response) => {
  try {
    const notificationId = parseInt(req.params.id);
    await db.markNotificationAsRead(notificationId);
    return res.json({ success: true });
  } catch (error) {
    console.error("[Mobile API] Mark notification read error:", error);
    return res.status(500).json({ error: "حدث خطأ" });
  }
});

// POST /api/mobile/fcm-token - Save FCM token for push notifications
mobileRouter.post("/fcm-token", authenticateMobile, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "يرجى إرسال رمز الإشعارات" });
    }

    await db.updateUser(user.id, { fcmToken: token } as any);

    return res.json({ success: true });
  } catch (error) {
    console.error("[Mobile API] FCM token error:", error);
    return res.status(500).json({ error: "حدث خطأ في حفظ رمز الإشعارات" });
  }
});

// ==========================================
// MESSAGES ENDPOINTS
// ==========================================

// GET /api/mobile/messages - Get messages for delivery person
mobileRouter.get("/messages", authenticateMobile, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const messages = await db.getUserMessages(user.id);
    return res.json({ messages });
  } catch (error) {
    console.error("[Mobile API] Messages error:", error);
    return res.status(500).json({ error: "حدث خطأ في جلب الرسائل" });
  }
});

// ==========================================
// PROFILE ENDPOINTS
// ==========================================

// PUT /api/mobile/profile - Update profile
mobileRouter.put("/profile", authenticateMobile, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { name, phone } = req.body;

    await db.updateUser(user.id, { name, phone });

    return res.json({ success: true });
  } catch (error) {
    console.error("[Mobile API] Profile update error:", error);
    return res.status(500).json({ error: "حدث خطأ في تحديث الملف الشخصي" });
  }
});

// POST /api/mobile/profile/image - Upload profile image
mobileRouter.post("/profile/image", authenticateMobile, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { imageBase64, mimeType } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "يرجى إرفاق صورة" });
    }

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const ext = (mimeType || "image/jpeg").split("/")[1] || "jpg";
    const fileKey = `profiles/${user.id}-${Date.now()}.${ext}`;
    
    const { url } = await storagePut(fileKey, buffer, mimeType || "image/jpeg");
    await db.updateUser(user.id, { profileImage: url });

    return res.json({ success: true, url });
  } catch (error) {
    console.error("[Mobile API] Profile image error:", error);
    return res.status(500).json({ error: "حدث خطأ في رفع الصورة" });
  }
});

// POST /api/mobile/change-password - Change password
mobileRouter.post("/change-password", authenticateMobile, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "يرجى إدخال كلمة المرور الحالية والجديدة" });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({ error: "كلمة المرور الجديدة يجب أن تكون 4 أحرف على الأقل" });
    }

    const bcrypt = await import("bcrypt");
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash || "");
    if (!isValid) {
      return res.status(400).json({ error: "كلمة المرور الحالية غير صحيحة" });
    }

    await db.updateUserPassword(user.id, newPassword);

    return res.json({ success: true, message: "تم تغيير كلمة المرور بنجاح" });
  } catch (error) {
    console.error("[Mobile API] Change password error:", error);
    return res.status(500).json({ error: "حدث خطأ في تغيير كلمة المرور" });
  }
});

// ==========================================
// TRACKING STATUS ENDPOINT
// ==========================================

// POST /api/mobile/tracking-status - Update tracking status (started/stopped/permission_denied etc.)
mobileRouter.post("/tracking-status", authenticateMobile, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { status, details } = req.body;

    // Log the tracking status change
    await db.logActivity({
      branchId: getBranchId(user),
      userId: user.id,
      activityType: "status_change",
      description: `تغيير حالة التتبع: ${status}`,
      metadata: { trackingStatus: status, details },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("[Mobile API] Tracking status error:", error);
    return res.status(500).json({ error: "حدث خطأ" });
  }
});

// GET /api/mobile/stats - Get delivery person stats
mobileRouter.get("/stats", authenticateMobile, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orders = await db.getOrdersByDeliveryPerson(user.id);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayOrders = orders.filter((o: any) => new Date(o.createdAt) >= today);
    const delivered = orders.filter((o: any) => o.status === "delivered");
    const todayDelivered = todayOrders.filter((o: any) => o.status === "delivered");
    const pending = orders.filter((o: any) => o.status === "pending" || o.status === "pending_approval");
    
    return res.json({
      totalOrders: orders.length,
      deliveredOrders: delivered.length,
      pendingOrders: pending.length,
      todayOrders: todayOrders.length,
      todayDelivered: todayDelivered.length,
      todayEarnings: todayDelivered.reduce((sum: number, o: any) => sum + (o.deliveryProfit || 0), 0),
    });
  } catch (error) {
    console.error("[Mobile API] Stats error:", error);
    return res.status(500).json({ error: "حدث خطأ في جلب الإحصائيات" });
  }
});

export { mobileRouter };
