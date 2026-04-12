import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { storagePut } from "./storage";
import * as oneSignal from "./onesignal";
import { SignJWT } from "jose";
import { ENV } from "./_core/env";

// Admin-only procedure
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin" && ctx.user.role !== "super_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

// Super Admin-only procedure
const superAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.username !== "HarthHDR1" && ctx.user.role !== "superadmin" && ctx.user.role !== "super_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Super Admin access required" });
  }
  return next({ ctx });
});

// Helper function to get branchId safely (defaults to 1 for العامرية)
function getBranchId(user: { branchId: number | null }): number {
  return user.branchId || 1;
}

// Custom login helper
async function createSession(userId: number, branchId: number | null, res: any, req: any) {
  const secret = new TextEncoder().encode(ENV.cookieSecret);
  const token = await new SignJWT({ userId, branchId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(secret);

  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, token, {
    ...cookieOptions,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });
}

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user),
    
    // Custom login
    login: publicProcedure
      .input(z.object({
        username: z.string(),
        password: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await db.getUserByUsername(input.username);
        
        if (!user || !user.passwordHash) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "اسم المستخدم أو كلمة المرور غير صحيحة" });
        }
        
        if (!user.isActive) {
          throw new TRPCError({ code: "FORBIDDEN", message: "هذا الحساب غير نشط" });
        }
        
        const isValid = await db.verifyPassword(user.passwordHash, input.password);
        
        if (!isValid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "اسم المستخدم أو كلمة المرور غير صحيحة" });
        }
        
        await createSession(user.id, user.branchId, ctx.res, ctx.req);
        
        // تسجيل نشاط تسجيل الدخول (اختياري - لا يوقف تسجيل الدخول عند الفشل)
        db.logActivity({
          branchId: getBranchId(user),
          userId: user.id,
          activityType: 'login',
          description: `تسجيل دخول المستخدم ${user.name || user.username}`,
        }).catch(err => console.warn('[Auth] Activity log failed:', err.message));
        
        return {
          success: true,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
            profileImage: user.profileImage,
          },
        };
      }),
    
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    }),
  }),

  // User Management (Admin only)
  users: router({
    list: adminProcedure.query(async ({ ctx }) => {
      // Super admin يرى جميع المستخدمين
      if (ctx.user.username === 'HarthHDR1' || ctx.user.role === 'super_admin' || ctx.user.role === 'superadmin') {
        return await db.getAllUsers();
      }
      // Admin يرى مستخدمي فرعه فقط
      return await db.getUsersByBranch(getBranchId(ctx.user));
    }),
    
    getDeliveryPersons: adminProcedure.query(async ({ ctx }) => {
      // فلتر المندوبين حسب فرع المستخدم الحالي
      return await db.getDeliveryPersons(getBranchId(ctx.user));
    }),
    
    getDeliveryPerson: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getDeliveryPersonById(input.id);
      }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getUserById(input.id);
      }),
    
    create: adminProcedure
      .input(z.object({
        username: z.string().min(3),
        password: z.string().min(4),
        name: z.string().min(2),
        role: z.enum(["admin", "delivery"]),
        phone: z.string().optional(),
        profileImage: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Check if username exists
        const existing = await db.getUserByUsername(input.username);
        if (existing) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "اسم المستخدم موجود بالفعل" });
        }
        
        // إضافة branchId من المستخدم الحالي
        await db.createUser({
          ...input,
          branchId: ctx.user.branchId
        });
        return { success: true };
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        phone: z.string().optional(),
        profileImage: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Only admin can update others, users can update themselves
        if (ctx.user.role !== "admin" && ctx.user.id !== input.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        
        const { id, ...data } = input;
        await db.updateUser(id, data);
        return { success: true };
      }),
    
    updatePassword: protectedProcedure
      .input(z.object({
        id: z.number(),
        newPassword: z.string().min(4),
      }))
      .mutation(async ({ input, ctx }) => {
        // Only admin can update others' passwords
        if (ctx.user.role !== "admin" && ctx.user.id !== input.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        
        await db.updateUserPassword(input.id, input.newPassword);
        return { success: true };
      }),
    
    updateUsername: adminProcedure
      .input(z.object({
        id: z.number(),
        newUsername: z.string().min(3),
      }))
      .mutation(async ({ input }) => {
        const existing = await db.getUserByUsername(input.newUsername);
        if (existing && existing.id !== input.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "اسم المستخدم موجود بالفعل" });
        }
        
        await db.updateUsername(input.id, input.newUsername);
        return { success: true };
      }),
    
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // Get user info before deletion
        const user = await db.getUserById(input.id);
        
        await db.deleteUser(input.id);
        
        // تسجيل نشاط حذف المستخدم
        await db.logActivity({
          branchId: getBranchId(ctx.user),
          userId: ctx.user.id,
          activityType: 'user_delete',
          description: `حذف المستخدم ${user?.name || user?.username || `#${input.id}`}`,
          metadata: { deletedUserId: input.id, deletedUserName: user?.name, deletedUserRole: user?.role },
        });
        
        return { success: true };
      }),
    
    uploadProfileImage: protectedProcedure
      .input(z.object({
        imageData: z.string(), // base64
        mimeType: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const buffer = Buffer.from(input.imageData, "base64");
        const fileKey = `profiles/${ctx.user.id}-${Date.now()}.${input.mimeType.split("/")[1]}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        
        await db.updateUser(ctx.user.id, { profileImage: url });
        
        return { url };
      }),
    
    changePassword: protectedProcedure
      .input(z.object({
        currentPassword: z.string(),
        newPassword: z.string().min(6),
      }))
      .mutation(async ({ input, ctx }) => {
        // Verify current password
        const user = await db.getUserById(ctx.user.id);
        if (!user) {
          throw new TRPCError({ code: "NOT_FOUND", message: "المستخدم غير موجود" });
        }
        
        const bcrypt = await import("bcrypt");
        const isValid = await bcrypt.compare(input.currentPassword, user.passwordHash || "");
        if (!isValid) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "كلمة المرور الحالية غير صحيحة" });
        }
        
        // Update password
        await db.updateUserPassword(ctx.user.id, input.newPassword);
        return { success: true };
      }),
    
    createAdmin: adminProcedure
      .input(z.object({
        name: z.string().min(2),
        username: z.string().min(3),
        password: z.string().min(4),
        permissions: z.array(z.string()),
      }))
      .mutation(async ({ input, ctx }) => {
        console.log('[createAdmin] Received permissions:', input.permissions);
        console.log('[createAdmin] Current user branchId:', ctx.user.branchId);
        
        const existing = await db.getUserByUsername(input.username);
        if (existing) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "اسم المستخدم موجود بالفعل" });
        }
        
        // تمرير branchId الخاص بالمستخدم الحالي (إلا إذا كان super admin)
        const branchId = (ctx.user.role === 'super_admin' || ctx.user.role === 'superadmin') ? null : ctx.user.branchId;
        await db.createAdminUser({ ...input, branchId });
        console.log('[createAdmin] User created successfully with branchId:', branchId);
        return { success: true };
      }),
    
    updatePermissions: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        username: z.string().optional(),
        password: z.string().optional(),
        permissions: z.array(z.string()),
      }))
      .mutation(async ({ input }) => {
        // تحديث الصلاحيات
        await db.updateUserPermissions(input.id, input.permissions);
        
        // تحديث الاسم إذا تم توفيره
        if (input.name) {
          await db.updateUser(input.id, { name: input.name });
        }
        
        // تحديث اسم المستخدم إذا تم توفيره
        if (input.username) {
          const existing = await db.getUserByUsername(input.username);
          if (existing && existing.id !== input.id) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "اسم المستخدم موجود بالفعل" });
          }
          await db.updateUsername(input.id, input.username);
        }
        
        // تحديث كلمة السر إذا تم توفيرها
        if (input.password) {
          await db.updateUserPassword(input.id, input.password);
        }
        
        return { success: true };
      }),
    
    changeUsername: protectedProcedure
      .input(z.object({
        newUsername: z.string().min(3),
      }))
      .mutation(async ({ input, ctx }) => {
        // Check if username exists
        const existing = await db.getUserByUsername(input.newUsername);
        if (existing && existing.id !== ctx.user.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "اسم المستخدم موجود بالفعل" });
        }
        
        await db.updateUsername(ctx.user.id, input.newUsername);
        return { success: true };
      }),
  }),

  // Region Management
  regions: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getAllRegions(getBranchId(ctx.user));
    }),
    
    getAll: protectedProcedure.query(async ({ ctx }) => {
      return await db.getAllRegions(getBranchId(ctx.user));
    }),
    
    create: adminProcedure
      .input(z.object({ name: z.string().min(2), provinceId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.createRegion(input.name, input.provinceId, getBranchId(ctx.user));
        return { success: true };
      }),
    
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(2),
        provinceId: z.number(),
      }))
      .mutation(async ({ input }) => {
        await db.updateRegion(input.id, input.name, input.provinceId);
        return { success: true };
      }),
    
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteRegion(input.id);
        return { success: true };
      }),
  }),

  // Province Management
  provinces: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getAllProvinces(getBranchId(ctx.user));
    }),
    
    create: adminProcedure
      .input(z.object({ name: z.string().min(2) }))
      .mutation(async ({ input, ctx }) => {
        await db.createProvince(input.name, getBranchId(ctx.user));
        return { success: true };
      }),
    
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(2),
      }))
      .mutation(async ({ input }) => {
        await db.updateProvince(input.id, input.name);
        return { success: true };
      }),
    
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteProvince(input.id);
        return { success: true };
      }),
  }),

  // Order Management
  orders: router({
    list: protectedProcedure
      .input(z.object({ 
        limit: z.number().optional(), 
        offset: z.number().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        statuses: z.array(z.string()).optional(),
        deliveryPersonId: z.number().optional(),
        regionId: z.number().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        // Admin sees all orders, delivery person sees only their orders
        if (ctx.user.role === "admin") {
          // إضافة فلتر الفرع للمسؤولين
          return await db.getAllOrders({ ...input, branchId: getBranchId(ctx.user) });
        } else {
          return await db.getOrdersByDeliveryPerson(ctx.user.id);
        }
      }),
    
    count: protectedProcedure.query(async () => {
      return await db.getOrdersCount();
    }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getOrderById(input.id);
      }),
    
    getDeliveryPersonOrders: adminProcedure
      .input(z.object({ 
        deliveryPersonId: z.number(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getDeliveryPersonOrders(
          input.deliveryPersonId,
          input.startDate ? new Date(input.startDate) : undefined,
          input.endDate ? new Date(input.endDate) : undefined
        );
      }),
    
    getOrderRoute: adminProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ input }) => {
        return await db.getOrderRoute(input.orderId);
      }),
    
    create: protectedProcedure
      .input(
        z.object({
          deliveryPersonId: z.number(),
          regionId: z.number(),
          provinceId: z.number().optional(),
          price: z.number(),
          customerId: z.number().optional(),
          note: z.string().optional(),
          locationLink: z.string().optional(),
          address: z.string().optional(),
          hidePhoneFromDelivery: z.number().optional(),
          customerData: z.object({
            phone: z.string().min(11, "يجب أن يتكون رقم الهاتف من 11 رقم على الأقل").optional(),
            name: z.string().optional(),
            email: z.string().optional(),
            address1: z.string().optional(),
            address2: z.string().optional(),
            locationUrl1: z.string().optional(),
            locationUrl2: z.string().optional(),
            regionId: z.number().optional(),
          }).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Get provinceId from region if not provided
        let provinceId = input.provinceId;
        if (!provinceId) {
          const region = await db.getRegionById(input.regionId);
          if (!region) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "المنطقة غير موجودة" });
          }
          provinceId = region.provinceId;
        }
        
        // Create or find customer if customerData provided
        let customerId = input.customerId;
        if (input.customerData && input.customerData.phone) {
          // Check if customer exists
          const existingCustomer = await db.getCustomerByPhone(input.customerData.phone, getBranchId(ctx.user));
          if (existingCustomer) {
            customerId = existingCustomer.id;
            // Update customer data
            await db.updateCustomer(existingCustomer.id, input.customerData);
          } else {
            // Create new customer
            const newCustomer = await db.createCustomer({
              ...input.customerData,
              branchId: getBranchId(ctx.user),
            });
            customerId = newCustomer.id;
          }
        }
        
        await db.createOrder({
          ...input,
          branchId: getBranchId(ctx.user), // إضافة معرف الفرع
          provinceId,
          customerId,
          hidePhoneFromDelivery: input.hidePhoneFromDelivery || 0,
          createdBy: ctx.user.id, // حفظ معرف المستخدم الذي أنشأ الطلب
        });
        
        // Send notification to delivery person
        await db.createNotification({
          branchId: getBranchId(ctx.user),
          userId: input.deliveryPersonId,
          title: "طلب جديد",
          message: `تم تعيين طلب جديد لك بقيمة ${input.price} دينار`,
          type: "order_assigned",
        });
        
        // Send OneSignal push notification
        const deliveryPerson = await db.getUserById(input.deliveryPersonId);
        if (deliveryPerson && deliveryPerson.name) {
          await oneSignal.notifyNewOrder(
            getBranchId(ctx.user),
            `#${Date.now()}`, // Order number placeholder
            input.deliveryPersonId,
            deliveryPerson.name
          );
        }
        
        // تسجيل نشاط إنشاء الطلب
        await db.logActivity({
          branchId: getBranchId(ctx.user),
          userId: ctx.user.id,
          activityType: 'order_create',
          description: `إنشاء طلب جديد بقيمة ${input.price} دينار`,
          metadata: { price: input.price, regionId: input.regionId, deliveryPersonId: input.deliveryPersonId },
        });
        
        return { success: true };
      }),
    
    updateStatus: protectedProcedure
      .input(z.object({
        orderId: z.number(),
        status: z.enum(["pending", "delivered", "postponed", "cancelled", "returned"]),
        reason: z.string().optional(),
        postponeReason: z.string().optional(),
        returnReason: z.string().optional(),
        deliveryImage: z.string().optional(),
        deliveryNote: z.string().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        accuracy: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { orderId, status, reason, latitude, longitude, accuracy, ...data } = input;
        const id = orderId;
        
        const updateData: any = { ...data };
        
        // Handle reason field - map to postponeReason or returnReason
        if (reason) {
          if (status === "postponed") {
            updateData.postponeReason = reason;
          } else if (status === "returned") {
            updateData.returnReason = reason;
          }
        }
        
        // Get current order to check previous status
        const currentOrder = await db.getOrderById(id);
        
        // Set acceptedAt when status changes from pending_approval to pending
        if (currentOrder?.status === "pending_approval" && status === "pending") {
          updateData.acceptedAt = new Date();
        }
        
        // Set deliveredAt when status changes to delivered
        if (status === "delivered") {
          const deliveredAt = new Date();
          updateData.deliveredAt = deliveredAt;
          
          // Calculate delivery duration (from acceptedAt to deliveredAt)
          if (currentOrder?.acceptedAt) {
            const acceptedTime = new Date(currentOrder.acceptedAt).getTime();
            const deliveredTime = deliveredAt.getTime();
            const durationMs = deliveredTime - acceptedTime;
            updateData.deliveryDuration = Math.floor(durationMs / (1000 * 60)); // Convert to minutes
          }
          
          // Calculate total duration (from createdAt to deliveredAt)
          if (currentOrder?.createdAt) {
            const createdTime = new Date(currentOrder.createdAt).getTime();
            const deliveredTime = deliveredAt.getTime();
            const totalMs = deliveredTime - createdTime;
            updateData.totalDuration = Math.floor(totalMs / (1000 * 60)); // Convert to minutes
          }
          
          // Save delivery location if provided
          if (latitude && longitude && currentOrder?.deliveryPersonId) {
            await db.saveOrderLocation({
              branchId: getBranchId(ctx.user),
              orderId: id,
              deliveryPersonId: currentOrder.deliveryPersonId,
              locationType: "deliver",
              latitude,
              longitude,
              accuracy,
            });
          }
        }
        
        await db.updateOrderStatus(id, status, updateData);
        return { success: true };
      }),
    
    uploadDeliveryImage: protectedProcedure
      .input(z.object({
        orderId: z.number(),
        imageBase64: z.string().optional(), // base64 with data:image/... prefix (optional)
        deliveryNote: z.string().optional(),
        deliveryLocationName: z.string().optional(), // Reverse geocoded location name
        deliveryLocationUrl: z.string().optional(), // Google Maps URL for the delivery location
      }))
      .mutation(async ({ input, ctx }) => {
        let imageUrl: string | undefined;
        
        // معالجة الصورة فقط إذا تم إرسالها
        if (input.imageBase64) {
          // Extract base64 data and mime type from data URL
          const matches = input.imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (!matches || matches.length !== 3) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "صيغة الصورة غير صحيحة" });
          }
          
          const mimeType = matches[1];
          const base64Data = matches[2];
          const buffer = Buffer.from(base64Data, "base64");
          const fileKey = `deliveries/${input.orderId}-${Date.now()}.${mimeType.split("/")[1]}`;
          const { url } = await storagePut(fileKey, buffer, mimeType);
          imageUrl = url;
        }
        
        // Get current order to save delivery location
        const currentOrder = await db.getOrderById(input.orderId);
        
        const deliveredAt = new Date();
        const updateData: any = {
          deliveryImage: imageUrl,
          deliveryNote: input.deliveryNote,
          deliveryLocationName: input.deliveryLocationName,
          deliveredAt,
        };
        
        // Calculate delivery duration (from acceptedAt to deliveredAt)
        if (currentOrder?.acceptedAt) {
          const acceptedTime = new Date(currentOrder.acceptedAt).getTime();
          const deliveredTime = deliveredAt.getTime();
          const durationMs = deliveredTime - acceptedTime;
          updateData.deliveryDuration = Math.floor(durationMs / (1000 * 60)); // Convert to minutes
        }
        
        // Calculate total duration (from createdAt to deliveredAt)
        if (currentOrder?.createdAt) {
          const createdTime = new Date(currentOrder.createdAt).getTime();
          const deliveredTime = deliveredAt.getTime();
          const totalMs = deliveredTime - createdTime;
          updateData.totalDuration = Math.floor(totalMs / (1000 * 60)); // Convert to minutes
        }
        
        await db.updateOrderStatus(input.orderId, "delivered", updateData);
        
        // Update customer's last delivery location if customer exists
        if (currentOrder?.customerId && input.deliveryLocationUrl) {
          await db.updateCustomer(currentOrder.customerId, {
            lastDeliveryLocation: input.deliveryLocationUrl,
            lastDeliveryAt: new Date(),
          });
        }
        
        return { url: imageUrl };
      }),
    
    reassign: adminProcedure
      .input(z.object({
        orderId: z.number(),
        newDeliveryPersonId: z.number(),
      }))
      .mutation(async ({ input }) => {
        await db.reassignOrder(input.orderId, input.newDeliveryPersonId);
        return { success: true };
      }),
    
    update: adminProcedure
      .input(z.object({
        orderId: z.number(),
        deliveryPersonId: z.number().optional(),
        price: z.number().optional(),
        customerId: z.number().optional(),
        note: z.string().optional(),
        regionId: z.number().optional(),
        provinceId: z.number().optional(),
        address: z.string().optional(),
        locationLink: z.string().optional(),
        hidePhoneFromDelivery: z.number().optional(),
        customerPhone: z.string().optional(),
        customerName: z.string().optional(),
        status: z.enum(['pending_approval','pending','delivered','postponed','cancelled','returned']).optional(),
        deliveryProfit: z.number().optional(),
        customerData: z.object({
          name: z.string().optional(),
          email: z.string().optional(),
          address1: z.string().optional(),
          address2: z.string().optional(),
          locationUrl1: z.string().optional(),
          locationUrl2: z.string().optional(),
        }).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { orderId, ...updateData } = input;
        
        // Get current order
        const currentOrder = await db.getOrderById(orderId);
        if (!currentOrder) {
          throw new TRPCError({ code: "NOT_FOUND", message: "الطلب غير موجود" });
        }
        
        // السماح بتعديل جميع الطلبات بما فيها المسلمة
        
        // تسجيل من قام بتغيير الحالة إلى delivered
        const finalUpdateData: any = { ...updateData };
        if (input.status === 'delivered' && currentOrder.status !== 'delivered') {
          finalUpdateData.deliveredByAdmin = ctx.user.id;
          finalUpdateData.deliveredByAdminUsername = ctx.user.username || ctx.user.name || 'مسؤول';
          finalUpdateData.deliveredAt = new Date().toISOString();
        }
        
        // Send OneSignal notification if status changed
        if (input.status && input.status !== currentOrder.status && currentOrder.deliveryPersonId) {
          const deliveryPerson = await db.getUserById(currentOrder.deliveryPersonId);
          if (deliveryPerson && deliveryPerson.name) {
            await oneSignal.notifyOrderStatusChange(
              getBranchId(ctx.user),
              `#${orderId}`,
              currentOrder.deliveryPersonId,
              deliveryPerson.name,
              input.status
            );
          }
        }
        
        // Update order
        await db.updateOrder(orderId, finalUpdateData);
        
        // Send OneSignal notification if order was updated
        if (currentOrder.deliveryPersonId) {
          const deliveryPerson = await db.getUserById(currentOrder.deliveryPersonId);
          if (deliveryPerson && deliveryPerson.name) {
            const updateDetails = [];
            if (input.price && input.price !== currentOrder.price) updateDetails.push(`السعر: ${input.price}`);
            if (input.address && input.address !== currentOrder.address) updateDetails.push('تغيير العنوان');
            if (input.note) updateDetails.push('إضافة ملاحظة');
            
            if (updateDetails.length > 0) {
              await oneSignal.notifyOrderUpdate(
                getBranchId(ctx.user),
                `#${orderId}`,
                currentOrder.deliveryPersonId,
                deliveryPerson.name,
                updateDetails.join('، ')
              );
            }
          }
        }
        
        // Send notifications
        if (input.deliveryPersonId && input.deliveryPersonId !== currentOrder.deliveryPersonId) {
          // Notify old delivery person
          if (currentOrder.deliveryPersonId) {
            await db.createNotification({
              branchId: getBranchId(ctx.user),
              userId: currentOrder.deliveryPersonId,
              title: "نقل طلب",
              message: `تم نقل الطلب #${orderId} إلى مندوب آخر`,
              type: "general",
            });
          }
          
          // Notify new delivery person
          await db.createNotification({
            branchId: getBranchId(ctx.user),
            userId: input.deliveryPersonId,
            title: "طلب منقول",
            message: `تم نقل الطلب #${orderId} إليك`,
            type: "order_assigned",
          });
          
          // Send OneSignal push notification to new delivery person
          const newDeliveryPerson = await db.getUserById(input.deliveryPersonId);
          if (newDeliveryPerson && newDeliveryPerson.name) {
            await oneSignal.notifyOrderReassign(
              getBranchId(ctx.user),
              `#${orderId}`,
              input.deliveryPersonId,
              newDeliveryPerson.name
            );
          }
        }
        
        if (input.price && input.price !== currentOrder.price) {
          // Notify delivery person about price change
          if (currentOrder.deliveryPersonId) {
            await db.createNotification({
              branchId: getBranchId(ctx.user),
              userId: currentOrder.deliveryPersonId,
              title: "تغيير السعر",
              message: `تم تغيير سعر الطلب #${orderId} من ${currentOrder.price} إلى ${input.price} دينار`,
              type: "general",
            });
          }
        }
        
        if (input.customerId && input.customerId !== currentOrder.customerId) {
          // Notify delivery person about customer change
          if (currentOrder.deliveryPersonId) {
            const newCustomer = await db.getCustomerById(input.customerId, getBranchId(ctx.user));
            await db.createNotification({
              branchId: getBranchId(ctx.user),
              userId: currentOrder.deliveryPersonId,
              title: "تغيير الزبون",
              message: `تم تغيير زبون الطلب #${orderId} إلى ${newCustomer?.name || "زبون جديد"}`,
              type: "general",
            });
          }
        }
        
        // تحديث بيانات الزبون إذا كانت موجودة
        if (currentOrder.customerId) {
          const customerUpdates: any = {};
          
          // تحديث من customerData إذا كان موجوداً
          if (input.customerData) {
            Object.assign(customerUpdates, input.customerData);
          }
          
          // تحديث رقم الهاتف والاسم إذا كانا موجودين
          if (input.customerPhone !== undefined) {
            customerUpdates.phone = input.customerPhone;
          }
          if (input.customerName !== undefined) {
            customerUpdates.name = input.customerName;
          }
          
          // تحديث بيانات الزبون في قاعدة البيانات
          if (Object.keys(customerUpdates).length > 0) {
            await db.updateCustomer(currentOrder.customerId, customerUpdates);
          }
        }
        
        // تسجيل نشاط تعديل الطلب
        await db.logActivity({
          branchId: getBranchId(ctx.user),
          userId: ctx.user.id,
          activityType: 'order_update',
          description: `تعديل الطلب #${orderId}`,
          metadata: { orderId, changes: updateData },
        });
        
        return { success: true };
      }),
    
    getByDelivery: protectedProcedure
      .input(z.object({ deliveryId: z.number() }))
      .query(async ({ ctx, input }) => {
        // Only admin can view other delivery persons' orders
        if (ctx.user.role !== "admin" && ctx.user.id !== input.deliveryId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }
        return await db.getOrdersByDeliveryPerson(input.deliveryId);
      }),
    
    acceptOrder: protectedProcedure
      .input(z.object({ 
        orderId: z.number(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        accuracy: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Only delivery person can accept their orders
        const order = await db.getOrderById(input.orderId);
        if (!order || order.deliveryPersonId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }
        
        await db.updateOrderStatus(input.orderId, "pending", {
          acceptedAt: new Date(),
        });
        
        // Save accept location if provided
        if (input.latitude && input.longitude) {
          await db.saveOrderLocation({
            branchId: getBranchId(ctx.user),
            orderId: input.orderId,
            deliveryPersonId: ctx.user.id,
            locationType: "accept",
            latitude: input.latitude,
            longitude: input.longitude,
            accuracy: input.accuracy,
          });
        }
        
        // Notify admin
        const adminUsers = await db.getUsersByRole("admin");
        for (const admin of adminUsers) {
          await db.createNotification({
            branchId: getBranchId(ctx.user),
            userId: admin.id,
            title: "قبول طلب",
            message: `قبل ${ctx.user.name} الطلب #${input.orderId}`,
            type: "order_accepted",
          });
        }
        
        return { success: true };
      }),
    
    rejectOrder: protectedProcedure
      .input(z.object({ 
        orderId: z.number(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Only delivery person can reject their orders
        const order = await db.getOrderById(input.orderId);
        if (!order || order.deliveryPersonId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }
        
        await db.updateOrderStatus(input.orderId, "cancelled", {
          postponeReason: input.reason || "رفض المندوب",
        });
        
        // Notify admin
        const adminUsers = await db.getUsersByRole("admin");
        for (const admin of adminUsers) {
          await db.createNotification({
            branchId: getBranchId(ctx.user),
            userId: admin.id,
            title: "رفض طلب",
            message: `رفض ${ctx.user.name} الطلب #${input.orderId}${input.reason ? ': ' + input.reason : ''}`,
            type: "order_rejected",
          });
        }
        
        return { success: true };
      }),
    
    // إرسال ملاحظة من المندوب للإدارة
    sendAdminNote: protectedProcedure
      .input(z.object({
        orderId: z.number(),
        note: z.string().min(1, "الرجاء إدخال الملاحظة"),
      }))
      .mutation(async ({ ctx, input }) => {
        // Get order details
        const order = await db.getOrderById(input.orderId);
        if (!order) {
          throw new TRPCError({ code: "NOT_FOUND", message: "الطلب غير موجود" });
        }
        
        // Verify the delivery person owns this order
        if (order.deliveryPersonId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك إرسال ملاحظة على هذا الطلب" });
        }
        
        // Get customer info
        const customer = order.customerId ? await db.getCustomerById(order.customerId, getBranchId(ctx.user)) : null;
        
        // Notify all admins
        const adminUsers = await db.getUsersByRole("admin");
        for (const admin of adminUsers) {
          await db.createNotification({
            branchId: getBranchId(ctx.user),
            userId: admin.id,
            title: `ملاحظة من المندوب - طلب #${input.orderId}`,
            message: `المندوب: ${ctx.user.name}\nالزبون: ${customer?.name || 'غير محدد'}\nالملاحظة: ${input.note}`,
            type: "general",
          });
        }
        
        return { success: true };
      }),
    
    deleteOrder: adminProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Get order details before deletion for activity log
        const order = await db.getOrderWithRoute(input.orderId);
        
        await db.deleteOrder(input.orderId, ctx.user.id);
        
        // Log the delete activity
        await db.logActivity({
          branchId: getBranchId(ctx.user),
          userId: ctx.user.id,
          activityType: 'order_delete',
          description: `حذف طلب #${input.orderId} - ${order?.customerName || 'زبون'}`,
          metadata: {
            orderId: input.orderId,
            customerName: order?.customerName || null,
            customerPhone: order?.customerPhone || null,
            status: order?.status || null,
          },
        });
        
        return { success: true };
      }),
    
    listDeleted: adminProcedure.query(async ({ ctx }) => {
      // Super admin يرى جميع البيانات، Admin يرى بيانات فرعه فقط
      const branchId = (ctx.user.role === 'super_admin' || ctx.user.username === 'HarthHDR1') ? null : ctx.user.branchId;
      return await db.getDeletedOrders(branchId);
    }),
    
    restoreOrder: adminProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ input }) => {
        await db.restoreOrder(input.orderId);
        return { success: true };
      }),
    
    reactivatePostponedOrder: adminProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ input }) => {
        // Change status from postponed to pending_approval
        await db.updateOrderStatus(input.orderId, "pending_approval", {
          postponeReason: undefined,
        });
        return { success: true };
      }),
    
    // Export orders to Excel with filters - moved to Express endpoint /api/orders/export
    
    // Get order with route information
    getWithRoute: adminProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ input }) => {
        const order = await db.getOrderWithRoute(input.orderId);
        return order;
      }),
  }),

  // Statistics
  stats: router({
    dashboard: adminProcedure.query(async ({ ctx }) => {
      // Super admin يرى جميع البيانات، Admin يرى بيانات فرعه فقط
      const branchId = (ctx.user.role === 'super_admin' || ctx.user.username === 'HarthHDR1') ? null : ctx.user.branchId;
      return await db.getDashboardStats(branchId);
    }),
    
    byRegion: adminProcedure.query(async ({ ctx }) => {
      // Super admin يرى جميع البيانات، Admin يرى بيانات فرعه فقط
      const branchId = (ctx.user.role === 'super_admin' || ctx.user.username === 'HarthHDR1') ? null : ctx.user.branchId;
      return await db.getOrderStatsByRegion(branchId);
    }),
    
    byDeliveryPerson: protectedProcedure
      .input(z.object({ deliveryPersonId: z.number() }))
      .query(async ({ input }) => {
        return await db.getDeliveryPersonStats(input.deliveryPersonId);
      }),
    
    allDeliveryPersons: adminProcedure.query(async ({ ctx }) => {
      // Super admin يرى جميع البيانات، Admin يرى بيانات فرعه فقط
      const branchId = (ctx.user.role === 'super_admin' || ctx.user.username === 'HarthHDR1') ? null : ctx.user.branchId;
      return await db.getAllDeliveryPersonsStats(branchId);
    }),
    
    advanced: adminProcedure.query(async ({ ctx }) => {
      // Super admin يرى جميع البيانات، Admin يرى بيانات فرعه فقط
      const branchId = (ctx.user.role === 'super_admin' || ctx.user.username === 'HarthHDR1') ? null : ctx.user.branchId;
      return await db.getAdvancedStats(branchId);
    }),
    
    custom: adminProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        regionIds: z.array(z.number()).optional(),
        provinceIds: z.array(z.number()).optional(),
        deliveryPersonIds: z.array(z.number()).optional(),
      }))
      .query(async ({ input, ctx }) => {
        // Super admin يرى جميع البيانات، Admin يرى بيانات فرعه فقط
        const branchId = (ctx.user.role === 'super_admin' || ctx.user.username === 'HarthHDR1') ? null : ctx.user.branchId;
        return await db.getCustomStats({ ...input, branchId });
      }),
    
    // Save daily snapshot
    saveDailySnapshot: adminProcedure
      .mutation(async ({ ctx }) => {
        return await db.saveDailyStatsSnapshot(getBranchId(ctx.user));
      }),
    
    // Get today's stats
    today: adminProcedure.query(async ({ ctx }) => {
      // Super admin يرى جميع البيانات، Admin يرى بيانات فرعه فقط
      const branchId = (ctx.user.role === 'super_admin' || ctx.user.username === 'HarthHDR1') ? null : ctx.user.branchId;
      return await db.getTodayStats(branchId);
    }),
    
    // Get all-time stats
    allTime: adminProcedure.query(async ({ ctx }) => {
      // Super admin يرى جميع البيانات، Admin يرى بيانات فرعه فقط
      const branchId = (ctx.user.role === 'super_admin' || ctx.user.username === 'HarthHDR1') ? null : ctx.user.branchId;
      return await db.getDashboardStats(branchId);
    }),
    
    // Get specific day stats
    specificDay: adminProcedure
      .input(z.object({
        month: z.number().min(1).max(12),
        day: z.number().min(1).max(31),
        year: z.number().optional(),
      }))
      .query(async ({ input, ctx }) => {
        // Super admin يرى جميع البيانات، Admin يرى بيانات فرعه فقط
        const branchId = (ctx.user.role === 'super_admin' || ctx.user.username === 'HarthHDR1') ? null : ctx.user.branchId;
        return await db.getSpecificDayStats(input.month, input.day, input.year, branchId);
      }),
    
    // Get stats by date range
    byDateRange: adminProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
      }))
      .query(async ({ input, ctx }) => {
        // تمرير branchId للمستخدمين العاديين، وعدم تمريره لـ super admin
        const branchId = ctx.user.role === 'super_admin' || ctx.user.role === 'superadmin' ? undefined : ctx.user.branchId;
        return await db.getStatsByDateRange(input.startDate, input.endDate, branchId);
      }),
  }),

  // Notifications
  notifications: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserNotifications(ctx.user.id);
    }),
    
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUnreadNotificationsCount(ctx.user.id);
    }),
    
    markAsRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.markNotificationAsRead(input.id);
        return { success: true };
      }),
    
    getByUser: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ ctx, input }) => {
        // Only admin can view other users' notifications
        if (ctx.user.role !== "admin" && ctx.user.id !== input.userId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }
        return await db.getUserNotifications(input.userId);
      }),
    
    markAllAsRead: protectedProcedure
      .mutation(async ({ ctx }) => {
        await db.markAllNotificationsAsRead(ctx.user.id);
        return { success: true };
      }),
    
    // Update FCM token for push notifications
    updateFcmToken: protectedProcedure
      .input(z.object({ fcmToken: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await db.updateUser(ctx.user.id, { fcmToken: input.fcmToken });
        return { success: true };
      }),
  }),

  // Messages
  messages: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserMessages(ctx.user.id);
    }),
    
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUnreadMessagesCount(ctx.user.id);
    }),
    
    send: adminProcedure
      .input(z.object({
        receiverId: z.number().optional(),
        title: z.string(),
        content: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createMessage({
          branchId: getBranchId(ctx.user),
          senderId: ctx.user.id,
          ...input,
        });
        
        // إرسال إشعار للمندوب/المندوبين
        if (input.receiverId) {
          // رسالة لمندوب محدد
          await db.createNotification({
            branchId: getBranchId(ctx.user),
            userId: input.receiverId,
            type: "message",
            title: input.title,
            message: input.content,
          });
          // إرسال push notification
          await db.sendPushNotification(input.receiverId, {
            title: input.title,
            body: input.content,
            data: { type: 'message', url: '/delivery/messages' },
          });
        } else {
          // رسالة لجميع المندوبين
          const deliveries = await db.getUsersByRole("delivery");
          for (const delivery of deliveries) {
            await db.createNotification({
              branchId: getBranchId(ctx.user),
              userId: delivery.id,
              type: "message",
              title: input.title,
              message: input.content,
            });
            // إرسال push notification
            await db.sendPushNotification(delivery.id, {
              title: input.title,
              body: input.content,
              data: { type: 'message', url: '/delivery/messages' },
            });
          }
        }
        
        return { success: true };
      }),
    
    markAsRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.markMessageAsRead(input.id);
        return { success: true };
      }),
  }),

  // Customers Management
  customers: router({
    create: adminProcedure
      .input(z.object({
        name: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        address1: z.string().optional(),
        address2: z.string().optional(),
        locationUrl1: z.string().optional(),
        locationUrl2: z.string().optional(),
        notes: z.string().optional(),
        regionId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.createCustomer({
          ...input,
          branchId: getBranchId(ctx.user),
        });
        return { success: true };
      }),
    
    getByPhone: protectedProcedure
      .input(z.object({ phone: z.string() }))
      .query(async ({ input, ctx }) => {
        return await db.getCustomerByPhone(input.phone, getBranchId(ctx.user));
      }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        return await db.getCustomerById(input.id, getBranchId(ctx.user));
      }),
    
    list: protectedProcedure.query(async ({ ctx }) => {
      // فلتر العملاء حسب فرع المستخدم الحالي
      return await db.getAllCustomers(getBranchId(ctx.user));
    }),
    
    search: protectedProcedure
      .input(z.object({ 
        query: z.string(),
        spentRange: z.enum(['under50k', '50k-100k', '100k-500k', 'over500k']).optional(),
        orderStatus: z.enum(['delivered', 'returned', 'cancelled', 'postponed']).optional()
      }))
      .query(async ({ input, ctx }) => {
        return await db.searchCustomers(input.query, getBranchId(ctx.user), input.spentRange, input.orderStatus);
      }),
    
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        address1: z.string().optional(),
        address2: z.string().optional(),
        locationUrl1: z.string().optional(),
        locationUrl2: z.string().optional(),
        notes: z.string().optional(),
        regionId: z.number().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateCustomer(id, data);
        return { success: true };
      }),
    
    getOrders: protectedProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => {
        return await db.getCustomerOrders(input.customerId);
      }),
    
    getStats: protectedProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => {
        return await db.getCustomerStats(input.customerId);
      }),
    
    // Filter customers by order count
    filterByOrderCount: adminProcedure
      .input(z.object({
        operator: z.enum(['gt', 'lt', 'eq']),
        count: z.number(),
      }))
      .query(async ({ input, ctx }) => {
        return await db.getCustomersByOrderCount(input, getBranchId(ctx.user));
      }),
    
    // Get inactive customers
    getInactive: adminProcedure
      .input(z.object({
        days: z.number().optional(),
        months: z.number().optional(),
        sinceDate: z.string().optional(),
      }))
      .query(async ({ input, ctx }) => {
        return await db.getInactiveCustomers(input, getBranchId(ctx.user));
      }),
    
    // Get customers with combined filters
    filterAdvanced: adminProcedure
      .input(z.object({
        orderCountOperator: z.enum(['gt', 'lt', 'eq']).optional(),
        orderCount: z.number().optional(),
        inactiveDays: z.number().optional(),
        inactiveMonths: z.number().optional(),
        inactiveSinceDate: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getCustomersWithFilters(input);
      }),
  }),

  // Advanced Reports
  reports: router({
    incompleteOrders: adminProcedure.query(async ({ ctx }) => {
      // Super admin يرى جميع البيانات، Admin يرى بيانات فرعه فقط
      const branchId = (ctx.user.role === 'super_admin' || ctx.user.username === 'HarthHDR1') ? null : ctx.user.branchId;
      return await db.getIncompleteOrdersReport(branchId);
    }),
    
    monthlyPerformance: adminProcedure
      .input(z.object({ year: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        // Super admin يرى جميع البيانات، Admin يرى بيانات فرعه فقط
        const branchId = (ctx.user.role === 'super_admin' || ctx.user.username === 'HarthHDR1') ? null : ctx.user.branchId;
        return await db.getMonthlyPerformance(input.year, branchId);
      }),
    
    deliverySpeed: adminProcedure
      .input(z.object({ deliveryPersonId: z.number().optional() }))
      .query(async ({ input }) => {
        return await db.getDeliverySpeedStats(input.deliveryPersonId);
      }),
    
    enhancedPerformance: adminProcedure
      .input(z.object({ deliveryPersonId: z.number() }))
      .query(async ({ input }) => {
        return await db.getEnhancedDeliveryPerformance(input.deliveryPersonId);
      }),
  }),

  // Location Tracking
  location: router({
    update: protectedProcedure
      .input(z.object({
        latitude: z.string(),
        longitude: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateUserLocation(ctx.user.id, input.latitude, input.longitude);
        return { success: true };
      }),
    
    getAllDeliveries: adminProcedure.query(async () => {
      return await db.getAllDeliveryLocations();
    }),
  }),

  // GPS Tracking endpoints
  gps: router({
    // Save route tracking point for active order
    saveRoutePoint: protectedProcedure
      .input(z.object({
        orderId: z.number(),
        latitude: z.string(),
        longitude: z.string(),
        accuracy: z.string().optional(),
        speed: z.string().optional(),
        heading: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Only delivery persons can save route points
        if (ctx.user.role !== 'delivery') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only delivery persons can save route points' });
        }
        
        await db.saveOrderRoutePoint({
          branchId: getBranchId(ctx.user),
          orderId: input.orderId,
          deliveryPersonId: ctx.user.id,
          latitude: input.latitude,
          longitude: input.longitude,
          accuracy: input.accuracy,
          speed: input.speed,
          heading: input.heading,
        });
        
        return { success: true };
      }),
    
    // Get route points for an order
    getOrderRoute: protectedProcedure
      .input(z.object({
        orderId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        return await db.getOrderRoutePoints(input.orderId);
      }),

    // Save delivery person location (called automatically from delivery app)
    saveLocation: protectedProcedure
      .input(z.object({
        latitude: z.string(),
        longitude: z.string(),
        accuracy: z.string().optional(),
        speed: z.string().optional(),
        heading: z.string().optional(),
        battery: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Only delivery persons can save their location
        if (ctx.user.role !== 'delivery') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only delivery persons can save location' });
        }
        
        await db.saveDeliveryLocation({
          branchId: getBranchId(ctx.user),
          deliveryPersonId: ctx.user.id,
          latitude: input.latitude,
          longitude: input.longitude,
          accuracy: input.accuracy,
          speed: input.speed,
          heading: input.heading,
          battery: input.battery,
        });
        
        return { success: true };
      }),
    
    // Get all active delivery locations (admin only)
    getActiveLocations: adminProcedure.query(async () => {
      return await db.getActiveDeliveryLocations();
    }),
    
    // Get location history for a delivery person
    getLocationHistory: protectedProcedure
      .input(z.object({
        deliveryPersonId: z.number(),
        hours: z.number().optional().default(24),
      }))
      .query(async ({ ctx, input }) => {
        // Admin can view any delivery person's history
        // Delivery person can only view their own history
        if (ctx.user.role !== 'admin' && ctx.user.id !== input.deliveryPersonId) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot view other delivery person location' });
        }
        
        return await db.getDeliveryLocationHistory(input.deliveryPersonId, input.hours);
      }),
    
    // Get active orders with delivery locations (admin only)
    getActiveOrdersWithLocations: adminProcedure.query(async () => {
      return await db.getActiveOrdersWithLocations();
    }),
    
    // Traccar webhook endpoint (public, for external GPS apps)
    // Traccar Client will send data in OsmAnd format: ?id=DEVICE_ID&lat=LAT&lon=LON&timestamp=UNIX&speed=SPEED&bearing=HEADING&altitude=ALT&accuracy=ACC&batt=BATTERY
    traccarWebhook: publicProcedure
      .input(z.object({
        id: z.string(), // Device ID (username of delivery person)
        lat: z.string(),
        lon: z.string(),
        timestamp: z.string().optional(),
        speed: z.string().optional(),
        bearing: z.string().optional(),
        accuracy: z.string().optional(),
        batt: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // Find delivery person by username (device ID)
        const deliveryPerson = await db.getUserByUsername(input.id);
        
        if (!deliveryPerson || deliveryPerson.role !== 'delivery') {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Delivery person not found' });
        }
        
        // Save location
        await db.saveDeliveryLocation({
          branchId: deliveryPerson.branchId || 1,
          deliveryPersonId: deliveryPerson.id,
          deviceId: input.id,
          latitude: input.lat,
          longitude: input.lon,
          accuracy: input.accuracy,
          speed: input.speed,
          heading: input.bearing,
          battery: input.batt,
        });
        
        return { success: true };
      }),
    
    // Get Traccar statistics (admin only)
    getTraccarStats: adminProcedure.query(async () => {
      const deliveryPersons = await db.getDeliveryPersons();
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      const deliveries = await Promise.all(
        deliveryPersons.map(async (person) => {
          const locations = await db.getDeliveryLocationHistory(person.id, 24);
          const lastLocation = locations[0];
          const isOnline = lastLocation && new Date(lastLocation.createdAt) > fiveMinutesAgo;
          
          // Calculate distance today
          const todayLocations = locations.filter(l => new Date(l.createdAt) >= todayStart);
          let distanceToday = 0;
          for (let i = 1; i < todayLocations.length; i++) {
            const prev = todayLocations[i - 1];
            const curr = todayLocations[i];
            const lat1 = parseFloat(prev.latitude);
            const lon1 = parseFloat(prev.longitude);
            const lat2 = parseFloat(curr.latitude);
            const lon2 = parseFloat(curr.longitude);
            
            // Haversine formula
            const R = 6371; // Earth radius in km
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                      Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            distanceToday += R * c;
          }
          
          return {
            userId: person.id,
            username: person.username,
            isOnline,
            lastUpdate: lastLocation ? new Date(lastLocation.createdAt).toLocaleString('ar-IQ') : null,
            latitude: lastLocation?.latitude,
            longitude: lastLocation?.longitude,
            speed: lastLocation?.speed,
            distanceToday,
          };
        })
      );
      
      const totalDistanceToday = deliveries.reduce((sum, d) => sum + d.distanceToday, 0);
      
      return {
        totalDeliveries: deliveryPersons.length,
        deliveries,
        totalDistanceToday,
      };
    }),
    
    // Update Traccar credentials for a delivery person
    updateTraccarCredentials: adminProcedure
      .input(z.object({
        deliveryPersonId: z.number(),
        traccarUsername: z.string(),
        traccarPassword: z.string(),
      }))
      .mutation(async ({ input }) => {
        await db.updateDeliveryPerson(input.deliveryPersonId, {
          traccarUsername: input.traccarUsername,
          traccarPassword: input.traccarPassword,
        });
        return { success: true };
      }),
    
    // Test Traccar connection for a delivery person
    testTraccarConnection: adminProcedure
      .input(z.object({
        deliveryPersonId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const result = await db.testTraccarConnection(input.deliveryPersonId);
        return result;
      }),
    
    // Get monthly distances report
    getMonthlyDistances: adminProcedure
      .input(z.object({
        year: z.number(),
        month: z.number().min(1).max(12),
      }))
      .query(async ({ input, ctx }) => {
        // Super admin يرى جميع البيانات، Admin يرى بيانات فرعه فقط
        const branchId = (ctx.user.role === 'super_admin' || ctx.user.username === 'HarthHDR1') ? null : ctx.user.branchId;
        const result = await db.getMonthlyDistances(input.year, input.month, branchId);
        return result;
      }),
    
    // Get Traccar devices for a delivery person
    getTraccarDevices: adminProcedure
      .input(z.object({
        deliveryPersonId: z.number(),
      }))
      .query(async ({ input }) => {
        const devices = await db.getTraccarDevices(input.deliveryPersonId);
        return devices;
      }),
    
    // Get Traccar positions for a delivery person
    getTraccarPositions: adminProcedure
      .input(z.object({
        deliveryPersonId: z.number(),
      }))
      .query(async ({ input }) => {
        const positions = await db.getTraccarPositions(input.deliveryPersonId);
        return positions;
      }),
    
    // Get Traccar route for a device and time range
    getTraccarRoute: adminProcedure
      .input(z.object({
        deliveryPersonId: z.number(),
        deviceId: z.number(),
        from: z.date(),
        to: z.date(),
      }))
      .query(async ({ input }) => {
        const route = await db.getTraccarRoute(
          input.deliveryPersonId,
          input.deviceId,
          input.from,
          input.to
        );
        return route;
      }),
    
    // Get all Traccar status (all delivery persons)
    getAllTraccarStatus: adminProcedure.query(async () => {
      const statuses = await db.getAllTraccarStatus();
      return statuses;
    }),
    
    // Get delivery route by time range
    getDeliveryRoute: adminProcedure
      .input(z.object({
        userId: z.number(),
        date: z.string(),
        hours: z.number().optional().default(0),
      }))
      .query(async ({ input }) => {
        const route = await db.getDeliveryRouteByTime(input.userId, input.date, input.hours);
        return route;
      }),
    
    // Get all orders for a delivery person with details
    getDeliveryPersonOrders: adminProcedure
      .input(z.object({
        deliveryPersonId: z.number(),
      }))
      .query(async ({ input }) => {
        const orders = await db.getDeliveryPersonOrdersWithDetails(input.deliveryPersonId);
        return orders;
      }),
    
    // Get complete route for a specific order
    getOrderCompleteRoute: adminProcedure
      .input(z.object({
        orderId: z.number(),
      }))
      .query(async ({ input }) => {
        const routeData = await db.getOrderCompleteRoute(input.orderId);
        return routeData;
      }),
    
    // Get all historical routes for a delivery person
    getAllRoutes: adminProcedure
      .input(z.object({
        deliveryPersonId: z.number(),
        days: z.number().optional().default(7),
      }))
      .query(async ({ input }) => {
        const routes = await db.getDeliveryPersonAllRoutes(input.deliveryPersonId, input.days);
        return routes;
      }),
    
    // Get heatmap data for most visited locations
    getHeatmapData: adminProcedure
      .input(z.object({
        deliveryPersonId: z.number(),
        days: z.number().optional().default(30),
      }))
      .query(async ({ input }) => {
        const heatmapData = await db.getDeliveryPersonHeatmapData(input.deliveryPersonId, input.days);
        return heatmapData;
      }),
    
    // Get advanced statistics for a delivery person
    getAdvancedStats: adminProcedure
      .input(z.object({
        deliveryPersonId: z.number(),
      }))
      .query(async ({ input }) => {
        const stats = await db.getDeliveryPersonAdvancedStats(input.deliveryPersonId);
        return stats;
      }),
    
    // Get route with timeline (includes stop points)
    getRouteWithTimeline: adminProcedure
      .input(z.object({
        deliveryPersonId: z.number(),
        hours: z.number().optional().default(24),
      }))
      .query(async ({ input }) => {
        const route = await db.getDeliveryPersonRouteWithTimeline(input.deliveryPersonId, input.hours);
        return route;
      }),
    
    // Get all delivery persons live status (enhanced with heading)
    getAllLiveStatus: adminProcedure.query(async ({ ctx }) => {
      // Super admin يرى جميع المندوبين، Admin يرى مندوبي فرعه فقط
      const branchId = (ctx.user.role === 'super_admin' || ctx.user.username === 'HarthHDR1') ? null : ctx.user.branchId;
      const statuses = await db.getAllDeliveryPersonsLiveStatus(branchId);
      return statuses;
    }),
  }),

  // Push Notifications
  push: router({
    // Save push subscription
    subscribe: protectedProcedure
      .input(z.object({
        endpoint: z.string(),
        p256dh: z.string(),
        auth: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.savePushSubscription({
          branchId: getBranchId(ctx.user),
          userId: ctx.user.id,
          endpoint: input.endpoint,
          p256Dh: input.p256dh,
          auth: input.auth,
        });
        return { success: true };
      }),
    
    // Send push notification (admin only)
    send: adminProcedure
      .input(z.object({
        userId: z.number(),
        title: z.string(),
        body: z.string(),
        data: z.any().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.sendPushNotification(input.userId, {
          title: input.title,
          body: input.body,
          data: input.data,
        });
        return { success: true };
      }),
  }),
  
  // Tracking & Status Monitoring
  tracking: router({
    getDeliveryStatusLog: protectedProcedure.query(async () => {
      return await db.getDeliveryStatusLog();
    }),
  }),

  // Activity Logs
  activityLogs: router({
    // Log activity
    log: protectedProcedure
      .input(z.object({
        activityType: z.enum(['login', 'logout', 'page_view', 'order_create', 'order_update', 'order_delete', 'delivery_assign', 'status_change', 'settings_change']),
        description: z.string().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.logActivity({
          branchId: getBranchId(ctx.user),
          userId: ctx.user.id,
          activityType: input.activityType,
          description: input.description,
          metadata: input.metadata,
        });
        return { success: true };
      }),

    // Get activity logs (admin only)
    list: adminProcedure
      .input(z.object({
        userId: z.number().optional(),
        activityType: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        // Super admin يرى جميع البيانات، Admin يرى بيانات فرعه فقط
        const branchId = (ctx.user.role === 'super_admin' || ctx.user.username === 'HarthHDR1') ? null : ctx.user.branchId;
        return await db.getActivityLogs({
          branchId,
          userId: input?.userId,
          activityType: input?.activityType,
          startDate: input?.startDate ? new Date(input.startDate) : undefined,
          endDate: input?.endDate ? new Date(input.endDate) : undefined,
          limit: input?.limit,
          offset: input?.offset,
        });
      }),

    // Get user activity stats (admin only)
    userStats: adminProcedure
      .input(z.object({
        userId: z.number().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getUserActivityStats(input?.userId, input?.startDate, input?.endDate);
      }),
  }),

  // Employee Statistics
  employeeStats: router({
    // Get employee stats (admin only)
    list: adminProcedure
      .input(z.object({
        employeeId: z.number().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        return await db.getEmployeeStats(input?.employeeId, input?.startDate, input?.endDate, ctx.user.branchId);
      }),

    // Get orders created by employee (admin only)
    orders: adminProcedure
      .input(z.object({
        employeeId: z.number(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getEmployeeOrders(input.employeeId, input.limit, input.offset);
      }),
  }),

  // Delivery Performance
  deliveryPerformance: router({
    // Get delivery person details with comprehensive stats and comparisons (admin only)
    detailsWithComparisons: adminProcedure
      .input(z.object({
        deliveryPersonId: z.number(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getDeliveryPersonDetailsWithComparisons(input.deliveryPersonId, input.startDate, input.endDate);
      }),

    // Get delivery person stats (admin only)
    stats: adminProcedure
      .input(z.object({
        deliveryPersonId: z.number().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        return await db.getDeliveryPersonStats(input?.deliveryPersonId, input?.startDate, input?.endDate, ctx.user.branchId);
      }),

    // الحصول على أيام عدم التوصيل للمندوب
    nonDeliveryDays: adminProcedure
      .input(z.object({
        deliveryPersonId: z.number(),
        year: z.number().optional(),
        month: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getDeliveryPersonNonDeliveryDays(input.deliveryPersonId, input.year, input.month);
      }),

    // Get delivery person orders (admin only)
    orders: adminProcedure
      .input(z.object({
        deliveryPersonId: z.number().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getDeliveryPersonOrdersFiltered(input?.deliveryPersonId, input?.startDate, input?.endDate);
      }),
  }),

  // Order Form Settings
  orderFormSettings: router({
    // Get all settings
    list: adminProcedure.query(async () => {
      return await db.getOrderFormSettings();
    }),

    // Initialize default settings
    initialize: adminProcedure.mutation(async () => {
      await db.initializeOrderFormSettings();
      return { success: true };
    }),

    // Update a setting
    update: adminProcedure
      .input(z.object({
        fieldName: z.string(),
        isVisible: z.boolean().optional(),
        displayOrder: z.number().optional(),
        isRequired: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.updateOrderFormSetting(input.fieldName, {
          isVisible: input.isVisible,
          displayOrder: input.displayOrder,
          isRequired: input.isRequired,
        });
        return { success: true };
      }),

    // Reorder fields
    reorder: adminProcedure
      .input(z.array(z.object({
        fieldName: z.string(),
        displayOrder: z.number(),
      })))
      .mutation(async ({ input }) => {
        await db.reorderFormFields(input);
        return { success: true };
      }),
  }),

  // Data Reset (admin only with secret verification)
  dataReset: router({
    // Reset all data
    resetAll: adminProcedure
      .input(z.object({
        secretCode: z.string(),
      }))
      .mutation(async ({ input }) => {
        if (input.secretCode !== 'Harth12$2006') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'الرمز السري غير صحيح' });
        }
        const success = await db.resetAllData();
        if (!success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'فشل في إعادة تعيين البيانات' });
        }
        return { success: true };
      }),

    // Reset delivery time data
    resetDeliveryTime: adminProcedure
      .input(z.object({
        secretCode: z.string(),
      }))
      .mutation(async ({ input }) => {
        if (input.secretCode !== 'Harth123$2006') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'الرمز السري غير صحيح' });
        }
        const success = await db.resetDeliveryTimeData();
        if (!success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'فشل في إعادة تعيين بيانات الوقت' });
        }
        return { success: true };
      }),
  }),

  // Active delivery persons (for order assignment)
  activeDeliveryPersons: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getActiveDeliveryPersons(getBranchId(ctx.user));
    }),
  }),

  // Delivery Speed Analytics
  deliverySpeedAnalytics: router({
    // Get comprehensive speed analytics for all delivery persons
    getAnalytics: adminProcedure
      .input(z.object({
        deliveryPersonId: z.number().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getDeliverySpeedAnalytics(input);
      }),

    // Get fastest and slowest orders
    getFastestSlowest: adminProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        limit: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await db.getFastestAndSlowestOrders(input);
      }),

    // Get monthly best times
    getMonthlyBest: adminProcedure
      .input(z.object({
        year: z.number(),
        month: z.number(),
      }))
      .query(async ({ input }) => {
        return await db.getMonthlyBestTimes(input.year, input.month);
      }),
  }),

  // Order Route Tracking
  orderRouteTracking: router({
    // Save route point (for delivery person)
    savePoint: protectedProcedure
      .input(z.object({
        orderId: z.number(),
        latitude: z.string(),
        longitude: z.string(),
        accuracy: z.string().optional(),
        speed: z.string().optional(),
        heading: z.string().optional(),
        deviationFromRoute: z.number().optional(),
        isOffRoute: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return await db.saveOrderRoutePoint({
          ...input,
          branchId: getBranchId(ctx.user),
          deliveryPersonId: ctx.user.id,
        });
      }),

    // Get route points for an order (admin only)
    getPoints: adminProcedure
      .input(z.object({
        orderId: z.number(),
      }))
      .query(async ({ input }) => {
        return await db.getOrderRoutePoints(input.orderId);
      }),

    // Get all active orders with live tracking (admin only)
    getActiveOrdersLive: adminProcedure.query(async () => {
      return await db.getActiveOrdersWithLiveTracking();
    }),

    // Get live tracking for a specific order (admin only)
    getLiveTracking: adminProcedure
      .input(z.object({
        orderId: z.number(),
      }))
      .query(async ({ input }) => {
        return await db.getOrderLiveTracking(input.orderId);
      }),

    // Get delivery progress for an order
    getDeliveryProgress: adminProcedure
      .input(z.object({
        orderId: z.number(),
      }))
      .query(async ({ input }) => {
        return await db.getOrderDeliveryProgress(input.orderId);
      }),
  }),

  // Backup System
  backup: router({
    // Create full database backup
    create: adminProcedure.query(async () => {
      try {
        // Get all data from all tables
        const users = await db.getAllUsers();
        const locations = await db.getAllLocations();
        const customers = await db.getAllCustomers();
        const orders = await db.getAllOrdersForBackup();
        const dailyStats = await db.getAllDailyStats();
        const activityLogs = await db.getAllActivityLogs();

        const backup = {
          version: '1.0',
          timestamp: Date.now(),
          date: new Date().toISOString(),
          data: {
            users,
            locations,
            customers,
            orders,
            dailyStats,
            activityLogs,
          },
        };

        return backup;
      } catch (error) {
        console.error('Backup creation error:', error);
        throw new TRPCError({ 
          code: 'INTERNAL_SERVER_ERROR', 
          message: 'فشل في إنشاء النسخة الاحتياطية' 
        });
      }
    }),
  }),

  // Settings Management
  settings: router({
    getAll: adminProcedure.query(async () => {
      return await db.getAllSettings();
    }),

    get: adminProcedure
      .input(z.object({ key: z.string() }))
      .query(async ({ input }) => {
        return await db.getSetting(input.key);
      }),

    update: adminProcedure
      .input(z.object({
        key: z.string(),
        value: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const success = await db.updateSetting(input.key, input.value);
        
        if (!success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'فشل في تحديث الإعداد' });
        }

        // تسجيل النشاط
        await db.logActivity({
          branchId: getBranchId(ctx.user),
          userId: ctx.user.id,
          activityType: 'settings_change',
          description: `تحديث إعداد ${input.key} إلى ${input.value}`,
        });

        return { success: true };
      }),

    getDayStartHour: adminProcedure.query(async () => {
      return await db.getDayStartHour();
    }),
  }),

  // Super Admin routes for branch management
  branches: router({
    list: superAdminProcedure.query(async () => {
      return await db.getAllBranches();
    }),

    create: superAdminProcedure
      .input(z.object({
        name: z.string(),
        code: z.string(),
        address: z.string().optional(),
        phone: z.string().optional(),
        subscriptionStartDate: z.string().optional(),
        subscriptionEndDate: z.string().optional(),
        adminUsername: z.string(),
        adminPassword: z.string(),
        adminName: z.string(),
      }))
      .mutation(async ({ input }) => {
        // Create branch
        const branch = await db.createBranch({
          name: input.name,
          code: input.code,
          address: input.address,
          phone: input.phone,
          subscriptionStartDate: input.subscriptionStartDate,
          subscriptionEndDate: input.subscriptionEndDate,
        });

        // Create admin user for this branch with all permissions
        await db.createUser({
          username: input.adminUsername,
          password: input.adminPassword,
          name: input.adminName,
          role: 'admin',
          branchId: branch.id,
          permissions: ["all"], // إعطاء جميع الصلاحيات للمسؤول الجديد
        });

        return { success: true, branchId: branch.id };
      }),

    update: superAdminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        address: z.string().optional(),
        phone: z.string().optional(),
        subscriptionStartDate: z.string().optional(),
        subscriptionEndDate: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateBranch(id, data);
        return { success: true };
      }),

    getStats: superAdminProcedure.query(async () => {
      return await db.getAllBranchesStats();
    }),

    // الخروج من الفرع والعودة لوضع super admin
    exitBranch: superAdminProcedure
      .mutation(async ({ ctx }) => {
        // إنشاء جلسة بدون branchId للعودة لوضع super admin
        await createSession(ctx.user.id, null, ctx.res, ctx.req);
        return { success: true };
      }),

    // الدخول لفرع معين كـ super admin
    loginToBranch: superAdminProcedure
      .input(z.object({
        branchId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        // الحصول على بيانات الفرع
        const branch = await db.getBranchById(input.branchId);
        if (!branch) {
          throw new TRPCError({ code: "NOT_FOUND", message: "الفرع غير موجود" });
        }

        // إنشاء جلسة جديدة مع branchId المحدد
        await createSession(ctx.user.id, input.branchId, ctx.res, ctx.req);

        return { success: true, branchName: branch.name };
      }),

    // Soft delete branch
    softDelete: superAdminProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ input }) => {
        await db.softDeleteBranch(input.id);
        return { success: true };
      }),

    // Restore deleted branch
    restore: superAdminProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ input }) => {
        await db.restoreBranch(input.id);
        return { success: true };
      }),

    // List deleted branches
    listDeleted: superAdminProcedure.query(async () => {
      return await db.getDeletedBranches();
    }),
  }),

  // Maintenance Mode Management
  maintenance: router({
    getStatus: publicProcedure.query(async () => {
      return await db.getMaintenanceMode();
    }),
    
    updateStatus: superAdminProcedure
      .input(z.object({
        isEnabled: z.boolean(),
        message: z.string().optional(),
        estimatedEndTime: z.string().optional().nullable(),
      }))
      .mutation(async ({ input, ctx }) => {
        return await db.updateMaintenanceMode({
          isEnabled: input.isEnabled ? 1 : 0,
          message: input.message,
          estimatedEndTime: input.estimatedEndTime,
          updatedBy: ctx.user.id,
        });
      }),
  }),

  // Advanced delivery person statistics
  deliveryStats: router({
    workingDays: protectedProcedure
      .input(z.object({
        deliveryPersonId: z.number(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getDeliveryPersonWorkingDays(
          input.deliveryPersonId,
          input.startDate,
          input.endDate
        );
      }),
  }),

  // Subscription codes management (Super Admin only)
  subscriptions: router({
    // توليد كود اشتراك جديد
    generateCode: superAdminProcedure
      .input(z.object({
        durationType: z.enum(['daily', 'weekly', 'monthly', 'yearly', 'custom']),
        customDays: z.number().optional(), // للفترة المخصصة
        expiresAt: z.string().optional(), // تاريخ انتهاء صلاحية الكود
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.generateSubscriptionCode({
          durationType: input.durationType,
          customDays: input.customDays,
          createdBy: ctx.user.id,
          expiresAt: input.expiresAt,
        });
      }),

    // عرض جميع الكودات
    list: superAdminProcedure.query(async () => {
      return await db.getAllSubscriptionCodes();
    }),

    // التحقق من كود واستخدامه
    validateAndUse: publicProcedure
      .input(z.object({
        code: z.string(),
        branchId: z.number(),
      }))
      .mutation(async ({ input }) => {
        return await db.validateAndUseSubscriptionCode(input.code, input.branchId);
      }),

    // تجديد اشتراك فرع موجود
    renewBranch: protectedProcedure
      .input(z.object({
        code: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.branchId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "المستخدم غير مرتبط بفرع" });
        }
        return await db.validateAndUseSubscriptionCode(input.code, ctx.user.branchId);
      }),

    // حذف كود
    delete: superAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteSubscriptionCode(input.id);
        return { success: true };
      }),

    // جلب سعر الاشتراك
    getPrice: publicProcedure.query(async () => {
      return await db.getSubscriptionPrice();
    }),

    // تحديث سعر الاشتراك
    updatePrice: superAdminProcedure
      .input(z.object({ price: z.number().min(0) }))
      .mutation(async ({ input }) => {
        await db.updateSubscriptionPrice(input.price);
        return { success: true };
      }),
  }),

  // Pharmacy registration
  pharmacy: router({
    // إنشاء صيدلية جديدة
    register: publicProcedure
      .input(z.object({
        activationCode: z.string(),
        pharmacyName: z.string().min(1),
        address: z.string().optional(),
        phone: z.string().optional(),
        ownerName: z.string().min(1),
        username: z.string().min(3),
        password: z.string().min(6),
      }))
      .mutation(async ({ input, ctx }) => {
        return await db.registerPharmacy({
          activationCode: input.activationCode,
          pharmacyName: input.pharmacyName,
          address: input.address,
          phone: input.phone,
          ownerName: input.ownerName,
          username: input.username,
          password: input.password,
        });
      }),
  }),

  // Store Management
  store: router({
    list: publicProcedure.query(async () => {
      return await db.getAllStoreProducts();
    }),

    create: superAdminProcedure
      .input(z.object({
        name: z.string(),
        description: z.string().optional(),
        price: z.string(),
        type: z.enum(['product', 'subscription']),
        durationMonths: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createStoreProduct(input);
      }),

    purchase: protectedProcedure
      .input(z.object({ productId: z.number(), price: z.string() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user.branchId) throw new TRPCError({ code: "BAD_REQUEST", message: "المستخدم غير مرتبط بفرع" });
        return await db.purchaseProduct(ctx.user.branchId, input.productId, input.price);
      }),

    activate: protectedProcedure
      .input(z.object({ activationCode: z.string() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user.branchId) throw new TRPCError({ code: "BAD_REQUEST", message: "المستخدم غير مرتبط بفرع" });
        return await db.activateSubscription(input.activationCode, ctx.user.branchId);
      }),

    myPurchases: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user.branchId) return [];
      return await db.getBranchPurchases(ctx.user.branchId);
    }),

    mySubscriptions: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user.branchId) return [];
      return await db.getActiveSubscriptions(ctx.user.branchId);
    }),
  }),

  // نظام التحديثات
  updates: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllUpdates();
    }),

    create: superAdminProcedure
      .input(z.object({
        title: z.string(),
        content: z.string(),
        type: z.string(),
        imageUrl: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return await db.createUpdate({ ...input, createdBy: ctx.user.id });
      }),

    update: superAdminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        content: z.string().optional(),
        type: z.string().optional(),
        imageUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return await db.updateUpdate(id, data);
      }),

    delete: superAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteUpdate(input.id);
      }),
  }),

  // نظام الإعلانات
  announcements: router({
    list: superAdminProcedure.query(async () => {
      return await db.getAllAnnouncements();
    }),

    create: superAdminProcedure
      .input(z.object({
        title: z.string(),
        content: z.string(),
        type: z.string(),
        imageUrl: z.string().optional(),
        isActive: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        return await db.createAnnouncement({ ...input, createdBy: ctx.user.id });
      }),

    getActive: protectedProcedure.query(async ({ ctx }) => {
      return await db.getActiveAnnouncement(ctx.user.id);
    }),

    markAsRead: protectedProcedure
      .input(z.object({ announcementId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        return await db.markAnnouncementAsRead(input.announcementId, ctx.user.id);
      }),

    update: superAdminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        content: z.string().optional(),
        type: z.string().optional(),
        imageUrl: z.string().optional(),
        isActive: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return await db.updateAnnouncement(id, data);
      }),

    delete: superAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteAnnouncement(input.id);
      }),
  }),

  // نظام إعدادات الموقع
  siteSettings: router({
    list: superAdminProcedure.query(async () => {
      return await db.getSiteSettings();
    }),

    update: superAdminProcedure
      .input(z.object({
        key: z.string(),
        value: z.string(),
      }))
      .mutation(async ({ input }) => {
        return await db.updateSiteSetting(input.key, input.value);
      }),
  }),

  // Notification Settings
  notificationSettings: router({
    testNotification: superAdminProcedure
      .input(z.object({
        branchId: z.number(),
        userId: z.number(),
        title: z.string(),
        message: z.string(),
      }))
      .mutation(async ({ input }) => {
        console.log('[TestNotification] Received request:', input);
        
        const user = await db.getUserById(input.userId);
        if (!user || !user.name) {
          console.error('[TestNotification] User not found:', input.userId);
          throw new TRPCError({ code: 'NOT_FOUND', message: 'المستخدم غير موجود' });
        }
        
        console.log('[TestNotification] Sending notification to user:', user.name, user.id);
        
        const success = await oneSignal.sendNotification(
          input.branchId,
          input.title,
          input.message,
          [input.userId.toString()]
        );
        
        if (!success) {
          console.error('[TestNotification] Failed to send notification');
          throw new TRPCError({ 
            code: 'INTERNAL_SERVER_ERROR', 
            message: 'فشل إرسال الإشعار. يرجى التحقق من إعدادات OneSignal' 
          });
        }
        
        console.log('[TestNotification] Notification sent successfully');
        return { success: true };
      }),
    
    list: superAdminProcedure.query(async () => {
      return await db.getAllNotificationSettings();
    }),

    getByBranch: adminProcedure
      .input(z.object({ branchId: z.number() }))
      .query(async ({ input }) => {
        return await db.getNotificationSettings(input.branchId);
      }),

    create: superAdminProcedure
      .input(z.object({
        branchId: z.number(),
        oneSignalAppId: z.string(),
        oneSignalRestApiKey: z.string(),
        notifyOnNewOrder: z.boolean().default(true),
        notifyOnMessage: z.boolean().default(true),
        isEnabled: z.boolean().default(true),
      }))
      .mutation(async ({ input }) => {
        return await db.createNotificationSettings({
          ...input,
          notifyOnNewOrder: input.notifyOnNewOrder ? 1 : 0,
          notifyOnMessage: input.notifyOnMessage ? 1 : 0,
          isEnabled: input.isEnabled ? 1 : 0,
        });
      }),

    update: superAdminProcedure
      .input(z.object({
        branchId: z.number(),
        oneSignalAppId: z.string().optional(),
        oneSignalRestApiKey: z.string().optional(),
        notifyOnNewOrder: z.boolean().optional(),
        notifyOnMessage: z.boolean().optional(),
        isEnabled: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { branchId, notifyOnNewOrder, notifyOnMessage, isEnabled, ...rest } = input;
        return await db.updateNotificationSettings(branchId, {
          ...rest,
          notifyOnNewOrder: notifyOnNewOrder !== undefined ? (notifyOnNewOrder ? 1 : 0) : undefined,
          notifyOnMessage: notifyOnMessage !== undefined ? (notifyOnMessage ? 1 : 0) : undefined,
          isEnabled: isEnabled !== undefined ? (isEnabled ? 1 : 0) : undefined,
        });
      }),

    getStats: superAdminProcedure
      .input(z.object({
        branchId: z.number(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getNotificationStats(input.branchId, input.startDate, input.endDate);
      }),

    getLogs: superAdminProcedure
      .input(z.object({
        branchId: z.number(),
        limit: z.number().default(100),
      }))
      .query(async ({ input }) => {
        return await db.getNotificationLogs(input.branchId, input.limit);
      }),
  }),

});

export type AppRouter = typeof appRouter;
