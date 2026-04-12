import { eq, and, desc, sql, gte, lte, lt, gt, inArray, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2";
import { notifyOwner } from "./_core/notification";
import { InsertUser, users, regions, provinces, orders, notifications, messages, InsertRegion, InsertProvince, InsertOrder, customers, deliveryLocations, InsertDeliveryLocation, dailyStats, pushSubscriptions, activityLogs, InsertActivityLog, orderFormSettings, InsertOrderFormSetting, orderLocations, orderRouteTracking, InsertOrderRouteTracking, settings, subscriptionCodes, branches, maintenanceMode, storeProducts, storePurchases, subscriptionActivations, updates, announcements, announcementReads, siteSettings, notificationSettings, notificationLogs } from "../drizzle/schema";
import { ENV } from './_core/env';
import { hash, compare } from 'bcryptjs';
import { getStartOfDay, getEndOfDay, getTodayRange, getYesterdayRange, getBusinessDateString, getCurrentTimeISOInIraq } from './dateUtils';

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: ReturnType<typeof createPool> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      // Create MySQL connection pool first
      _pool = createPool(process.env.DATABASE_URL);
      _db = drizzle(_pool);
      console.log("[Database] Connected successfully");
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
      _pool = null;
    }
  }
  return _db;
}

// Reset database connection (useful after schema changes)
export function resetDb() {
  if (_pool) {
    _pool.end();
    _pool = null;
  }
  _db = null;
  console.log("[Database] Connection reset");
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date().toISOString();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date().toISOString();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ===== User Management =====

export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUsersByRole(role: "admin" | "delivery") {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(users).where(eq(users.role, role));
}

export async function createUser(data: {
  username: string;
  password: string;
  name: string;
  role: "admin" | "delivery";
  phone?: string;
  profileImage?: string;
  branchId?: number | null;
  permissions?: string[];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const passwordHash = await hash(data.password, 10);
  
  const result = await db.insert(users).values({
    username: data.username,
    passwordHash,
    name: data.name,
    role: data.role,
    phone: data.phone,
    profileImage: data.profileImage,
    branchId: data.branchId || null,
    permissions: data.permissions ? JSON.stringify(data.permissions) : null,
    loginMethod: "custom",
  });
  
  // Return the created user - get from database to ensure we have the ID
  const newUser = await db.select().from(users).where(eq(users.username, data.username)).limit(1);
  return { id: newUser[0].id };
}

export async function updateUser(id: number, data: {
  name?: string;
  phone?: string;
  profileImage?: string;
  isActive?: boolean;
  traccarUsername?: string;
  traccarPassword?: string;
  fcmToken?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const updateData: any = { ...data };
  if (typeof data.isActive === 'boolean') {
    updateData.isActive = data.isActive ? 1 : 0;
  }
  
  await db.update(users).set(updateData).where(eq(users.id, id));
}

export async function updateDeliveryPerson(id: number, data: {
  name?: string;
  phone?: string;
  profileImage?: string;
  isActive?: boolean;
  traccarUsername?: string;
  traccarPassword?: string;
  fcmToken?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const updateData: any = { ...data };
  if (typeof data.isActive === 'boolean') {
    updateData.isActive = data.isActive ? 1 : 0;
  }
  
  await db.update(users).set(updateData).where(eq(users.id, id));
}

export async function updateUserPassword(id: number, newPassword: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const passwordHash = await hash(newPassword, 10);
  await db.update(users).set({ passwordHash }).where(eq(users.id, id));
}

export async function updateUsername(id: number, newUsername: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users).set({ username: newUsername }).where(eq(users.id, id));
}

export async function verifyPassword(passwordHash: string, password: string) {
  return await compare(password, passwordHash);
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(users).orderBy(desc(users.createdAt));
}

export async function getUsersByBranch(branchId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  
  // إذا لم يكن branchId موجود، إرجاع قائمة فارغة
  if (!branchId) return [];
  
  return await db.select().from(users)
    .where(eq(users.branchId, branchId))
    .orderBy(desc(users.createdAt));
}

export async function getDeliveryPersons(branchId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  
  // إذا كان branchId موجود، فلتر حسب الفرع
  if (branchId) {
    return await db.select().from(users)
      .where(and(eq(users.role, "delivery"), eq(users.branchId, branchId)))
      .orderBy(desc(users.createdAt));
  }
  
  return await db.select().from(users).where(eq(users.role, "delivery")).orderBy(desc(users.createdAt));
}

export async function deleteUser(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(users).where(eq(users.id, id));
}

// ===== Region Management =====

export async function getAllRegions(branchId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(regions).where(eq(regions.branchId, branchId)).orderBy(desc(regions.createdAt));
}

export async function getRegionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(regions).where(eq(regions.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function deleteRegion(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(regions).where(eq(regions.id, id));
}

// ===== Province Management =====

export async function getAllProvinces(branchId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(provinces).where(eq(provinces.branchId, branchId)).orderBy(desc(provinces.createdAt));
}

export async function createProvince(name: string, branchId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(provinces).values({ name, branchId });
}

export async function updateProvince(id: number, name: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(provinces).set({ name }).where(eq(provinces.id, id));
}

export async function createRegion(name: string, provinceId: number, branchId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(regions).values({ name, provinceId, branchId });
}

export async function updateRegion(id: number, name: string, provinceId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(regions).set({ name, provinceId }).where(eq(regions.id, id));
}

export async function deleteProvince(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(provinces).where(eq(provinces.id, id));
}

// ===== Order Management =====

export async function createOrder(data: InsertOrder) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Set createdAt to Iraq timezone (GMT+3) if not already set
  if (!data.createdAt) {
    data.createdAt = getCurrentTimeISOInIraq();
  }
  const result = await db.insert(orders).values(data);
  // Get the inserted order ID
  const insertId = result[0].insertId;
  // Return the created order
  return await getOrderById(insertId);
}

export async function getOrderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  // Join with customers table to get location URLs
  const result = await db
    .select({
      id: orders.id,
      price: orders.price,
      status: orders.status,
      note: orders.note,
      address: orders.address,
      locationLink: orders.locationLink,
      postponeReason: orders.postponeReason,
      returnReason: orders.returnReason,
      deliveryImage: orders.deliveryImage,
      deliveryNote: orders.deliveryNote,
      deliveryLocationName: orders.deliveryLocationName,
      deliveryPersonId: orders.deliveryPersonId,
      regionId: orders.regionId,
      provinceId: orders.provinceId,
      customerId: orders.customerId,
      createdAt: orders.createdAt,
      deliveredAt: orders.deliveredAt,
      acceptedAt: orders.acceptedAt,
      hidePhoneFromDelivery: orders.hidePhoneFromDelivery,
      isDeleted: orders.isDeleted,
      // Customer fields
      customerName: customers.name,
      customerPhone: customers.phone,
      customerEmail: customers.email,
      customerAddress1: customers.address1,
      customerAddress2: customers.address2,
      customerLocationUrl1: customers.locationUrl1,
      customerLocationUrl2: customers.locationUrl2,
      customerLastDeliveryLocation: customers.lastDeliveryLocation,
      customerLastDeliveryAt: customers.lastDeliveryAt,
      // Region and delivery person
      regionName: regions.name,
      deliveryPersonName: users.name,
    })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .leftJoin(regions, eq(orders.regionId, regions.id))
    .leftJoin(users, eq(orders.deliveryPersonId, users.id))
    .where(eq(orders.id, id))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllOrders(options?: { 
  limit?: number; 
  offset?: number;
  startDate?: string;
  endDate?: string;
  statuses?: string[];
  deliveryPersonId?: number;
  regionId?: number;
  branchId?: number | null;
}) {
  const db = await getDb();
  if (!db) return [];
  
  // Build where conditions
  const conditions = [eq(orders.isDeleted, 0)];
  
  // Date filter - using sql template for timestamp comparison
  if (options?.startDate) {
    conditions.push(sql`${orders.createdAt} >= ${options.startDate}`);
  }
  if (options?.endDate) {
    conditions.push(sql`${orders.createdAt} <= ${options.endDate}`);
  }
  
  // Status filter
  if (options?.statuses && options.statuses.length > 0) {
    conditions.push(inArray(orders.status, options.statuses as any));
  }
  
  // Delivery person filter
  if (options?.deliveryPersonId) {
    conditions.push(eq(orders.deliveryPersonId, options.deliveryPersonId));
  }
  
  // Region filter
  if (options?.regionId) {
    conditions.push(eq(orders.regionId, options.regionId));
  }
  
  // Branch filter
  if (options?.branchId) {
    conditions.push(eq(orders.branchId, options.branchId));
  }
  
  let query = db
    .select({
      id: orders.id,
      price: orders.price,
      status: orders.status,
      note: orders.note,
      address: orders.address,
      locationLink: orders.locationLink,
      postponeReason: orders.postponeReason,
      returnReason: orders.returnReason,
      deliveryImage: orders.deliveryImage,
      deliveryNote: orders.deliveryNote,
      deliveryLocationName: orders.deliveryLocationName,
      deliveryPersonId: orders.deliveryPersonId,
      regionId: orders.regionId,
      provinceId: orders.provinceId,
      customerId: orders.customerId,
      createdAt: orders.createdAt,
      deliveredAt: orders.deliveredAt,
      acceptedAt: orders.acceptedAt,
      deliveryDuration: orders.deliveryDuration,
      totalDuration: orders.totalDuration,
      hidePhoneFromDelivery: orders.hidePhoneFromDelivery,
      deliveryPersonName: users.name,
      deliveryPersonImage: users.profileImage,
      regionName: regions.name,
      customerName: customers.name,
      customerPhone: customers.phone,
      customerEmail: customers.email,
      customerAddress1: customers.address1,
      customerAddress2: customers.address2,
      customerLocationUrl1: customers.locationUrl1,
      customerLocationUrl2: customers.locationUrl2,
      customerLastDeliveryLocation: customers.lastDeliveryLocation,
      customerLastDeliveryAt: customers.lastDeliveryAt,
    })
    .from(orders)
    .leftJoin(users, eq(orders.deliveryPersonId, users.id))
    .leftJoin(regions, eq(orders.regionId, regions.id))
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(and(...conditions))
    .orderBy(desc(orders.createdAt));
  
  // Apply pagination if provided
  if (options?.limit) {
    query = query.limit(options.limit) as any;
  }
  if (options?.offset) {
    query = query.offset(options.offset) as any;
  }
  
  const allOrders = await query;
  
  // Calculate delivery duration and total duration for each order
  const ordersWithDuration = allOrders.map((order: any) => {
    let deliveryDuration = order.deliveryDuration; // Use existing value if available
    let totalDuration = order.totalDuration; // Use existing value if available
    
    // Calculate delivery duration only if not already set
    if ((deliveryDuration === null || deliveryDuration === undefined) && order.deliveredAt) {
      // Use acceptedAt if available, otherwise use createdAt as fallback
      const startTime = order.acceptedAt || order.createdAt;
      if (startTime) {
        const durationMs = new Date(order.deliveredAt).getTime() - new Date(startTime).getTime();
        deliveryDuration = Math.floor(durationMs / (1000 * 60)); // in minutes
      }
    }
    
    // Calculate total duration only if not already set
    if ((totalDuration === null || totalDuration === undefined) && order.createdAt && order.deliveredAt) {
      const durationMs = new Date(order.deliveredAt).getTime() - new Date(order.createdAt).getTime();
      totalDuration = Math.floor(durationMs / (1000 * 60)); // in minutes
    }
    
    return {
      ...order,
      deliveryDuration,
      totalDuration,
    };
  });
  
  return ordersWithDuration;
}

export async function getOrdersCount() {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(eq(orders.isDeleted, 0));
  
  return result[0]?.count || 0;
}

export async function getOrdersByDeliveryPerson(deliveryPersonId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select({
      id: orders.id,
      customerId: orders.customerId,
      regionId: orders.regionId,
      regionName: regions.name,
      provinceId: orders.provinceId,
      provinceName: provinces.name,
      price: orders.price,
      note: orders.note,
      address: orders.address,
      locationLink: orders.locationLink,
      status: orders.status,
      postponeReason: orders.postponeReason,
      returnReason: orders.returnReason,
      deliveryImage: orders.deliveryImage,
      deliveryNote: orders.deliveryNote,
      deliveryLocationName: orders.deliveryLocationName,
      deliveryPersonId: orders.deliveryPersonId,
      hidePhoneFromDelivery: orders.hidePhoneFromDelivery,
      createdAt: orders.createdAt,
      deliveredAt: orders.deliveredAt,
      acceptedAt: orders.acceptedAt,
      isDeleted: orders.isDeleted,
      // Customer data from customers table
      customerName: customers.name,
      customerPhone: customers.phone,
      customerEmail: customers.email,
      customerAddress1: customers.address1,
      customerAddress2: customers.address2,
      customerLocationUrl1: customers.locationUrl1,
      customerLocationUrl2: customers.locationUrl2,
      customerNotes: customers.notes,
    })
    .from(orders)
    .leftJoin(regions, eq(orders.regionId, regions.id))
    .leftJoin(provinces, eq(orders.provinceId, provinces.id))
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(and(
      eq(orders.deliveryPersonId, deliveryPersonId),
      eq(orders.isDeleted, 0),
      // عرض فقط الطلبات غير المسلمة أو التي سلمت في اليوم الحالي (بعد 5 صباحاً)
      // اليوم يبدأ من 5 صباحاً وينتهي 5 صباحاً اليوم التالي
      sql`(
        ${orders.status} != 'delivered' 
        OR ${orders.deliveredAt} >= 
          CASE 
            WHEN HOUR(NOW()) >= 5 THEN DATE_FORMAT(NOW(), '%Y-%m-%d 05:00:00')
            ELSE DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 DAY), '%Y-%m-%d 05:00:00')
          END
      )`
    ))
    .orderBy(desc(orders.createdAt));
  
  return result;
}

export async function updateOrderStatus(id: number, status: "pending_approval" | "pending" | "delivered" | "postponed" | "cancelled" | "returned", data?: {
  postponeReason?: string;
  returnReason?: string;
  deliveryImage?: string;
  deliveryNote?: string;
  deliveryLocationName?: string;
  deliveredAt?: Date;
  acceptedAt?: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const updateData: any = { status };
  if (data) {
    Object.keys(data).forEach(key => {
      const value = (data as any)[key];
      if (value instanceof Date) {
        updateData[key] = value.toISOString();
      } else {
        updateData[key] = value;
      }
    });
  }
  
  await db.update(orders).set(updateData).where(eq(orders.id, id));
}

export async function reassignOrder(orderId: number, newDeliveryPersonId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orders).set({ 
    deliveryPersonId: newDeliveryPersonId,
    status: "pending",
    postponeReason: null,
  }).where(eq(orders.id, orderId));
}

export async function updateOrder(orderId: number, data: {
  deliveryPersonId?: number;
  price?: number;
  customerId?: number;
  note?: string;
  regionId?: number;
  provinceId?: number;
  address?: string;
  locationLink?: string;
  status?: string;
  deliveryProfit?: number;
  deliveredByAdmin?: number;
  deliveredByAdminUsername?: string;
  deliveredAt?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const updateData: any = {};
  if (data.deliveryPersonId !== undefined) updateData.deliveryPersonId = data.deliveryPersonId;
  if (data.price !== undefined) updateData.price = data.price;
  if (data.customerId !== undefined) updateData.customerId = data.customerId;
  if (data.note !== undefined) updateData.note = data.note;
  if (data.regionId !== undefined) updateData.regionId = data.regionId;
  if (data.provinceId !== undefined) updateData.provinceId = data.provinceId;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.locationLink !== undefined) updateData.locationLink = data.locationLink;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.deliveryProfit !== undefined) updateData.deliveryProfit = data.deliveryProfit;
  if (data.deliveredByAdmin !== undefined) updateData.deliveredByAdmin = data.deliveredByAdmin;
  if (data.deliveredByAdminUsername !== undefined) updateData.deliveredByAdminUsername = data.deliveredByAdminUsername;
  if (data.deliveredAt !== undefined) updateData.deliveredAt = data.deliveredAt;
  
  await db.update(orders).set(updateData).where(eq(orders.id, orderId));
}

// ===== Statistics =====

export async function getOrderStatsByRegion(branchId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  
  // Filter by branchId if provided
  const whereConditions = branchId 
    ? and(eq(orders.isDeleted, 0), eq(orders.branchId, branchId))
    : eq(orders.isDeleted, 0);
  
  const stats = await db
    .select({
      regionId: orders.regionId,
      totalOrders: sql<number>`SUM(CASE WHEN ${orders.status} = 'delivered' THEN 1 ELSE 0 END)`,
      totalRevenue: sql<number>`SUM(CASE WHEN ${orders.status} = 'delivered' THEN ${orders.price} ELSE 0 END)`,
      deliveredOrders: sql<number>`SUM(CASE WHEN ${orders.status} = 'delivered' THEN 1 ELSE 0 END)`,
    })
    .from(orders)
    .where(whereConditions)
    .groupBy(orders.regionId);
  
  return stats;
}



// حساب أيام عدم التوصيل للمندوب في الشهر الحالي
export async function getDeliveryPersonNonDeliveryDays(deliveryPersonId: number, year?: number, month?: number) {
  const db = await getDb();
  if (!db) return { count: 0, dates: [] };
  
  // إذا لم يتم تحديد السنة والشهر، استخدم الشهر الحالي
  const now = new Date();
  const targetYear = year || now.getFullYear();
  const targetMonth = month || (now.getMonth() + 1);
  
  // حساب عدد أيام الشهر
  const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
  
  // الحصول على جميع الأيام التي تم فيها تسليم طلبات
  const deliveryDays = await db
    .select({
      deliveryDate: sql<string>`DATE(${orders.deliveredAt})`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.deliveryPersonId, deliveryPersonId),
        eq(orders.status, 'delivered'),
        eq(orders.isDeleted, 0),
        sql`YEAR(${orders.deliveredAt}) = ${targetYear}`,
        sql`MONTH(${orders.deliveredAt}) = ${targetMonth}`
      )
    )
    .groupBy(sql`DATE(${orders.deliveredAt})`);
  
  // إنشاء مجموعة من الأيام التي تم فيها التسليم
  const deliveredDaysSet = new Set(deliveryDays.map(d => {
    const date = new Date(d.deliveryDate);
    return date.getDate();
  }));
  
  // حساب الأيام التي لم يتم فيها التسليم
  const nonDeliveryDates: string[] = [];
  const today = now.getDate();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  
  // إذا كان الشهر المستهدف هو الشهر الحالي، لا تحسب الأيام المستقبلية
  const maxDay = (targetYear === currentYear && targetMonth === currentMonth) ? today : daysInMonth;
  
  for (let day = 1; day <= maxDay; day++) {
    if (!deliveredDaysSet.has(day)) {
      const dateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      nonDeliveryDates.push(dateStr);
    }
  }
  
  return {
    count: nonDeliveryDates.length,
    dates: nonDeliveryDates,
    year: targetYear,
    month: targetMonth,
  };
}

export async function getAllDeliveryPersonsStats(branchId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  
  const stats = await db
    .select({
      deliveryPersonId: orders.deliveryPersonId,
      total: sql<number>`COUNT(*)`,
      delivered: sql<number>`SUM(CASE WHEN ${orders.status} = 'delivered' THEN 1 ELSE 0 END)`,
      pending: sql<number>`SUM(CASE WHEN ${orders.status} = 'pending' THEN 1 ELSE 0 END)`,
      postponed: sql<number>`SUM(CASE WHEN ${orders.status} = 'postponed' THEN 1 ELSE 0 END)`,
      cancelled: sql<number>`SUM(CASE WHEN ${orders.status} = 'cancelled' THEN 1 ELSE 0 END)`,
    })
    .from(orders)
    .where(
      branchId
        ? and(eq(orders.isDeleted, 0), eq(orders.branchId, branchId))
        : eq(orders.isDeleted, 0)
    )
    .groupBy(orders.deliveryPersonId);
  
  return stats;
}

export async function getDashboardStats(branchId?: number | null) {
  const db = await getDb();
  if (!db) return null;
  
  // Get total counts (excluding deleted orders) - filtered by branchId
  const totalOrders = await db.select({ count: sql<number>`COUNT(*)` }).from(orders).where(
    branchId ? and(eq(orders.isDeleted, 0), eq(orders.branchId, branchId)) : eq(orders.isDeleted, 0)
  );
  const activeDeliveries = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(users)
    .where(
      branchId 
        ? and(eq(users.role, "delivery"), eq(users.isActive, 1), eq(users.branchId, branchId))
        : and(eq(users.role, "delivery"), eq(users.isActive, 1))
    );
  const deliveredOrders = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(orders)
    .where(
      branchId
        ? and(eq(orders.status, "delivered"), eq(orders.isDeleted, 0), eq(orders.branchId, branchId))
        : and(eq(orders.status, "delivered"), eq(orders.isDeleted, 0))
    );
  const totalRegions = await db.select({ count: sql<number>`COUNT(*)` }).from(regions);
  
  // Get recent orders (excluding deleted) - filtered by branchId
  const recentOrders = await db
    .select({
      id: orders.id,
      price: orders.price,
      status: orders.status,
      region: regions.name,
    })
    .from(orders)
    .leftJoin(regions, eq(orders.regionId, regions.id))
    .where(
      branchId
        ? and(eq(orders.isDeleted, 0), eq(orders.branchId, branchId))
        : eq(orders.isDeleted, 0)
    )
    .orderBy(desc(orders.createdAt))
    .limit(5);
  
  // Get top delivery persons (excluding deleted orders) - filtered by branchId
  const topDeliveries = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      deliveredCount: sql<number>`COUNT(${orders.id})`,
    })
    .from(users)
    .leftJoin(orders, and(
      eq(orders.deliveryPersonId, users.id), 
      eq(orders.status, "delivered"), 
      eq(orders.isDeleted, 0),
      branchId ? eq(orders.branchId, branchId) : sql`1=1`
    ))
    .where(
      branchId
        ? and(eq(users.role, "delivery"), eq(users.branchId, branchId))
        : eq(users.role, "delivery")
    )
    .groupBy(users.id)
    .orderBy(desc(sql<number>`COUNT(${orders.id})`))
    .limit(5);
  
  // Get top regions by order count (only regions with orders in this branch)
  const topRegionsWhere = [
    eq(orders.isDeleted, 0)
  ];
  if (branchId) {
    topRegionsWhere.push(eq(orders.branchId, branchId));
  }
  const topRegions = await db
    .select({
      id: regions.id,
      name: regions.name,
      orderCount: sql<number>`COUNT(${orders.id})`,
    })
    .from(orders)
    .innerJoin(regions, eq(orders.regionId, regions.id))
    .where(and(...topRegionsWhere))
    .groupBy(regions.id)
    .orderBy(desc(sql<number>`COUNT(${orders.id})`))
    .limit(5);
  
  return {
    totalOrders: totalOrders[0]?.count || 0,
    activeDeliveries: activeDeliveries[0]?.count || 0,
    deliveredOrders: deliveredOrders[0]?.count || 0,
    totalRegions: totalRegions[0]?.count || 0,
    recentOrders,
    topDeliveries,
    topRegions,
  };
}

// ===== Advanced Statistics =====

export async function getAdvancedStats(branchId?: number | null) {
  const db = await getDb();
  if (!db) return null;

  // Total revenue (only delivered orders, excluding deleted) - filtered by branchId
  const ordersWhere = branchId 
    ? and(eq(orders.isDeleted, 0), eq(orders.branchId, branchId))
    : eq(orders.isDeleted, 0);
  const allOrders = await db.select().from(orders).where(ordersWhere);
  const deliveredOrders = allOrders.filter(o => o.status === "delivered");
  const totalRevenue = deliveredOrders.reduce((sum, order) => sum + order.price, 0);
  const averageOrderValue = deliveredOrders.length > 0 ? totalRevenue / deliveredOrders.length : 0;

  // By status
  const byStatus = {
    pending: allOrders.filter(o => o.status === "pending").length,
    delivered: allOrders.filter(o => o.status === "delivered").length,
    postponed: allOrders.filter(o => o.status === "postponed").length,
    cancelled: allOrders.filter(o => o.status === "cancelled").length,
  };

  // By region - filtered by branchId
  const regionsWhere = branchId
    ? eq(regions.branchId, branchId)
    : undefined;
  const regionsList = regionsWhere
    ? await db.select().from(regions).where(regionsWhere)
    : await db.select().from(regions);
  const byRegion = await Promise.all(
    regionsList.map(async (region) => {
      const regionOrders = allOrders.filter(o => o.regionId === region.id && o.status === "delivered");
      const revenue = regionOrders.reduce((sum, order) => sum + order.price, 0);
      return {
        regionName: region.name,
        orderCount: regionOrders.length,
        revenue,
      };
    })
  );

  // Top region
  const topRegion = byRegion.sort((a, b) => b.orderCount - a.orderCount)[0] || null;

  // By delivery person - filtered by branchId
  const deliveryWhere = branchId
    ? and(eq(users.role, "delivery"), eq(users.branchId, branchId))
    : eq(users.role, "delivery");
  const deliveryPersons = await db.select().from(users).where(deliveryWhere);
  const byDelivery = await Promise.all(
    deliveryPersons.map(async (person) => {
      const personOrders = allOrders.filter(o => o.deliveryPersonId === person.id);
      const deliveredPersonOrders = personOrders.filter(o => o.status === "delivered");
      const revenue = deliveredPersonOrders.reduce((sum, order) => sum + order.price, 0);
      return {
        deliveryName: person.name || person.username || "غير معروف",
        totalOrders: deliveredPersonOrders.length,
        deliveredCount: deliveredPersonOrders.length,
        postponedCount: personOrders.filter(o => o.status === "postponed").length,
        activeCount: personOrders.filter(o => o.status === "pending").length,
        revenue,
      };
    })
  );

  // Top delivery
  const topDelivery = byDelivery.sort((a, b) => b.deliveredCount - a.deliveredCount)[0] || null;

  return {
    totalRevenue,
    averageOrderValue: Math.round(averageOrderValue),
    byStatus,
    byRegion: byRegion.filter(r => r.orderCount > 0),
    topRegion,
    byDelivery: byDelivery.filter(d => d.totalOrders > 0),
    topDelivery,
  };
}

// ===== Notifications Management =====

export async function createNotification(data: {
  branchId: number;
  userId: number;
  title: string;
  message: string;
  type?: "order_assigned" | "order_accepted" | "order_rejected" | "order_delivered" | "order_postponed" | "order_returned" | "message" | "general";
  orderId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(notifications).values({
    branchId: data.branchId,
    userId: data.userId,
    title: data.title,
    message: data.message,
    type: data.type,
    orderId: data.orderId,
    createdAt: getCurrentTimeISOInIraq(),
  });
  
  // Send Firebase push notification
  try {
    const { sendPushNotification } = await import("./_core/firebase");
    const user = await getUserById(data.userId);
    if (user?.fcmToken) {
      await sendPushNotification(
        user.fcmToken,
        data.title,
        data.message,
        {
          type: data.type || "general",
          orderId: data.orderId?.toString() || "",
        }
      );
      console.log(`[FCM] Push sent to user ${data.userId}`);
    }
  } catch (error) {
    console.error("[FCM] Failed to send push notification:", error);
  }
}

export async function getUserNotifications(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt));
}

export async function getUnreadNotificationsCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, 0)));
  return result[0]?.count || 0;
}

export async function markNotificationAsRead(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(notifications).set({ isRead: 1 }).where(eq(notifications.id, id));
}

export async function markAllNotificationsAsRead(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(notifications).set({ isRead: 1 }).where(eq(notifications.userId, userId));
}

// ===== Messages Management =====

export async function createMessage(data: {
  branchId: number;
  senderId: number;
  receiverId?: number;
  title: string;
  content: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // If receiverId is null, send to all delivery persons in the same branch
  if (!data.receiverId) {
    const deliveryPersons = await db.select().from(users)
      .where(and(eq(users.branchId, data.branchId), eq(users.role, "delivery")));
    
    for (const person of deliveryPersons) {
      await db.insert(messages).values({
        branchId: data.branchId,
        senderId: data.senderId,
        receiverId: person.id,
        title: data.title,
        content: data.content,
      });
      
      // Create notification for each delivery person
      await createNotification({
        branchId: data.branchId,
        userId: person.id,
        title: "رسالة جديدة من الإدارة",
        message: data.title,
        type: "message",
      });
    }
  } else {
    await db.insert(messages).values({
      branchId: data.branchId,
      senderId: data.senderId,
      receiverId: data.receiverId,
      title: data.title,
      content: data.content,
    });
    
    // Create notification for the receiver
    await createNotification({
      branchId: data.branchId,
      userId: data.receiverId,
      title: "رسالة جديدة من الإدارة",
      message: data.title,
      type: "message",
    });
  }
}

export async function getUserMessages(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(messages).where(eq(messages.receiverId, userId)).orderBy(desc(messages.createdAt));
}

export async function getUnreadMessagesCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(messages)
    .where(and(eq(messages.receiverId, userId), eq(messages.isRead, 0)));
  return result[0]?.count || 0;
}

export async function markMessageAsRead(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(messages).set({ isRead: 1 }).where(eq(messages.id, id));
}

// ===== Location Tracking =====

export async function updateUserLocation(userId: number, latitude: string, longitude: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ 
    latitude, 
    longitude,
    lastLocationUpdate: new Date().toISOString(),
  }).where(eq(users.id, userId));
}

export async function getAllDeliveryLocations() {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      latitude: users.latitude,
      longitude: users.longitude,
      lastLocationUpdate: users.lastLocationUpdate,
    })
    .from(users)
    .where(and(eq(users.role, "delivery"), eq(users.isActive, 1)));
}

// ===== Custom Statistics with Filters =====

export async function getCustomStats(filters: {
  startDate?: string;
  endDate?: string;
  regionIds?: number[];
  provinceIds?: number[];
  deliveryPersonIds?: number[];
  branchId?: number | null;
}) {
  const db = await getDb();
  if (!db) return null;

  let query = db.select().from(orders);
  const conditions = [eq(orders.isDeleted, 0)]; // Exclude deleted orders

  // Branch filter
  if (filters.branchId !== null && filters.branchId !== undefined) {
    conditions.push(eq(orders.branchId, filters.branchId));
  }

  // Date filters
  if (filters.startDate) {
    conditions.push(sql`${orders.createdAt} >= ${filters.startDate}`);
  }
  if (filters.endDate) {
    conditions.push(sql`${orders.createdAt} <= ${filters.endDate}`);
  }

  // Region filter
  if (filters.regionIds && filters.regionIds.length > 0) {
    conditions.push(sql`${orders.regionId} IN (${sql.join(filters.regionIds.map(id => sql`${id}`), sql`, `)})`);
  }

  // Province filter
  if (filters.provinceIds && filters.provinceIds.length > 0) {
    conditions.push(sql`${orders.provinceId} IN (${sql.join(filters.provinceIds.map(id => sql`${id}`), sql`, `)})`);
  }

  // Delivery person filter
  if (filters.deliveryPersonIds && filters.deliveryPersonIds.length > 0) {
    conditions.push(sql`${orders.deliveryPersonId} IN (${sql.join(filters.deliveryPersonIds.map(id => sql`${id}`), sql`, `)})`);
  }

  // Apply filters
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  const filteredOrders = await query;

  // Calculate statistics
  const deliveredOrders = filteredOrders.filter(o => o.status === "delivered");
  const totalOrders = filteredOrders.length; // إجمالي جميع الطلبات (مثل لوحة التحكم)
  const totalRevenue = deliveredOrders.reduce((sum, order) => sum + order.price, 0);
  const averageOrderValue = deliveredOrders.length > 0 ? totalRevenue / deliveredOrders.length : 0;

  const byStatus = {
    pending: filteredOrders.filter(o => o.status === "pending").length,
    delivered: filteredOrders.filter(o => o.status === "delivered").length,
    postponed: filteredOrders.filter(o => o.status === "postponed").length,
    cancelled: filteredOrders.filter(o => o.status === "cancelled").length,
    returned: filteredOrders.filter(o => o.status === "returned").length,
  };

  // Group by region
  const regionMap = new Map<number, { regionName: string; orderCount: number; totalRevenue: number }>();
  for (const order of deliveredOrders) {
    if (!order.regionId) continue;
    const existing = regionMap.get(order.regionId);
    if (existing) {
      existing.orderCount++;
      existing.totalRevenue += order.price;
    } else {
      const region = await db.select().from(regions).where(eq(regions.id, order.regionId)).limit(1);
      regionMap.set(order.regionId, {
        regionName: region[0]?.name || 'غير معروف',
        orderCount: 1,
        totalRevenue: order.price,
      });
    }
  }
  const byRegion = Array.from(regionMap.values());

  // Group by delivery person
  const deliveryMap = new Map<number, { deliveryPersonName: string; orderCount: number; totalRevenue: number }>();
  for (const order of deliveredOrders) {
    if (!order.deliveryPersonId) continue;
    const existing = deliveryMap.get(order.deliveryPersonId);
    if (existing) {
      existing.orderCount++;
      existing.totalRevenue += order.price;
    } else {
      const person = await db.select().from(users).where(eq(users.id, order.deliveryPersonId)).limit(1);
      deliveryMap.set(order.deliveryPersonId, {
        deliveryPersonName: person[0]?.name || 'غير معروف',
        orderCount: 1,
        totalRevenue: order.price,
      });
    }
  }
  const byDeliveryPerson = Array.from(deliveryMap.values());

  return {
    totalOrders,
    totalRevenue,
    averageOrderValue: Math.round(averageOrderValue),
    byStatus,
    byRegion,
    byDeliveryPerson,
    orders: filteredOrders,
  };
}

// User management functions
export async function createAdminUser(data: { name: string; username: string; password: string; permissions: string[]; branchId?: number | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const passwordHash = await hash(data.password, 10);
  
  console.log('[createAdminUser] Received permissions:', data.permissions);
  console.log('[createAdminUser] branchId:', data.branchId);
  console.log('[createAdminUser] JSON.stringify:', JSON.stringify(data.permissions));
  
  const [result] = await db.insert(users).values({
    name: data.name,
    username: data.username,
    passwordHash,
    role: "admin",
    branchId: data.branchId || null,
    permissions: JSON.stringify(data.permissions),
    loginMethod: "custom",
    isActive: 1,
  });

  console.log('[createAdminUser] User inserted successfully');
  return result;
}

export async function updateUserPermissions(userId: number, permissions: string[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users)
    .set({ permissions: JSON.stringify(permissions) })
    .where(eq(users.id, userId));
}

// Delete order (soft delete)
export async function deleteOrder(orderId: number, deletedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(orders)
    .set({ 
      isDeleted: 1, 
      deletedAt: new Date().toISOString(),
      deletedBy 
    })
    .where(eq(orders.id, orderId));
}

// Get deleted orders
export async function getDeletedOrders(branchId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  
  // Filter by branchId if provided
  const whereConditions = branchId 
    ? and(eq(orders.isDeleted, 1), eq(orders.branchId, branchId))
    : eq(orders.isDeleted, 1);
  
  return await db.select().from(orders).where(whereConditions).orderBy(desc(orders.deletedAt));
}

// Restore deleted order
export async function restoreOrder(orderId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(orders)
    .set({ 
      isDeleted: 0, 
      deletedAt: null,
      deletedBy: null 
    })
    .where(eq(orders.id, orderId));
}


// ==================== Customers Management ====================

export async function createCustomer(data: {
  branchId: number;
  name?: string;
  phone?: string;
  email?: string;
  address1?: string;
  address2?: string;
  locationUrl1?: string;
  locationUrl2?: string;
  notes?: string;
  regionId?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { customers } = await import("../drizzle/schema");
  const [result] = await db.insert(customers).values(data);
  return { id: Number(result.insertId) };
}

export async function getCustomerByPhone(phone: string, branchId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const { customers } = await import("../drizzle/schema");
  const result = await db.select().from(customers).where(and(eq(customers.phone, phone), eq(customers.branchId, branchId))).limit(1);
  return result[0] || null;
}

export async function getCustomerById(customerId: number, branchId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const { customers } = await import("../drizzle/schema");
  const result = await db.select().from(customers).where(and(eq(customers.id, customerId), eq(customers.branchId, branchId))).limit(1);
  return result[0] || null;
}

export async function getAllCustomers(branchId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  
  const { customers } = await import("../drizzle/schema");
  
  // إذا كان branchId موجود، فلتر حسب الفرع
  if (branchId) {
    return await db.select().from(customers)
      .where(eq(customers.branchId, branchId))
      .orderBy(desc(customers.createdAt));
  }
  
  return await db.select().from(customers).orderBy(desc(customers.createdAt));
}

export async function searchCustomers(
  query: string, 
  branchId: number,
  spentRange?: 'under50k' | '50k-100k' | '100k-500k' | 'over500k',
  orderStatus?: 'delivered' | 'returned' | 'cancelled' | 'postponed'
) {
  const db = await getDb();
  if (!db) return [];
  
  const { customers: customersTable, regions, orders: ordersTable } = await import("../drizzle/schema");
  
  // Calculate total spent using raw SQL for better performance
  const results = await db.execute(sql`
    SELECT 
      c.id,
      c.name,
      c.phone,
      c.email,
      c.address1,
      c.address2,
      c.locationUrl1,
      c.locationUrl2,
      c.notes,
      c.regionId,
      ANY_VALUE(r.name) as regionName,
      c.lastDeliveryLocation,
      c.lastDeliveryAt,
      c.createdAt,
      COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN o.price ELSE 0 END), 0) as totalSpent
    FROM ${customersTable} c
    LEFT JOIN ${regions} r ON c.regionId = r.id
    LEFT JOIN ${ordersTable} o ON c.id = o.customerId
    WHERE c.branchId = ${branchId}
      AND (c.name LIKE ${`%${query}%`} OR c.phone LIKE ${`%${query}%`} OR c.email LIKE ${`%${query}%`})
      ${orderStatus ? sql`AND EXISTS (SELECT 1 FROM ${ordersTable} o2 WHERE o2.customerId = c.id AND o2.status = ${orderStatus})` : sql``}
    GROUP BY c.id, c.name, c.phone, c.email, c.address1, c.address2, c.locationUrl1, c.locationUrl2, c.notes, c.regionId, c.lastDeliveryLocation, c.lastDeliveryAt, c.createdAt
    ${
      spentRange === 'under50k' ? sql`HAVING totalSpent < 50000` :
      spentRange === '50k-100k' ? sql`HAVING totalSpent >= 50000 AND totalSpent < 100000` :
      spentRange === '100k-500k' ? sql`HAVING totalSpent >= 100000 AND totalSpent < 500000` :
      spentRange === 'over500k' ? sql`HAVING totalSpent >= 500000` :
      sql``
    }
    ORDER BY c.createdAt DESC
  `);

  // results is [rows, fields] from mysql2
  return (results as any)[0] || [];
}

export async function updateCustomer(customerId: number, data: {
  name?: string;
  phone?: string;
  email?: string;
  address1?: string;
  address2?: string;
  locationUrl1?: string;
  locationUrl2?: string;
  notes?: string;
  regionId?: number | null;
  lastDeliveryLocation?: string;
  lastDeliveryAt?: Date | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { customers } = await import("../drizzle/schema");
  const updateData: any = { ...data };
  if (data.lastDeliveryAt) {
    updateData.lastDeliveryAt = data.lastDeliveryAt.toISOString();
  }
  await db.update(customers).set(updateData).where(eq(customers.id, customerId));
}

export async function getCustomerOrders(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select({
    id: orders.id,
    customerId: orders.customerId,
    customerName: customers.name,
    customerPhone: customers.phone,
    address: orders.address,
    locationLink: orders.locationLink,
    price: orders.price,
    status: orders.status,
    note: orders.note,
    deliveryNote: orders.deliveryNote,
    deliveryImage: orders.deliveryImage,
    deliveryLocationName: orders.deliveryLocationName,
    createdAt: orders.createdAt,
    acceptedAt: orders.acceptedAt,
    deliveredAt: orders.deliveredAt,
    deliveryPersonId: orders.deliveryPersonId,
    deliveryPersonName: users.name,
    deliveryPersonUsername: users.username,
    regionId: orders.regionId,
    isDeleted: orders.isDeleted,
  })
  .from(orders)
  .leftJoin(customers, eq(orders.customerId, customers.id))
  .leftJoin(users, eq(orders.deliveryPersonId, users.id))
  .where(and(
   and(eq(orders.customerId, customerId), eq(orders.isDeleted, 0))
  ))
  .orderBy(desc(orders.createdAt));
  
  return result;
}

export async function getCustomerStats(customerId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const customerOrders = await db.select().from(orders)
    .where(and(
      eq(orders.customerId, customerId),
      eq(orders.isDeleted, 0)
    ));
  
  const deliveredOrders = customerOrders.filter(o => o.status === "delivered");
  const totalSpent = deliveredOrders.reduce((sum, order) => sum + order.price, 0);
  
  return {
    totalOrders: customerOrders.length,
    deliveredOrders: deliveredOrders.length,
    postponedOrders: customerOrders.filter(o => o.status === "postponed").length,
    cancelledOrders: customerOrders.filter(o => o.status === "cancelled").length,
    totalSpent,
  };
}


// ==================== Advanced Reports ====================

// Get incomplete orders report (postponed, cancelled, pending)
export async function getIncompleteOrdersReport(branchId?: number | null) {
  const db = await getDb();
  if (!db) return null;
  
  // Filter by branchId if provided
  const ordersWhere = branchId 
    ? and(eq(orders.isDeleted, 0), eq(orders.branchId, branchId))
    : eq(orders.isDeleted, 0);
  const allOrders = await db.select().from(orders).where(ordersWhere);
  
  const incompleteOrders = allOrders.filter(o => 
    o.status === "postponed" || o.status === "cancelled" || o.status === "pending" || o.status === "returned"
  );
  
  return {
    total: incompleteOrders.length,
    postponed: incompleteOrders.filter(o => o.status === "postponed"),
    cancelled: incompleteOrders.filter(o => o.status === "cancelled"),
    pending: incompleteOrders.filter(o => o.status === "pending"),
    returned: incompleteOrders.filter(o => o.status === "returned"),
    byReason: {
      postponeReasons: incompleteOrders
        .filter(o => o.status === "postponed" && o.postponeReason)
        .reduce((acc: any, order) => {
          const reason = order.postponeReason || "غير محدد";
          acc[reason] = (acc[reason] || 0) + 1;
          return acc;
        }, {}),
      returnReasons: incompleteOrders
        .filter(o => o.status === "returned" && o.returnReason)
        .reduce((acc: any, order) => {
          const reason = order.returnReason || "غير محدد";
          acc[reason] = (acc[reason] || 0) + 1;
          return acc;
        }, {}),
    },
  };
}

// Get monthly performance comparison
export async function getMonthlyPerformance(year?: number, branchId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  
  const targetYear = year || new Date().getFullYear();
  
  // Filter by branchId if provided
  const whereConditions = branchId 
    ? and(eq(orders.isDeleted, 0), eq(orders.branchId, branchId))
    : eq(orders.isDeleted, 0);
  
  const allOrders = await db.select().from(orders).where(whereConditions);
  
  const monthlyData = [];
  for (let month = 1; month <= 12; month++) {
    const monthOrders = allOrders.filter(o => {
      const orderDate = new Date(o.createdAt);
      return orderDate.getFullYear() === targetYear && orderDate.getMonth() + 1 === month;
    });
    
    const deliveredOrders = monthOrders.filter(o => o.status === "delivered");
    const revenue = deliveredOrders.reduce((sum, order) => sum + order.price, 0);
    
    monthlyData.push({
      month,
      monthName: new Date(targetYear, month - 1).toLocaleString("ar-IQ", { month: "long" }),
      totalOrders: deliveredOrders.length,
      revenue,
      avgOrderValue: deliveredOrders.length > 0 ? revenue / deliveredOrders.length : 0,
      deliveryRate: monthOrders.length > 0 ? (deliveredOrders.length / monthOrders.length) * 100 : 0,
    });
  }
  
  return monthlyData;
}

// Get delivery speed statistics
export async function getDeliverySpeedStats(deliveryPersonId?: number) {
  const db = await getDb();
  if (!db) return null;
  
  let deliveredOrders = await db.select().from(orders).where(
    and(
      eq(orders.isDeleted, 0),
      eq(orders.status, "delivered")
    )
  );
  
  if (deliveryPersonId) {
    deliveredOrders = deliveredOrders.filter(o => o.deliveryPersonId === deliveryPersonId);
  }
  
  // Filter orders that have both acceptedAt and deliveredAt
  const ordersWithTimes = deliveredOrders.filter(o => o.acceptedAt && o.deliveredAt);
  
  if (ordersWithTimes.length === 0) {
    return {
      avgDeliveryTime: 0,
      fastestDelivery: 0,
      slowestDelivery: 0,
      totalOrders: 0,
    };
  }
  
  const deliveryTimes = ordersWithTimes.map(o => {
    const accepted = new Date(o.acceptedAt!).getTime();
    const delivered = new Date(o.deliveredAt!).getTime();
    return (delivered - accepted) / (1000 * 60); // minutes
  });
  
  const avgDeliveryTime = deliveryTimes.reduce((sum, time) => sum + time, 0) / deliveryTimes.length;
  const fastestDelivery = Math.min(...deliveryTimes);
  const slowestDelivery = Math.max(...deliveryTimes);
  
  return {
    avgDeliveryTime: Math.round(avgDeliveryTime),
    fastestDelivery: Math.round(fastestDelivery),
    slowestDelivery: Math.round(slowestDelivery),
    totalOrders: ordersWithTimes.length,
  };
}

// Get enhanced delivery person performance
export async function getEnhancedDeliveryPerformance(deliveryPersonId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const personOrders = await db.select().from(orders).where(
    and(
      eq(orders.deliveryPersonId, deliveryPersonId),
      eq(orders.isDeleted, 0)
    )
  );
  
  const deliveredOrders = personOrders.filter(o => o.status === "delivered");
  const speedStats = await getDeliverySpeedStats(deliveryPersonId);
  
  // Calculate average delay compared to overall average
  const overallSpeedStats = await getDeliverySpeedStats();
  const avgDelay = speedStats && overallSpeedStats 
    ? speedStats.avgDeliveryTime - overallSpeedStats.avgDeliveryTime 
    : 0;
  
  return {
    totalOrders: personOrders.length,
    deliveredOrders: deliveredOrders.length,
    postponedOrders: personOrders.filter(o => o.status === "postponed").length,
    cancelledOrders: personOrders.filter(o => o.status === "cancelled").length,
    returnedOrders: personOrders.filter(o => o.status === "returned").length,
    deliveryRate: personOrders.length > 0 ? (deliveredOrders.length / personOrders.length) * 100 : 0,
    totalRevenue: deliveredOrders.reduce((sum, order) => sum + order.price, 0),
    avgDeliveryTime: speedStats?.avgDeliveryTime || 0,
    fastestDelivery: speedStats?.fastestDelivery || 0,
    slowestDelivery: speedStats?.slowestDelivery || 0,
    avgDelay: Math.round(avgDelay),
    performance: avgDelay < 0 ? "ممتاز" : avgDelay < 30 ? "جيد" : "يحتاج تحسين",
  };
}

/**
 * GPS Tracking Functions - دوال تتبع المواقع
 */

/**
 * Save delivery person location
 */
export async function saveDeliveryLocation(data: InsertDeliveryLocation) {
  const db = await getDb();
  if (!db) return null;
  
  await db.insert(deliveryLocations).values(data);
  return true;
}

/**
 * Get active delivery persons with their latest locations
 */
export async function getActiveDeliveryLocations() {
  const db = await getDb();
  if (!db) return [];
  
  // Get all active delivery persons with their latest locations (even if old)
  const result = await db.execute(sql`
    SELECT 
      u.id as deliveryPersonId,
      dl.latitude,
      dl.longitude,
      dl.accuracy,
      dl.createdAt as timestamp,
      u.name as deliveryPersonName,
      u.profileImage,
      u.isActive,
      CASE 
        WHEN dl.createdAt >= DATE_SUB(NOW(), INTERVAL 5 MINUTE) THEN 'online'
        WHEN dl.createdAt >= DATE_SUB(NOW(), INTERVAL 30 MINUTE) THEN 'recent'
        ELSE 'offline'
      END as status,
      COUNT(CASE WHEN o.status IN ('pending', 'in_transit') THEN 1 END) as activeOrders
    FROM users u
    LEFT JOIN (
      SELECT 
        deliveryPersonId,
        latitude,
        longitude,
        accuracy,
        timestamp
      FROM deliveryLocations dl1
      WHERE dl1.id IN (
        SELECT MAX(id) 
        FROM deliveryLocations 
        GROUP BY deliveryPersonId
      )
    ) dl ON u.id = dl.deliveryPersonId
    LEFT JOIN orders o ON o.deliveryPersonId = u.id AND o.isDeleted = 0
    WHERE u.role = 'delivery' 
      AND u.isActive = 1
    GROUP BY u.id, dl.latitude, dl.longitude, dl.accuracy, dl.createdAt, u.name, u.profileImage, u.isActive
  `);
  
  return (result[0] as unknown as any[]) || [];
}

/**
 * Get location history for a specific delivery person
 */
export async function getDeliveryLocationHistory(deliveryPersonId: number, hours: number = 24) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select()
    .from(deliveryLocations)
    .where(
      and(
        eq(deliveryLocations.deliveryPersonId, deliveryPersonId),
        sql`${deliveryLocations.createdAt} >= DATE_SUB(NOW(), INTERVAL ${hours} HOUR)`
      )
    )
    .orderBy(desc(deliveryLocations.createdAt));
  
  return result;
}

/**
 * Daily Statistics Functions
 */

/**
 * Save daily statistics snapshot
 */
export async function saveDailyStatsSnapshot(branchId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const { dailyStats } = await import("../drizzle/schema");
  
  // Get business date (اليوم حسب منطق 5 فجراً)
  const dateStr = getBusinessDateString();
  
  // Get yesterday's date range (from 5 AM to 5 AM next day)
  const { start: yesterday, end: yesterdayEnd } = getYesterdayRange();
  
  // Get current stats (filtered by branchId)
  const totalOrdersResult = await db.select({ count: sql<number>`COUNT(*)` })
    .from(orders)
    .where(and(eq(orders.branchId, branchId), eq(orders.isDeleted, 0)));
  
  const deliveredOrdersResult = await db.select({ count: sql<number>`COUNT(*)` })
    .from(orders)
    .where(and(eq(orders.branchId, branchId), eq(orders.status, "delivered"), eq(orders.isDeleted, 0)));
  
  const pendingOrdersResult = await db.select({ count: sql<number>`COUNT(*)` })
    .from(orders)
    .where(and(eq(orders.branchId, branchId), eq(orders.status, "pending"), eq(orders.isDeleted, 0)));
  
  const postponedOrdersResult = await db.select({ count: sql<number>`COUNT(*)` })
    .from(orders)
    .where(and(eq(orders.branchId, branchId), eq(orders.status, "postponed"), eq(orders.isDeleted, 0)));
  
  const returnedOrdersResult = await db.select({ count: sql<number>`COUNT(*)` })
    .from(orders)
    .where(and(eq(orders.branchId, branchId), eq(orders.status, "returned"), eq(orders.isDeleted, 0)));
  
  const activeDeliveriesResult = await db.select({ count: sql<number>`COUNT(*)` })
    .from(users)
    .where(and(eq(users.branchId, branchId), eq(users.role, "delivery"), eq(users.isActive, 1)));
  
  const totalRegionsResult = await db.select({ count: sql<number>`COUNT(*)` })
    .from(regions)
    .where(eq(regions.branchId, branchId));
  
  // Calculate yesterday's profit (delivered orders only)
  const profitResult = await db.select({ sum: sql<number>`COALESCE(SUM(${orders.price}), 0)` })
    .from(orders)
    .where(
      and(
        eq(orders.branchId, branchId),
        eq(orders.status, "delivered"),
        eq(orders.isDeleted, 0),
        sql`${orders.deliveredAt} >= ${yesterday.toISOString()}`,
        sql`${orders.deliveredAt} <= ${yesterdayEnd.toISOString()}`
      )
    );
  
  const statsData = {
    branchId,
    date: dateStr,
    totalOrders: totalOrdersResult[0]?.count || 0,
    deliveredOrders: deliveredOrdersResult[0]?.count || 0,
    pendingOrders: pendingOrdersResult[0]?.count || 0,
    postponedOrders: postponedOrdersResult[0]?.count || 0,
    returnedOrders: returnedOrdersResult[0]?.count || 0,
    activeDeliveries: activeDeliveriesResult[0]?.count || 0,
    totalRegions: totalRegionsResult[0]?.count || 0,
    totalProfit: profitResult[0]?.sum || 0,
  };
  
  // Check if snapshot for today already exists
  const existing = await db.select().from(dailyStats)
    .where(and(eq(dailyStats.branchId, branchId), eq(dailyStats.date, dateStr)))
    .limit(1);
  
  if (existing.length > 0) {
    // Update existing snapshot
    await db.update(dailyStats).set(statsData)
      .where(and(eq(dailyStats.branchId, branchId), eq(dailyStats.date, dateStr)));
  } else {
    // Insert new snapshot
    await db.insert(dailyStats).values(statsData);
  }
  
  return statsData;
}

/**
 * Get today's statistics (orders created today only)
 */
export async function getTodayStats(branchId?: number | null) {
  const db = await getDb();
  if (!db) return null;
  
  // Get today's range (from 5 AM to 5 AM next day)
  const { start: today, end: tomorrow } = getTodayRange();
  
  // Build where conditions
  const conditions = [
    eq(orders.isDeleted, 0),
    sql`${orders.createdAt} >= ${today.toISOString()}`,
    sql`${orders.createdAt} <= ${tomorrow.toISOString()}`
  ];
  
  if (branchId) {
    conditions.push(eq(orders.branchId, branchId));
  }
  
  // Get today's orders only
  const todayOrders = await db.select().from(orders).where(and(...conditions));
  
  const deliveredToday = todayOrders.filter(o => o.status === "delivered");
  const pendingToday = todayOrders.filter(o => o.status === "pending");
  const postponedToday = todayOrders.filter(o => o.status === "postponed");
  const returnedToday = todayOrders.filter(o => o.status === "returned");
  
  // Get active deliveries count
  const deliveryConditions = [eq(users.role, "delivery"), eq(users.isActive, 1)];
  if (branchId) {
    deliveryConditions.push(eq(users.branchId, branchId));
  }
  const activeDeliveriesResult = await db.select({ count: sql<number>`COUNT(*)` }).from(users).where(and(...deliveryConditions));
  
  const regionConditions = [];
  if (branchId) {
    regionConditions.push(eq(regions.branchId, branchId));
  }
  const totalRegionsResult = await db.select({ count: sql<number>`COUNT(*)` }).from(regions).where(regionConditions.length > 0 ? and(...regionConditions) : undefined);
  
  // Get recent orders for today
  const recentOrderConditions = [
    eq(orders.isDeleted, 0),
    sql`${orders.createdAt} >= ${today.toISOString().split('T')[0]}`,
    sql`${orders.createdAt} < ${tomorrow.toISOString().split('T')[0]}`
  ];
  if (branchId) {
    recentOrderConditions.push(eq(orders.branchId, branchId));
  }
  const recentOrders = await db
    .select({
      id: orders.id,
      price: orders.price,
      status: orders.status,
      region: regions.name,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .leftJoin(regions, eq(orders.regionId, regions.id))
    .where(and(...recentOrderConditions))
    .orderBy(desc(orders.createdAt))
    .limit(5);
  
  // Get top delivery persons for today
  const topDeliveryConditions = [eq(users.role, "delivery")];
  if (branchId) {
    topDeliveryConditions.push(eq(users.branchId, branchId));
  }
  
  const topDeliveryJoinConditions = [
    eq(orders.deliveryPersonId, users.id),
    eq(orders.status, "delivered"),
    eq(orders.isDeleted, 0),
    sql`${orders.createdAt} >= ${today.toISOString()}`,
    sql`${orders.createdAt} <= ${tomorrow.toISOString()}`
  ];
  if (branchId) {
    topDeliveryJoinConditions.push(eq(orders.branchId, branchId));
  }
  
  const topDeliveries = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      deliveredCount: sql<number>`COUNT(${orders.id})`,
    })
    .from(users)
    .leftJoin(orders, and(...topDeliveryJoinConditions))
    .where(and(...topDeliveryConditions))
    .groupBy(users.id)
    .orderBy(desc(sql<number>`COUNT(${orders.id})`))
    .limit(5);
  
  // Get top regions for today
  const topRegionJoinConditions = [
    eq(orders.regionId, regions.id),
    eq(orders.isDeleted, 0),
    sql`${orders.createdAt} >= ${today.toISOString()}`,
    sql`${orders.createdAt} <= ${tomorrow.toISOString()}`
  ];
  if (branchId) {
    topRegionJoinConditions.push(eq(orders.branchId, branchId));
  }
  
  const topRegionsQueryBase = db
    .select({
      id: regions.id,
      name: regions.name,
      orderCount: sql<number>`COUNT(${orders.id})`,
    })
    .from(regions)
    .leftJoin(orders, and(...topRegionJoinConditions));
  
  const topRegions = branchId
    ? await topRegionsQueryBase
        .where(eq(regions.branchId, branchId))
        .groupBy(regions.id)
        .orderBy(desc(sql<number>`COUNT(${orders.id})`))
        .limit(5)
    : await topRegionsQueryBase
        .groupBy(regions.id)
        .orderBy(desc(sql<number>`COUNT(${orders.id})`))
        .limit(5);
  
  return {
    totalOrders: todayOrders.length,
    deliveredOrders: deliveredToday.length,
    pendingOrders: pendingToday.length,
    postponedOrders: postponedToday.length,
    returnedOrders: returnedToday.length,
    activeDeliveries: activeDeliveriesResult[0]?.count || 0,
    totalRegions: totalRegionsResult[0]?.count || 0,
    recentOrders,
    topDeliveries,
    topRegions,
  };
}

/**
 * Get stats for a specific day (5am to 5am)
 */
export async function getSpecificDayStats(month: number, day: number, year?: number, branchId?: number | null) {
  const db = await getDb();
  if (!db) return null;
  
  const currentYear = year || new Date().getFullYear();
  
  // Get day range (from 5 AM to 5 AM next day)
  const date = new Date(currentYear, month - 1, day);
  const dayStart = getStartOfDay(date);
  const dayEnd = getEndOfDay(date);
  
  // Get day's orders
  const dayOrderConditions = [
    eq(orders.isDeleted, 0),
    sql`${orders.createdAt} >= ${dayStart.toISOString()}`,
    sql`${orders.createdAt} < ${dayEnd.toISOString()}`
  ];
  if (branchId) {
    dayOrderConditions.push(eq(orders.branchId, branchId));
  }
  const dayOrders = await db.select().from(orders).where(and(...dayOrderConditions));
  
  const delivered = dayOrders.filter(o => o.status === "delivered");
  const pending = dayOrders.filter(o => o.status === "pending");
  const postponed = dayOrders.filter(o => o.status === "postponed");
  const returned = dayOrders.filter(o => o.status === "returned");
  
  // Get active deliveries count
  const deliveryConditions = [eq(users.role, "delivery"), eq(users.isActive, 1)];
  if (branchId) {
    deliveryConditions.push(eq(users.branchId, branchId));
  }
  const activeDeliveriesResult = await db.select({ count: sql<number>`COUNT(*)` }).from(users).where(and(...deliveryConditions));
  
  const regionConditions = [];
  if (branchId) {
    regionConditions.push(eq(regions.branchId, branchId));
  }
  const totalRegionsResult = await db.select({ count: sql<number>`COUNT(*)` }).from(regions).where(regionConditions.length > 0 ? and(...regionConditions) : undefined);
  
  // Get recent orders for the day
  const recentOrders = await db
    .select({
      id: orders.id,
      price: orders.price,
      status: orders.status,
      region: regions.name,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .leftJoin(regions, eq(orders.regionId, regions.id))
    .where(
      and(
        eq(orders.isDeleted, 0),
        sql`${orders.createdAt} >= ${dayStart.toISOString()}`,
        sql`${orders.createdAt} < ${dayEnd.toISOString()}`
      )
    )
    .orderBy(desc(orders.createdAt))
    .limit(5);
  
  // Get top delivery persons for the day
  const topDeliveries = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      orderCount: sql<number>`COUNT(${orders.id})`,
    })
    .from(users)
    .leftJoin(orders, and(
      eq(orders.deliveryPersonId, users.id),
      eq(orders.status, "delivered"),
      eq(orders.isDeleted, 0),
      sql`${orders.createdAt} >= ${dayStart.toISOString()}`,
      sql`${orders.createdAt} < ${dayEnd.toISOString()}`
    ))
    .where(eq(users.role, "delivery"))
    .groupBy(users.id)
    .orderBy(desc(sql<number>`COUNT(${orders.id})`))
    .limit(5);
  
  // Get top regions for the day
  const topRegions = await db
    .select({
      id: regions.id,
      name: regions.name,
      orderCount: sql<number>`COUNT(${orders.id})`,
    })
    .from(regions)
    .leftJoin(orders, and(
      eq(orders.regionId, regions.id),
      eq(orders.isDeleted, 0),
      sql`${orders.createdAt} >= ${dayStart.toISOString()}`,
      sql`${orders.createdAt} < ${dayEnd.toISOString()}`
    ))
    .groupBy(regions.id)
    .orderBy(desc(sql<number>`COUNT(${orders.id})`))
    .limit(5);
  
  return {
    totalOrders: dayOrders.length,
    deliveredOrders: delivered.length,
    pendingOrders: pending.length,
    postponedOrders: postponed.length,
    returnedOrders: returned.length,
    activeDeliveries: activeDeliveriesResult[0]?.count || 0,
    totalRegions: totalRegionsResult[0]?.count || 0,
    recentOrders,
    topDeliveries,
    topRegions,
  };
}

/**
 * Get stats by date range
 */
export async function getStatsByDateRange(startDate: string, endDate: string, branchId?: number | null) {
  const db = await getDb();  
  if (!db) return null;
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Build where conditions
  const whereConditions = [
    eq(orders.isDeleted, 0),
    sql`${orders.createdAt} >= ${start.toISOString()}`,
    sql`${orders.createdAt} <= ${end.toISOString()}`
  ];
  
  // Add branchId filter if provided
  if (branchId !== undefined && branchId !== null) {
    whereConditions.push(eq(orders.branchId, branchId));
  }
  
  // Get orders in date range
  const rangeOrders = await db.select().from(orders).where(
    and(...whereConditions)
  );
  
  const delivered = rangeOrders.filter(o => o.status === "delivered");
  const pending = rangeOrders.filter(o => o.status === "pending");
  const postponed = rangeOrders.filter(o => o.status === "postponed");
  const returned = rangeOrders.filter(o => o.status === "returned");
  
  // Get active deliveries count (filtered by branch if provided)
  const deliveryWhereConditions = [eq(users.role, "delivery"), eq(users.isActive, 1)];
  if (branchId !== undefined && branchId !== null) {
    deliveryWhereConditions.push(eq(users.branchId, branchId));
  }
  const activeDeliveriesResult = await db.select({ count: sql<number>`COUNT(*)` }).from(users).where(and(...deliveryWhereConditions));
  
  // Get total regions count (regions are shared across branches)
  const totalRegionsResult = await db.select({ count: sql<number>`COUNT(*)` }).from(regions);
  
  // Get recent orders for the range
  const recentOrdersWhere = [
    eq(orders.isDeleted, 0),
    sql`${orders.createdAt} >= ${start.toISOString()}`,
    sql`${orders.createdAt} <= ${end.toISOString()}`
  ];
  if (branchId !== undefined && branchId !== null) {
    recentOrdersWhere.push(eq(orders.branchId, branchId));
  }
  const recentOrders = await db
    .select({
      id: orders.id,
      price: orders.price,
      status: orders.status,
      region: regions.name,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .leftJoin(regions, eq(orders.regionId, regions.id))
    .where(and(...recentOrdersWhere))
    .orderBy(desc(orders.createdAt))
    .limit(5);
  
  // Get top delivery persons for the range
  const topDeliveriesOrderJoin = [
    eq(orders.deliveryPersonId, users.id),
    eq(orders.status, "delivered"),
    eq(orders.isDeleted, 0),
    sql`${orders.createdAt} >= ${start.toISOString()}`,
    sql`${orders.createdAt} <= ${end.toISOString()}`
  ];
  if (branchId !== undefined && branchId !== null) {
    topDeliveriesOrderJoin.push(eq(orders.branchId, branchId));
  }
  const topDeliveriesWhere = [eq(users.role, "delivery")];
  if (branchId !== undefined && branchId !== null) {
    topDeliveriesWhere.push(eq(users.branchId, branchId));
  }
  const topDeliveries = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      deliveredCount: sql<number>`COUNT(${orders.id})`,
    })
    .from(users)
    .leftJoin(orders, and(...topDeliveriesOrderJoin))
    .where(and(...topDeliveriesWhere))
    .groupBy(users.id)
    .orderBy(desc(sql<number>`COUNT(${orders.id})`))
    .limit(5);
  
  // Get top regions for the range
  const topRegionsOrderJoin = [
    eq(orders.regionId, regions.id),
    eq(orders.isDeleted, 0),
    sql`${orders.createdAt} >= ${start.toISOString()}`,
    sql`${orders.createdAt} <= ${end.toISOString()}`
  ];
  if (branchId !== undefined && branchId !== null) {
    topRegionsOrderJoin.push(eq(orders.branchId, branchId));
  }
  // Get top regions (only regions with orders in this branch)
  const topRegions = await db
    .select({
      id: regions.id,
      name: regions.name,
      orderCount: sql<number>`COUNT(${orders.id})`,
    })
    .from(orders)
    .innerJoin(regions, eq(orders.regionId, regions.id))
    .where(and(...topRegionsOrderJoin))
    .groupBy(regions.id)
    .orderBy(desc(sql<number>`COUNT(${orders.id})`))
    .limit(5);
  
  return {
    totalOrders: rangeOrders.length,
    deliveredOrders: delivered.length,
    pendingOrders: pending.length,
    postponedOrders: postponed.length,
    returnedOrders: returned.length,
    activeDeliveries: activeDeliveriesResult[0]?.count || 0,
    totalRegions: totalRegionsResult[0]?.count || 0,
    recentOrders,
    topDeliveries,
    topRegions,
  };
}

/**
 * Save order location (accept or deliver)
 */
export async function saveOrderLocation(data: {
  branchId: number;
  orderId: number;
  deliveryPersonId: number;
  locationType: "accept" | "deliver";
  latitude: string;
  longitude: string;
  accuracy?: string;
}) {
  const db = await getDb();
  if (!db) return null;
  
  const [location] = await db.insert(orderLocations).values({
    branchId: data.branchId,
    orderId: data.orderId,
    deliveryPersonId: data.deliveryPersonId,
    locationType: data.locationType,
    latitude: data.latitude,
    longitude: data.longitude,
    accuracy: data.accuracy,
  });
  return location;
}

/**
 * Get order locations for a specific order
 */
export async function getOrderLocations(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select()
    .from(orderLocations)
    .where(eq(orderLocations.orderId, orderId))
    .orderBy(orderLocations.timestamp);
}

/**
 * Get delivery person's location history for a specific order
 * Returns all GPS points between accept and deliver timestamps
 */
export async function getDeliveryPath(orderId: number, deliveryPersonId: number) {
  const db = await getDb();
  if (!db) return { orderLocations: [], pathPoints: [] };
  
  // Get accept and deliver locations for this order
  const orderLocs = await db
    .select()
    .from(orderLocations)
    .where(and(
      eq(orderLocations.orderId, orderId),
      eq(orderLocations.deliveryPersonId, deliveryPersonId)
    ))
    .orderBy(orderLocations.timestamp);
  
  if (orderLocs.length === 0) {
    return { orderLocations: [], pathPoints: [] };
  }
  
  const acceptLoc = orderLocs.find((loc: any) => loc.locationType === "accept");
  const deliverLoc = orderLocs.find((loc: any) => loc.locationType === "deliver");
  
  if (!acceptLoc || !deliverLoc) {
    return { orderLocations: orderLocs, pathPoints: [] };
  }
  
  // Get all GPS points between accept and deliver timestamps
  const pathPoints = await db
    .select()
    .from(deliveryLocations)
    .where(and(
      eq(deliveryLocations.deliveryPersonId, deliveryPersonId),
      sql`${deliveryLocations.createdAt} >= ${acceptLoc.timestamp}`,
      sql`${deliveryLocations.createdAt} <= ${deliverLoc.timestamp}`
    ))
      .orderBy(deliveryLocations.createdAt);
  
  return {
    orderLocations: orderLocs,
    pathPoints,
  };
}

/**
 * Get all order locations for a delivery person
 */
export async function getDeliveryPersonOrderLocations(deliveryPersonId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  
  const locations = await db
    .select({
      id: orderLocations.id,
      orderId: orderLocations.orderId,
      locationType: orderLocations.locationType,
      latitude: orderLocations.latitude,
      longitude: orderLocations.longitude,
      accuracy: orderLocations.accuracy,
      timestamp: orderLocations.timestamp,
      customerName: customers.name,
      customerPhone: customers.phone,
      status: orders.status,
    })
    .from(orderLocations)
    .leftJoin(orders, eq(orderLocations.orderId, orders.id))
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(orderLocations.deliveryPersonId, deliveryPersonId))
    .orderBy(desc(orderLocations.timestamp))
    .limit(limit);
  
  return locations;
}

// ===== Push Notifications =====

/**
 * Save push subscription for a user
 */
export async function savePushSubscription(data: {
  branchId: number;
  userId: number;
  endpoint: string;
  p256Dh: string;
  auth: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if subscription already exists
  const existing = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, data.userId))
    .limit(1);
  
  if (existing.length > 0) {
    // Update existing subscription
    await db
      .update(pushSubscriptions)
      .set({
        endpoint: data.endpoint,
        p256Dh: data.p256Dh,
        auth: data.auth,
      })
      .where(eq(pushSubscriptions.userId, data.userId));
  } else {
    // Insert new subscription
    await db.insert(pushSubscriptions).values({
      branchId: data.branchId,
      userId: data.userId,
      endpoint: data.endpoint,
      p256Dh: data.p256Dh,
      auth: data.auth,
    });
  }
}

/**
 * Send push notification to a user
 * Supports both Web Push (for PWA) and Firebase FCM (for native apps)
 */
export async function sendPushNotification(
  userId: number,
  payload: { title: string; body: string; data?: any }
) {
  const db = await getDb();
  if (!db) return;
  
  // Get user info to check for FCM token
  const user = await getUserById(userId);
  
  // Try Firebase FCM first (for native app)
  if (user?.fcmToken) {
    try {
      const { sendPushNotification: sendFCM } = await import("./_core/firebase");
      const fcmResult = await sendFCM(
        user.fcmToken,
        payload.title,
        payload.body,
        payload.data ? Object.fromEntries(
          Object.entries(payload.data).map(([k, v]) => [k, String(v)])
        ) : undefined
      );
      if (fcmResult) {
        console.log(`[Push] FCM notification sent to user ${userId}`);
      }
    } catch (error) {
      console.error(`[Push] FCM error for user ${userId}:`, error);
    }
  }
  
  // Get user's web push subscriptions
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
  
  if (subs.length === 0 && !user?.fcmToken) {
    console.log(`[Push] No subscriptions found for user ${userId}`);
    return;
  }
  
  if (subs.length === 0) {
    return; // FCM already sent above
  }
  
  // Import web-push dynamically
  const webpush = await import("web-push");
  
  // VAPID keys - في بيئة الإنتاج، يجب حفظها في متغيرات البيئة
  const vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY || "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDJo3YTIThzWIToeBO3NuMa_Fk1_6Vu_5-xYDx-0_Yl4",
    privateKey: process.env.VAPID_PRIVATE_KEY || "UUxESmb9lJkRRTjdZ03cJPTHxVtJWbpSm3BqRXxSNDU"
  };
  
  webpush.default.setVapidDetails(
    "mailto:admin@joniah.xyz",
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
  
  // Send notification to all user's web push subscriptions
  for (const sub of subs) {
    try {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256Dh,
          auth: sub.auth,
        },
      };
      
      await webpush.default.sendNotification(
        pushSubscription,
        JSON.stringify(payload)
      );
      
      console.log(`[Push] Web notification sent to user ${userId}`);
    } catch (error: any) {
      console.error(`[Push] Web push error:`, error);
      
      // If subscription is invalid (410 Gone), delete it
      if (error.statusCode === 410) {
        await db
          .delete(pushSubscriptions)
          .where(eq(pushSubscriptions.id, sub.id));
        console.log(`[Push] Deleted invalid subscription ${sub.id}`);
      }
    }
  }
}

/**
 * Get active orders with delivery person locations
 */
export async function getActiveOrdersWithLocations() {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.execute(sql`
    SELECT 
      o.id as orderId,
      o.orderNumber,
      o.customerName,
      o.customerPhone,
      o.deliveryAddress,
      o.deliveryLatitude,
      o.deliveryLongitude,
      o.totalAmount,
      o.status,
      o.deliveryPersonId as deliveryPersonId,
      u.name as deliveryPersonName,
      dl.latitude as deliveryPersonLatitude,
      dl.longitude as deliveryPersonLongitude,
      dl.createdAt as lastLocationUpdate
    FROM orders o
    LEFT JOIN users u ON o.deliveryPersonId = u.id
    LEFT JOIN (
      SELECT deliveryPersonId, latitude, longitude, createdAt,
             ROW_NUMBER() OVER (PARTITION BY deliveryPersonId ORDER BY createdAt DESC) as rn
      FROM delivery_locations
    ) dl ON dl.deliveryPersonId = o.deliveryPersonId AND dl.rn = 1
    WHERE o.status IN ('pending', 'in_transit')
      AND o.deliveryPersonId IS NOT NULL
      AND o.deliveryLatitude IS NOT NULL
      AND o.deliveryLongitude IS NOT NULL
    ORDER BY o.createdAt DESC
  `);
  
  return result as any[];
}

/**
 * Check for delivery anomalies (stopped for too long, abnormal speed, disconnected GPS)
 * and send notifications to admin
 */
export async function checkDeliveryAnomalies() {
  const db = await getDb();
  if (!db) return;
  
  try {
    // Check for disconnected delivery persons (no GPS update for > 5 minutes)
    const disconnectedResult = await db.execute(sql`
      SELECT 
        u.id as deliveryPersonId,
        u.name as deliveryPersonName,
        dl.createdAt as lastUpdate,
        TIMESTAMPDIFF(MINUTE, dl.createdAt, NOW()) as minutesSinceUpdate
      FROM users u
      INNER JOIN (
        SELECT 
          deliveryPersonId,
          createdAt,
          ROW_NUMBER() OVER (PARTITION BY deliveryPersonId ORDER BY createdAt DESC) as rn
        FROM delivery_locations
      ) dl ON u.id = dl.deliveryPersonId AND dl.rn = 1
      WHERE u.role = 'delivery' 
        AND u.isActive = 1
        AND TIMESTAMPDIFF(MINUTE, dl.createdAt, NOW()) > 5
        AND TIMESTAMPDIFF(MINUTE, dl.createdAt, NOW()) <= 10
    `);
    
    const disconnectedPersons = (disconnectedResult as any)[0] || [];
    
    if (disconnectedPersons.length > 0) {
      const names = disconnectedPersons.map((p: any) => 
        `${p.deliveryPersonName} (آخر تحديث: منذ ${p.minutesSinceUpdate} دقيقة)`
      ).join('، ');
      
      await notifyOwner({
        title: `⚠️ انقطاع اتصال GPS - ${disconnectedPersons.length} مندوب`,
        content: `المندوبون التاليون لم يرسلوا موقعهم منذ أكثر من 5 دقائق:\n${names}\n\nقد يكون تطبيق Traccar مغلقاً أو GPS متوقف.`
      });
      console.log(`[Anomaly] ${disconnectedPersons.length} delivery persons disconnected:`, names);
    }
    
    // Get all active delivery persons with their latest locations
    const result = await db.execute(sql`
      SELECT 
        u.id as deliveryPersonId,
        u.name as deliveryPersonName,
        dl.latitude,
        dl.longitude,
        dl.speed,
        dl.createdAt,
        TIMESTAMPDIFF(MINUTE, dl.createdAt, NOW()) as minutesSinceUpdate
      FROM users u
      INNER JOIN (
        SELECT 
          deliveryPersonId,
          latitude,
          longitude,
          speed,
          createdAt,
          ROW_NUMBER() OVER (PARTITION BY deliveryPersonId ORDER BY createdAt DESC) as rn
        FROM delivery_locations
      ) dl ON u.id = dl.deliveryPersonId AND dl.rn = 1
      WHERE u.role = 'delivery' 
        AND u.isActive = 1
        AND dl.createdAt >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)
    `);
    
    const locations = (result as any)[0] || [];
    
    for (const loc of locations) {
      const minutesStopped = loc.minutesSinceUpdate;
      const speed = loc.speed ? parseFloat(loc.speed) : 0;
      const speedKmh = speed * 3.6; // m/s to km/h
      
      // Check if stopped for more than 10 minutes
      if (minutesStopped >= 10) {
        await notifyOwner({
          title: `⚠️ المندوب ${loc.deliveryPersonName} متوقف`,
          content: `المندوب ${loc.deliveryPersonName} متوقف منذ ${minutesStopped} دقيقة في نفس الموقع. قد يحتاج للمساعدة.`
        });
        console.log(`[Anomaly] Delivery person ${loc.deliveryPersonName} stopped for ${minutesStopped} minutes`);
      }
      
      // Check for abnormal speed (> 120 km/h)
      if (speedKmh > 120) {
        await notifyOwner({
          title: `⚠️ سرعة غير طبيعية للمندوب ${loc.deliveryPersonName}`,
          content: `المندوب ${loc.deliveryPersonName} يتحرك بسرعة ${Math.round(speedKmh)} كم/س. قد تكون هناك مشكلة في GPS أو حالة طارئة.`
        });
        console.log(`[Anomaly] Delivery person ${loc.deliveryPersonName} moving at ${speedKmh} km/h`);
      }
    }
  } catch (error) {
    console.error('[Anomaly] Error checking delivery anomalies:', error);
  }
}

/**
 * Test Traccar connection for a specific delivery person
 * Returns the last GPS update time and connection status
 */
export async function testTraccarConnection(deliveryPersonId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  try {
    const result = await db.execute(sql`
      SELECT 
        u.id,
        u.name,
        dl.latitude,
        dl.longitude,
        dl.speed,
        dl.accuracy,
        dl.battery,
        dl.createdAt,
        TIMESTAMPDIFF(SECOND, dl.createdAt, NOW()) as secondsSinceUpdate
      FROM users u
      LEFT JOIN (
        SELECT 
          deliveryPersonId,
          latitude,
          longitude,
          speed,
          accuracy,
          battery,
          createdAt,
          ROW_NUMBER() OVER (PARTITION BY deliveryPersonId ORDER BY createdAt DESC) as rn
        FROM delivery_locations
      ) dl ON u.id = dl.deliveryPersonId AND dl.rn = 1
      WHERE u.id = ${deliveryPersonId} AND u.role = 'delivery'
    `);
    
    const data = (result as any)[0];
    if (!data || data.length === 0) {
      return {
        connected: false,
        message: 'المندوب غير موجود',
        lastUpdate: null
      };
    }
    
    const person = data[0];
    
    if (!person.createdAt) {
      return {
        connected: false,
        message: 'لم يتم استقبال أي بيانات GPS من هذا المندوب بعد',
        lastUpdate: null,
        name: person.name
      };
    }
    
    const secondsSinceUpdate = person.secondsSinceUpdate;
    const minutesSinceUpdate = Math.floor(secondsSinceUpdate / 60);
    
    // Connected if last update was within 2 minutes
    const connected = secondsSinceUpdate < 120;
    
    return {
      connected,
      message: connected 
        ? `متصل - آخر تحديث منذ ${secondsSinceUpdate} ثانية`
        : `غير متصل - آخر تحديث منذ ${minutesSinceUpdate} دقيقة`,
      lastUpdate: person.createdAt,
      latitude: person.latitude,
      longitude: person.longitude,
      speed: person.speed,
      accuracy: person.accuracy,
      battery: person.battery,
      name: person.name,
      secondsSinceUpdate
    };
  } catch (error) {
    console.error('[TestConnection] Error:', error);
    throw error;
  }
}

/**
 * Get monthly distances for all delivery persons
 */
export async function getMonthlyDistances(year: number, month: number, branchId?: number | null) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  try {
    // Get all delivery persons (filtered by branchId if provided)
    const deliveryPersons = branchId ? await getDeliveryPersons(branchId) : await getDeliveryPersons();
    
    // Calculate start and end of month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    
    const deliveries = await Promise.all(
      deliveryPersons.map(async (person) => {
        // Get all locations for this month
        const result = await db.execute(sql`
          SELECT 
            latitude,
            longitude,
            timestamp
          FROM delivery_locations
          WHERE deliveryPersonId = ${person.id}
            AND createdAt >= ${startDate}
            AND createdAt <= ${endDate}
          ORDER BY createdAt ASC
        `);
        
        const locations = (result as any)[0] || [];
        
        // Calculate total distance using Haversine formula
        let totalDistance = 0;
        for (let i = 1; i < locations.length; i++) {
          const prev = locations[i - 1];
          const curr = locations[i];
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
          totalDistance += R * c;
        }
        
        // Get delivered orders count for this month
        const ordersResult = await db.select({ count: sql<number>`count(*)` })
          .from(orders)
          .where(
            and(
              eq(orders.deliveryPersonId, person.id),
              eq(orders.status, 'delivered'),
              sql`${orders.deliveredAt} >= ${startDate}`,
              sql`${orders.deliveredAt} <= ${endDate}`
            )
          );
        
        const deliveredOrders = ordersResult[0]?.count || 0;
        const averageDistancePerOrder = deliveredOrders > 0 ? totalDistance / deliveredOrders : 0;
        
        return {
          userId: person.id,
          username: person.username,
          totalDistance,
          deliveredOrders,
          averageDistancePerOrder,
          trackingPoints: locations.length
        };
      })
    );
    
    const totalDistance = deliveries.reduce((sum, d) => sum + d.totalDistance, 0);
    const totalDeliveredOrders = deliveries.reduce((sum, d) => sum + d.deliveredOrders, 0);
    const totalTrackingPoints = deliveries.reduce((sum, d) => sum + d.trackingPoints, 0);
    
    return {
      deliveries: deliveries.sort((a, b) => b.totalDistance - a.totalDistance),
      totalDistance,
      totalDeliveredOrders,
      totalTrackingPoints
    };
  } catch (error) {
    console.error('[MonthlyDistances] Error:', error);
    throw error;
  }
}

/**
 * Get all orders for a specific delivery person
 */
export async function getDeliveryPersonOrders(deliveryPersonId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  try {
    let query = sql`
      SELECT 
        o.*,
        c.name as customerName,
        c.phone as customerPhone,
        r.name as regionName,
        p.name as provinceName
      FROM orders o
      LEFT JOIN customers c ON o.customerId = c.id
      LEFT JOIN regions r ON o.regionId = r.id
      LEFT JOIN provinces p ON o.provinceId = p.id
      WHERE o.deliveryPersonId = ${deliveryPersonId}
        AND o.isDeleted = 0
    `;
    
    if (startDate) {
      query = sql`${query} AND o.createdAt >= ${startDate}`;
    }
    if (endDate) {
      query = sql`${query} AND o.createdAt <= ${endDate}`;
    }
    
    query = sql`${query} ORDER BY o.createdAt DESC`;
    
    const result = await db.execute(query);
    
    return (result as any)[0] || [];
  } catch (error) {
    console.error('[GetDeliveryPersonOrders] Error:', error);
    throw error;
  }
}

/**
 * Get single delivery person by ID
 */
export async function getDeliveryPersonById(id: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const result = await db.select().from(users).where(
    and(
      eq(users.id, id),
      eq(users.role, 'delivery')
    )
  );
  
  return result[0] || null;
}

/**
 * Get order route from acceptance to delivery (GPS tracking points)
 */
export async function getOrderRoute(orderId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  try {
    // Get order details first
    const order = await getOrderById(orderId);
    if (!order) throw new Error('Order not found');
    
    if (!order.acceptedAt || !order.deliveredAt) {
      throw new Error('Order must have both acceptance and delivery timestamps');
    }
    
    // Get GPS tracking points between acceptance and delivery
    const result = await db.execute(sql`
      SELECT 
        latitude,
        longitude,
        timestamp,
        accuracy
      FROM order_locations
      WHERE orderId = ${orderId}
        AND createdAt >= ${order.acceptedAt}
        AND createdAt <= ${order.deliveredAt}
      ORDER BY timestamp ASC
    `);
    
    const locations = (result as any)[0] || [];
    
    return {
      order,
      locations,
      startTime: order.acceptedAt,
      endTime: order.deliveredAt,
      totalPoints: locations.length
    };
  } catch (error) {
    console.error('[GetOrderRoute] Error:', error);
    throw error;
  }
}


// ==================== Traccar API Integration ====================

/**
 * Get Traccar server URL from environment or default
 */
export function getTraccarServerUrl(): string {
  return process.env.TRACCAR_SERVER_URL || 'https://traccar.joniah.xyz';
}

/**
 * Make authenticated request to Traccar API
 */
async function traccarRequest(endpoint: string, username: string, password: string) {
  const baseUrl = getTraccarServerUrl();
  const auth = Buffer.from(`${username}:${password}`).toString('base64');
  
  const response = await fetch(`${baseUrl}/api/${endpoint}`, {
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Traccar API error: ${response.statusText}`);
  }
  
  return await response.json();
}

/**
 * Get all devices from Traccar for a delivery person
 */
export async function getTraccarDevices(deliveryPersonId: number) {
  const user = await getUserById(deliveryPersonId);
  
  if (!user || !user.traccarUsername || !user.traccarPassword) {
    throw new Error('Traccar credentials not configured for this user');
  }
  
  try {
    const devices = await traccarRequest('devices', user.traccarUsername, user.traccarPassword);
    return devices;
  } catch (error: any) {
    console.error(`[Traccar] Error fetching devices for user ${deliveryPersonId}:`, error.message);
    return [];
  }
}

/**
 * Get live positions from Traccar for a delivery person
 */
export async function getTraccarPositions(deliveryPersonId: number) {
  const user = await getUserById(deliveryPersonId);
  
  if (!user || !user.traccarUsername || !user.traccarPassword) {
    throw new Error('Traccar credentials not configured for this user');
  }
  
  try {
    const positions = await traccarRequest('positions', user.traccarUsername, user.traccarPassword);
    return positions;
  } catch (error: any) {
    console.error(`[Traccar] Error fetching positions for user ${deliveryPersonId}:`, error.message);
    return [];
  }
}

/**
 * Get route history from Traccar for a specific device and time range
 */
export async function getTraccarRoute(deliveryPersonId: number, deviceId: number, from: Date, to: Date) {
  const user = await getUserById(deliveryPersonId);
  
  if (!user || !user.traccarUsername || !user.traccarPassword) {
    throw new Error('Traccar credentials not configured for this user');
  }
  
  try {
    const fromISO = from.toISOString();
    const toISO = to.toISOString();
    const route = await traccarRequest(
      `positions?deviceId=${deviceId}&from=${fromISO}&to=${toISO}`,
      user.traccarUsername,
      user.traccarPassword
    );
    return route;
  } catch (error: any) {
    console.error(`[Traccar] Error fetching route for user ${deliveryPersonId}:`, error.message);
    return [];
  }
}

/**
 * Get all delivery persons with their Traccar status (using local database)
 */
export async function getAllTraccarStatus() {
  return await getAllDeliveryPersonsLiveStatus();
}


/**
 * Get all delivery persons with their live GPS status from local database
 */
export async function getAllDeliveryPersonsLiveStatus(branchId?: number | null) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const result = await db.execute(sql`
    SELECT 
      u.id as userId,
      u.username,
      u.name,
      u.phone,
      u.profileImage,
      dl.latitude,
      dl.longitude,
      dl.speed,
      dl.heading,
      dl.accuracy,
      dl.battery,
      dl.createdAt as deviceTime,
      TIMESTAMPDIFF(SECOND, dl.createdAt, NOW()) as secondsSinceUpdate
    FROM users u
    LEFT JOIN (
      SELECT 
        deliveryPersonId,
        latitude,
        longitude,
        speed,
        heading,
        accuracy,
        battery,
        createdAt,
        ROW_NUMBER() OVER (PARTITION BY deliveryPersonId ORDER BY createdAt DESC) as rn
      FROM delivery_locations
    ) dl ON u.id = dl.deliveryPersonId AND dl.rn = 1
    WHERE u.role = 'delivery' ${branchId ? sql`AND u.branchId = ${branchId}` : sql``}
    ORDER BY u.name
  `);
  
  const data = (result as any)[0] || [];
  
  return data.map((person: any) => {
    const hasData = !!person.deviceTime;
    const secondsSinceUpdate = person.secondsSinceUpdate || 0;
    const online = hasData && secondsSinceUpdate < 120; // Online if updated within 2 minutes
    
    return {
      userId: person.userId,
      username: person.username,
      name: person.name,
      phone: person.phone,
      profileImage: person.profileImage,
      configured: hasData,
      online,
      positions: hasData ? [{
        latitude: person.latitude,
        longitude: person.longitude,
        speed: person.speed || 0,
        heading: person.heading,
        accuracy: person.accuracy,
        deviceTime: person.deviceTime,
        attributes: {
          battery: person.battery
        }
      }] : [],
      devices: hasData ? [{
        id: person.userId,
        name: person.name || person.username,
        status: online ? 'online' : 'offline'
      }] : []
    };
  });
}

/**
 * Get delivery person route for a specific time range
 */
export async function getDeliveryRouteByTime(userId: number, date: string, hours: number = 0) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  try {
    let startTime: Date;
    let endTime: Date;
    
    if (hours === 0) {
      // Current location only
      const result = await db.execute(sql`
        SELECT 
          latitude,
          longitude,
          createdAt,
          speed,
          accuracy,
          battery
        FROM delivery_locations
        WHERE deliveryPersonId = ${userId}
        ORDER BY createdAt DESC
        LIMIT 1
      `);
      
      return (result as any)[0] || [];
    } else {
      // Historical route for specified hours
      endTime = new Date();
      startTime = new Date(endTime.getTime() - (hours * 60 * 60 * 1000));
      
      const result = await db.execute(sql`
        SELECT 
          latitude,
          longitude,
          createdAt,
          speed,
          accuracy,
          battery
        FROM delivery_locations
        WHERE deliveryPersonId = ${userId}
          AND createdAt >= ${startTime}
          AND createdAt <= ${endTime}
          AND latitude IS NOT NULL
          AND longitude IS NOT NULL
          AND latitude BETWEEN -90 AND 90
          AND longitude BETWEEN -180 AND 180
        ORDER BY createdAt ASC
      `);
      
      const data = (result as any)[0] || [];
      
      // Additional validation to filter out invalid coordinates
      return data.filter((point: any) => {
        const lat = parseFloat(point.latitude);
        const lng = parseFloat(point.longitude);
        return !isNaN(lat) && !isNaN(lng) && 
               lat >= -90 && lat <= 90 && 
               lng >= -180 && lng <= 180;
      });
    }
  } catch (error) {
    console.error('[GetDeliveryRouteByTime] Error:', error);
    throw error;
  }
}

/**
 * Get all orders for a specific delivery person with details
 */
export async function getDeliveryPersonOrdersWithDetails(deliveryPersonId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');
  
  try {
    const result = await db.execute(sql`
      SELECT 
        o.id,
        o.customerId,
        o.deliveryPersonId,
        o.regionId,
        o.provinceId,
        o.price,
        o.note,
        o.locationLink,
        o.address,
        o.status,
        o.createdAt,
        o.updatedAt,
        o.acceptedAt,
        o.deliveredAt,
        o.deliveryImage,
        o.deliveryNote,
        o.deliveryLocationName,
        c.name as customerName,
        c.phone as customerPhone,
        r.name as regionName,
        p.name as provinceName,
        u.name as deliveryPersonName
      FROM orders o
      LEFT JOIN customers c ON o.customerId = c.id
      LEFT JOIN regions r ON o.regionId = r.id
      LEFT JOIN provinces p ON o.provinceId = p.id
      LEFT JOIN users u ON o.deliveryPersonId = u.id
      WHERE o.deliveryPersonId = ${deliveryPersonId}
        AND o.isDeleted = 0
      ORDER BY o.createdAt DESC
    `);
    
    return (result as any)[0] || [];
  } catch (error) {
    console.error('[GetDeliveryPersonOrdersWithDetails] Error:', error);
    throw error;
  }
}

/**
 * Get complete route for a specific order from acceptance to delivery
 */
export async function getOrderCompleteRoute(orderId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');
  
  try {
    // First get order details
    const orderResult = await db.execute(sql`
      SELECT 
        o.*,
        u.name as deliveryPersonName
      FROM orders o
      LEFT JOIN users u ON o.deliveryPersonId = u.id
      WHERE o.id = ${orderId}
    `);
    
    const order = ((orderResult as any)[0] || [])[0];
    if (!order) return null;
    
    // Get all GPS locations for this order's delivery person during the order period
    const startTime = order.acceptedAt || order.createdAt;
    const endTime = order.deliveredAt || order.cancelledAt || order.returnedAt || new Date();
    
    const locationsResult = await db.execute(sql`
      SELECT 
        latitude,
        longitude,
        createdAt,
        speed,
        accuracy,
        battery
      FROM delivery_locations
      WHERE deliveryPersonId = ${order.deliveryPersonId}
        AND createdAt >= ${startTime}
        AND createdAt <= ${endTime}
      ORDER BY createdAt ASC
    `);
    
    return {
      order: order,
      route: (locationsResult as any)[0] || []
    };
  } catch (error) {
    console.error('[GetOrderCompleteRoute] Error:', error);
    throw error;
  }
}

/**
 * Get all historical routes for a delivery person (all GPS points)
 * Used for showing complete movement history
 */
export async function getDeliveryPersonAllRoutes(deliveryPersonId: number, days: number = 7) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.execute(sql`
    SELECT 
      latitude,
      longitude,
      speed,
      heading,
      battery,
      accuracy,
      timestamp
    FROM delivery_locations
    WHERE deliveryPersonId = ${deliveryPersonId}
      AND createdAt >= DATE_SUB(NOW(), INTERVAL ${days} DAY)
      AND latitude IS NOT NULL
      AND longitude IS NOT NULL
      AND CAST(latitude AS DECIMAL(10,8)) BETWEEN -90 AND 90
      AND CAST(longitude AS DECIMAL(11,8)) BETWEEN -180 AND 180
    ORDER BY createdAt ASC
  `);
  
  return (result as any)[0] || [];
}

/**
 * Get heatmap data - most visited locations for a delivery person
 * Returns coordinates with visit frequency
 */
export async function getDeliveryPersonHeatmapData(deliveryPersonId: number, days: number = 30) {
  const db = await getDb();
  if (!db) return [];
  
  // Group GPS points by approximate location (rounded to 4 decimal places ~ 11 meters)
  const result = await db.execute(sql`
    SELECT 
      ROUND(CAST(latitude AS DECIMAL(10,8)), 4) as lat,
      ROUND(CAST(longitude AS DECIMAL(11,8)), 4) as lng,
      COUNT(*) as weight,
      MIN(createdAt) as firstVisit,
      MAX(createdAt) as lastVisit
    FROM delivery_locations
    WHERE deliveryPersonId = ${deliveryPersonId}
      AND createdAt >= DATE_SUB(NOW(), INTERVAL ${days} DAY)
      AND latitude IS NOT NULL
      AND longitude IS NOT NULL
      AND CAST(latitude AS DECIMAL(10,8)) BETWEEN -90 AND 90
      AND CAST(longitude AS DECIMAL(11,8)) BETWEEN -180 AND 180
    GROUP BY lat, lng
    HAVING weight >= 3
    ORDER BY weight DESC
    LIMIT 100
  `);
  
  return (result as any)[0] || [];
}

/**
 * Get advanced delivery person statistics for today
 * Includes: total distance, average speed, stops count, working time
 */
export async function getDeliveryPersonAdvancedStats(deliveryPersonId: number) {
  const db = await getDb();
  if (!db) return null;
  
  try {
    // Get today's GPS points
    const locationsResult = await db.execute(sql`
      SELECT 
        latitude,
        longitude,
        speed,
        timestamp
      FROM delivery_locations
      WHERE deliveryPersonId = ${deliveryPersonId}
        AND DATE(createdAt) = CURDATE()
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
        AND CAST(latitude AS DECIMAL(10,8)) BETWEEN -90 AND 90
        AND CAST(longitude AS DECIMAL(11,8)) BETWEEN -180 AND 180
      ORDER BY createdAt ASC
    `);
    
    const locations = (locationsResult as any)[0] || [];
    
    if (locations.length === 0) {
      return {
        totalDistance: 0,
        averageSpeed: 0,
        stopsCount: 0,
        workingTimeMinutes: 0,
        firstLocationTime: null,
        lastLocationTime: null
      };
    }
    
    // Calculate total distance using Haversine formula
    let totalDistance = 0;
    let totalSpeed = 0;
    let speedCount = 0;
    let stopsCount = 0;
    
    for (let i = 1; i < locations.length; i++) {
      const prev = locations[i - 1];
      const curr = locations[i];
      
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
      const distance = R * c;
      
      totalDistance += distance;
      
      // Calculate average speed
      if (curr.speed) {
        const speed = parseFloat(curr.speed);
        if (speed >= 0 && speed <= 200) { // Valid speed range
          totalSpeed += speed;
          speedCount++;
        }
        
        // Count stops (speed < 5 km/h for more than 2 minutes)
        if (speed < 5 && i > 0) {
          const timeDiff = new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime();
          if (timeDiff > 120000) { // 2 minutes
            stopsCount++;
          }
        }
      }
    }
    
    const firstLocationTime = locations[0].timestamp;
    const lastLocationTime = locations[locations.length - 1].timestamp;
    const workingTimeMinutes = Math.floor(
      (new Date(lastLocationTime).getTime() - new Date(firstLocationTime).getTime()) / 60000
    );
    
    return {
      totalDistance: Math.round(totalDistance * 100) / 100, // Round to 2 decimal places
      averageSpeed: speedCount > 0 ? Math.round(totalSpeed / speedCount) : 0,
      stopsCount,
      workingTimeMinutes,
      firstLocationTime,
      lastLocationTime,
      pointsCount: locations.length
    };
  } catch (error) {
    console.error('[GetDeliveryPersonAdvancedStats] Error:', error);
    return null;
  }
}

/**
 * Get delivery person route with timeline (includes stop points)
 * Returns route with timestamps and identifies stops
 */
export async function getDeliveryPersonRouteWithTimeline(deliveryPersonId: number, hours: number = 24) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.execute(sql`
    SELECT 
      latitude,
      longitude,
      speed,
      heading,
      battery,
      accuracy,
      createdAt,
      CASE 
        WHEN CAST(speed AS DECIMAL(10,2)) < 5 THEN true
        ELSE false
      END as isStop
    FROM delivery_locations
    WHERE deliveryPersonId = ${deliveryPersonId}
      AND createdAt >= DATE_SUB(NOW(), INTERVAL ${hours} HOUR)
      AND latitude IS NOT NULL
      AND longitude IS NOT NULL
      AND CAST(latitude AS DECIMAL(10,8)) BETWEEN -90 AND 90
      AND CAST(longitude AS DECIMAL(11,8)) BETWEEN -180 AND 180
    ORDER BY createdAt ASC
  `);
  
  return (result as any)[0] || [];
}


/**
 * Get orders with advanced filters for Excel export
 */
export async function getOrdersForExport(filters: {
  startDate?: string;
  endDate?: string;
  deliveryPersonIds?: number[];
  statuses?: string[];
  regionIds?: number[];
}) {
  const db = await getDb();
  if (!db) return [];

  let query = db
    .select({
      id: orders.id,
      customerName: customers.name,
      customerPhone: customers.phone,
      price: orders.price,
      status: orders.status,
      address: orders.address,
      note: orders.note,
      deliveryPersonName: users.name,
      deliveryPersonPhone: users.phone,
      regionName: regions.name,
      provinceName: provinces.name,
      createdAt: orders.createdAt,
      acceptedAt: orders.acceptedAt,
      deliveredAt: orders.deliveredAt,
      postponeReason: orders.postponeReason,
      returnReason: orders.returnReason,
    })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .leftJoin(users, eq(orders.deliveryPersonId, users.id))
    .leftJoin(regions, eq(orders.regionId, regions.id))
    .leftJoin(provinces, eq(orders.provinceId, provinces.id));

  const conditions: any[] = [];

  if (filters.startDate) {
    conditions.push(sql`${orders.createdAt} >= ${new Date(filters.startDate).toISOString()}`);
  }

  if (filters.endDate) {
    conditions.push(sql`${orders.createdAt} <= ${new Date(filters.endDate).toISOString()}`);
  }

  if (filters.deliveryPersonIds && filters.deliveryPersonIds.length > 0) {
    conditions.push(inArray(orders.deliveryPersonId, filters.deliveryPersonIds));
  }

  if (filters.statuses && filters.statuses.length > 0) {
    conditions.push(inArray(orders.status, filters.statuses as any));
  }

  if (filters.regionIds && filters.regionIds.length > 0) {
    conditions.push(inArray(orders.regionId, filters.regionIds));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  const result = await query.orderBy(desc(orders.createdAt));
  return result;
}

/**
 * Get customers filtered by order count
 */
export async function getCustomersByOrderCount(filters: {
  operator: 'gt' | 'lt' | 'eq'; // greater than, less than, equal
  count: number;
}, branchId: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db.execute(sql`
    SELECT 
      c.id,
      ANY_VALUE(c.name) as name,
      ANY_VALUE(c.phone) as phone,
      ANY_VALUE(c.email) as email,
      ANY_VALUE(c.address1) as address1,
      ANY_VALUE(c.address2) as address2,
      ANY_VALUE(c.locationUrl1) as locationUrl1,
      ANY_VALUE(c.locationUrl2) as locationUrl2,
      ANY_VALUE(c.createdAt) as createdAt,
      COUNT(o.id) as orderCount,
      MAX(o.createdAt) as lastOrderDate
    FROM customers c
    LEFT JOIN orders o ON c.id = o.customerId
    WHERE c.branchId = ${branchId}
    GROUP BY c.id
    HAVING 
      ${filters.operator === 'gt' ? sql`COUNT(o.id) > ${filters.count}` :
        filters.operator === 'lt' ? sql`COUNT(o.id) < ${filters.count}` :
        sql`COUNT(o.id) = ${filters.count}`}
    ORDER BY orderCount DESC
  `);

  return (result as any)[0] || [];
}

/**
 * Get inactive customers (haven't ordered since a specific period)
 */
export async function getInactiveCustomers(filters: {
  days?: number;
  months?: number;
  sinceDate?: string;
}, branchId: number) {
  const db = await getDb();
  if (!db) return [];

  let dateCondition;
  if (filters.sinceDate) {
    dateCondition = sql`MAX(o.createdAt) < ${filters.sinceDate}`;
  } else if (filters.months) {
    dateCondition = sql`MAX(o.createdAt) < DATE_SUB(NOW(), INTERVAL ${filters.months} MONTH)`;
  } else if (filters.days) {
    dateCondition = sql`MAX(o.createdAt) < DATE_SUB(NOW(), INTERVAL ${filters.days} DAY)`;
  } else {
    // Default: 30 days
    dateCondition = sql`MAX(o.createdAt) < DATE_SUB(NOW(), INTERVAL 30 DAY)`;
  }

  const result = await db.execute(sql`
    SELECT 
      c.id,
      ANY_VALUE(c.name) as name,
      ANY_VALUE(c.phone) as phone,
      ANY_VALUE(c.email) as email,
      ANY_VALUE(c.address1) as address1,
      ANY_VALUE(c.address2) as address2,
      ANY_VALUE(c.locationUrl1) as locationUrl1,
      ANY_VALUE(c.locationUrl2) as locationUrl2,
      ANY_VALUE(c.createdAt) as createdAt,
      COUNT(o.id) as orderCount,
      MAX(o.createdAt) as lastOrderDate,
      DATEDIFF(NOW(), MAX(o.createdAt)) as daysSinceLastOrder
    FROM customers c
    LEFT JOIN orders o ON c.id = o.customerId
    WHERE c.branchId = ${branchId}
    GROUP BY c.id
    HAVING ${dateCondition}
    ORDER BY lastOrderDate ASC
  `);

  return (result as any)[0] || [];
}

/**
 * Get customers with combined filters
 */
export async function getCustomersWithFilters(filters: {
  orderCountOperator?: 'gt' | 'lt' | 'eq';
  orderCount?: number;
  inactiveDays?: number;
  inactiveMonths?: number;
  inactiveSinceDate?: string;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions: any[] = [];

  // Build order count condition
  if (filters.orderCountOperator && filters.orderCount !== undefined) {
    if (filters.orderCountOperator === 'gt') {
      conditions.push(sql`COUNT(o.id) > ${filters.orderCount}`);
    } else if (filters.orderCountOperator === 'lt') {
      conditions.push(sql`COUNT(o.id) < ${filters.orderCount}`);
    } else {
      conditions.push(sql`COUNT(o.id) = ${filters.orderCount}`);
    }
  }

  // Build inactive condition
  if (filters.inactiveSinceDate) {
    conditions.push(sql`MAX(o.createdAt) < ${filters.inactiveSinceDate}`);
  } else if (filters.inactiveMonths) {
    conditions.push(sql`MAX(o.createdAt) < DATE_SUB(NOW(), INTERVAL ${filters.inactiveMonths} MONTH)`);
  } else if (filters.inactiveDays) {
    conditions.push(sql`MAX(o.createdAt) < DATE_SUB(NOW(), INTERVAL ${filters.inactiveDays} DAY)`);
  }

  const havingClause = conditions.length > 0 
    ? sql`HAVING ${sql.join(conditions, sql` AND `)}`
    : sql``;

  const result = await db.execute(sql`
    SELECT 
      c.id,
      ANY_VALUE(c.name) as name,
      ANY_VALUE(c.phone) as phone,
      ANY_VALUE(c.email) as email,
      ANY_VALUE(c.address1) as address1,
      ANY_VALUE(c.address2) as address2,
      ANY_VALUE(c.locationUrl1) as locationUrl1,
      ANY_VALUE(c.locationUrl2) as locationUrl2,
      ANY_VALUE(c.createdAt) as createdAt,
      COUNT(o.id) as orderCount,
      MAX(o.createdAt) as lastOrderDate,
      DATEDIFF(NOW(), MAX(o.createdAt)) as daysSinceLastOrder
    FROM customers c
    LEFT JOIN orders o ON c.id = o.customerId
    GROUP BY c.id
    ${havingClause}
    ORDER BY orderCount DESC, lastOrderDate DESC
  `);

  return (result as any)[0] || [];
}

/**
 * Get order by ID with route information
 */
export async function getOrderWithRoute(orderId: number) {
  const db = await getDb();
  if (!db) return null;

  // Get order details
  const orderResult = await db
    .select({
      id: orders.id,
      customerName: customers.name,
      customerPhone: customers.phone,
      price: orders.price,
      status: orders.status,
      address: orders.address,
      note: orders.note,
      locationLink: orders.locationLink,
      deliveryPersonId: orders.deliveryPersonId,
      deliveryPersonName: users.name,
      deliveryPersonPhone: users.phone,
      regionName: regions.name,
      provinceName: provinces.name,
      createdAt: orders.createdAt,
      acceptedAt: orders.acceptedAt,
      deliveredAt: orders.deliveredAt,
      postponeReason: orders.postponeReason,
      returnReason: orders.returnReason,
      deliveryImage: orders.deliveryImage,
      deliveryNote: orders.deliveryNote,
    })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .leftJoin(users, eq(orders.deliveryPersonId, users.id))
    .leftJoin(regions, eq(orders.regionId, regions.id))
    .leftJoin(provinces, eq(orders.provinceId, provinces.id))
    .where(eq(orders.id, orderId))
    .limit(1);

  if (orderResult.length === 0) return null;

  const order = orderResult[0];

  // Get route if order has been accepted
  let route = null;
  let deliveryDuration = null;

  if (order.acceptedAt && order.deliveryPersonId) {
    const startTime = order.acceptedAt;
    const endTime = order.deliveredAt || new Date();

    const routeResult = await db.execute(sql`
      SELECT 
        latitude,
        longitude,
        speed,
        heading,
        timestamp
      FROM delivery_locations
      WHERE deliveryPersonId = ${order.deliveryPersonId}
        AND createdAt >= ${startTime}
        AND createdAt <= ${endTime}
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
        AND CAST(latitude AS DECIMAL(10,8)) BETWEEN -90 AND 90
        AND CAST(longitude AS DECIMAL(11,8)) BETWEEN -180 AND 180
      ORDER BY createdAt ASC
    `);

    route = (routeResult as any)[0] || [];

    // Calculate delivery duration
    if (order.deliveredAt && order.acceptedAt) {
      const durationMs = new Date(order.deliveredAt).getTime() - new Date(order.acceptedAt).getTime();
      const hours = Math.floor(durationMs / (1000 * 60 * 60));
      const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
      deliveryDuration = `${hours}س ${minutes}د`;
    }
  }

  return {
    ...order,
    route,
    deliveryDuration,
  };
}

// Re-export from db-status-log
export { getDeliveryStatusLog } from "./db-status-log";


// ===== Activity Logs =====

/**
 * Log user activity
 */
export async function logActivity(data: {
  branchId: number;
  userId: number;
  activityType: InsertActivityLog['activityType'];
  description?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(activityLogs).values({
    branchId: data.branchId,
    userId: data.userId,
    activityType: data.activityType,
    description: data.description || null,
    metadata: data.metadata ? JSON.stringify(data.metadata) : null,
    ipAddress: data.ipAddress || null,
    userAgent: data.userAgent || null,
    createdAt: getCurrentTimeISOInIraq(),
  });

  return result;
}

/**
 * Get activity logs with filters
 */
export async function getActivityLogs(filters?: {
  branchId?: number | null;
  userId?: number;
  activityType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { logs: [], total: 0 };

  const conditions = [];
  
  // Filter by branchId if provided (null means super admin sees all)
  if (filters?.branchId !== undefined && filters?.branchId !== null) {
    conditions.push(eq(activityLogs.branchId, filters.branchId));
  }
  
  if (filters?.userId) {
    conditions.push(eq(activityLogs.userId, filters.userId));
  }
  if (filters?.activityType) {
    conditions.push(eq(activityLogs.activityType, filters.activityType as any));
  }
  if (filters?.startDate) {
    conditions.push(sql`${activityLogs.createdAt} >= ${filters.startDate.toISOString()}`);
  }
  if (filters?.endDate) {
    conditions.push(sql`${activityLogs.createdAt} <= ${filters.endDate.toISOString()}`);
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(activityLogs)
    .where(whereClause);
  
  const total = countResult[0]?.count || 0;

  // Get logs with user info
  const logs = await db
    .select({
      id: activityLogs.id,
      userId: activityLogs.userId,
      userName: users.name,
      username: users.username,
      activityType: activityLogs.activityType,
      description: activityLogs.description,
      metadata: activityLogs.metadata,
      ipAddress: activityLogs.ipAddress,
      createdAt: activityLogs.createdAt,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .where(whereClause)
    .orderBy(desc(activityLogs.createdAt))
    .limit(filters?.limit || 50)
    .offset(filters?.offset || 0);

  return { logs, total };
}

/**
 * Get user activity statistics
 */
export async function getUserActivityStats(userId?: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (userId) conditions.push(eq(activityLogs.userId, userId));
  if (startDate) conditions.push(sql`${activityLogs.createdAt} >= ${startDate.toISOString()}`);
  if (endDate) conditions.push(sql`${activityLogs.createdAt} <= ${endDate.toISOString()}`);
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const stats = await db
    .select({
      userId: activityLogs.userId,
      userName: users.name,
      username: users.username,
      totalActivities: sql<number>`COUNT(*)`,
      loginCount: sql<number>`SUM(CASE WHEN ${activityLogs.activityType} = 'login' THEN 1 ELSE 0 END)`,
      orderCreateCount: sql<number>`SUM(CASE WHEN ${activityLogs.activityType} = 'order_create' THEN 1 ELSE 0 END)`,
      pageViewCount: sql<number>`SUM(CASE WHEN ${activityLogs.activityType} = 'page_view' THEN 1 ELSE 0 END)`,
      lastActivity: sql<Date>`MAX(${activityLogs.createdAt})`,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .where(whereClause)
    .groupBy(activityLogs.userId, users.name, users.username);

  return stats;
}

/**
 * Get employee statistics (orders created, revenue, etc.)
 */
export async function getEmployeeStats(employeeId?: number, startDate?: Date, endDate?: Date, branchId?: number | null) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (employeeId) conditions.push(eq(orders.createdBy, employeeId));
  if (startDate) conditions.push(sql`${orders.createdAt} >= ${startDate}`);
  if (endDate) conditions.push(sql`${orders.createdAt} <= ${endDate}`);
  if (branchId) conditions.push(eq(orders.branchId, branchId));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const stats = await db
    .select({
      employeeId: orders.createdBy,
      employeeName: users.name,
      employeeUsername: users.username,
      totalOrders: sql<number>`COUNT(*)`,
      deliveredOrders: sql<number>`SUM(CASE WHEN ${orders.status} = 'delivered' THEN 1 ELSE 0 END)`,
      pendingOrders: sql<number>`SUM(CASE WHEN ${orders.status} = 'pending' THEN 1 ELSE 0 END)`,
      cancelledOrders: sql<number>`SUM(CASE WHEN ${orders.status} = 'cancelled' THEN 1 ELSE 0 END)`,
      totalRevenue: sql<number>`SUM(CASE WHEN ${orders.status} = 'delivered' THEN ${orders.price} ELSE 0 END)`,
    })
    .from(orders)
    .leftJoin(users, eq(orders.createdBy, users.id))
    .where(whereClause)
    .groupBy(orders.createdBy, users.name, users.username);

  return stats;
}

/**
 * Get orders created by a specific employee
 */
export async function getEmployeeOrders(employeeId: number, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return { orders: [], total: 0 };

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(orders)
    .where(eq(orders.createdBy, employeeId));
  
  const total = countResult[0]?.count || 0;

  // Get orders with delivery person info
  const orderList = await db
    .select({
      id: orders.id,
      customerName: customers.name,
      customerPhone: customers.phone,
      price: orders.price,
      status: orders.status,
      regionName: regions.name,
      provinceName: provinces.name,
      deliveryPersonId: orders.deliveryPersonId,
      deliveryPersonName: users.name,
      createdAt: orders.createdAt,
      deliveredAt: orders.deliveredAt,
    })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .leftJoin(users, eq(orders.deliveryPersonId, users.id))
    .leftJoin(regions, eq(orders.regionId, regions.id))
    .leftJoin(provinces, eq(orders.provinceId, provinces.id))
    .where(eq(orders.createdBy, employeeId))
    .orderBy(desc(orders.createdAt))
    .limit(limit)
    .offset(offset);

  return { orders: orderList, total };
}

/**
 * Get delivery person statistics
 */
export async function getDeliveryPersonStats(deliveryPersonId?: number, startDate?: Date, endDate?: Date, branchId?: number | null) {
  const db = await getDb();
  if (!db) return [];

  // إذا لم يتم تحديد startDate و endDate، نستخدم بداية ونهاية الشهر الحالي
  if (!startDate && !endDate) {
    const now = new Date();
    startDate = new Date(now.getFullYear(), now.getMonth(), 1); // أول يوم في الشهر
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59); // آخر يوم في الشهر
  }

  const conditions = [
    isNotNull(orders.deliveryPersonId),
    eq(users.role, 'delivery')
  ];
  if (deliveryPersonId) conditions.push(eq(orders.deliveryPersonId, deliveryPersonId));
  if (startDate) conditions.push(sql`${orders.createdAt} >= ${startDate}`);
  if (endDate) conditions.push(sql`${orders.createdAt} <= ${endDate}`);
  if (branchId) conditions.push(eq(users.branchId, branchId));

  const stats = await db
    .select({
      deliveryPersonId: orders.deliveryPersonId,
      deliveryPersonName: users.name,
      deliveryPersonUsername: users.username,
      totalOrders: sql<number>`COUNT(*)`,
      deliveredOrders: sql<number>`SUM(CASE WHEN ${orders.status} = 'delivered' THEN 1 ELSE 0 END)`,
      returnedOrders: sql<number>`SUM(CASE WHEN ${orders.status} = 'returned' THEN 1 ELSE 0 END)`,
      postponedOrders: sql<number>`SUM(CASE WHEN ${orders.status} = 'postponed' THEN 1 ELSE 0 END)`,
      cancelledOrders: sql<number>`SUM(CASE WHEN ${orders.status} = 'cancelled' THEN 1 ELSE 0 END)`,
      totalRevenue: sql<number>`SUM(CASE WHEN ${orders.status} = 'delivered' THEN ${orders.price} ELSE 0 END)`,
      avgDeliveryTime: sql<number>`AVG(CASE WHEN ${orders.status} = 'delivered' AND ${orders.acceptedAt} IS NOT NULL AND ${orders.deliveredAt} IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, ${orders.acceptedAt}, ${orders.deliveredAt}) ELSE NULL END)`,
    })
    .from(orders)
    .innerJoin(users, eq(orders.deliveryPersonId, users.id))
    .where(and(...conditions))
    .groupBy(orders.deliveryPersonId, users.name, users.username);

  return stats;
}

/**
 * Get delivery person orders with filters
 */
// Get delivery person details with comprehensive stats and comparisons
export async function getDeliveryPersonDetailsWithComparisons(deliveryPersonId: number, customStartDate?: Date, customEndDate?: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get delivery person (user with role='delivery')
  const delivery = await db.select().from(users)
    .where(and(
      eq(users.id, deliveryPersonId),
      eq(users.role, 'delivery')
    ))
    .limit(1);

  if (!delivery || delivery.length === 0) return null;
  const deliveryPerson = delivery[0];

  // Get current time boundaries
  const now = new Date();
  const todayStart = getStartOfDay(now);
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  
  // Custom period stats (if provided)
  let customPeriodStats = null;
  if (customStartDate && customEndDate) {
    const customOrders = await db.select().from(orders)
      .where(and(
        eq(orders.deliveryPersonId, deliveryPersonId),
        sql`${orders.createdAt} >= ${customStartDate}`,
        sql`${orders.createdAt} <= ${customEndDate}`
      ));
    
    const customDelivered = customOrders.filter((o: any) => o.status === 'delivered');
    const customRevenue = customDelivered.reduce((sum: number, o: any) => sum + Number(o.totalAmount || 0), 0);
    const customProfit = customDelivered.reduce((sum: number, o: any) => sum + Number(o.deliveryFee || 0), 0);
    
    // Calculate delivery times for custom period
    let customTotalDeliveryMinutes = 0;
    let customDeliveryCount = 0;
    
    customDelivered.forEach((order: any) => {
      if (order.acceptedAt && order.deliveredAt) {
        const minutes = Math.floor((new Date(order.deliveredAt).getTime() - new Date(order.acceptedAt).getTime()) / (1000 * 60));
        customTotalDeliveryMinutes += minutes;
        customDeliveryCount++;
      }
    });
    
    const customAvgDeliveryMinutes = customDeliveryCount > 0 ? Math.round(customTotalDeliveryMinutes / customDeliveryCount) : 0;
    
    customPeriodStats = {
      totalOrders: customOrders.length,
      delivered: customDelivered.length,
      revenue: customRevenue,
      profit: customProfit,
      avgDeliveryMinutes: customAvgDeliveryMinutes,
    };
  }
  
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayEnd = todayStart;
  
  // Current month boundaries
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  
  // Previous month boundaries
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  // Today's stats
  const todayOrders = await db.select().from(orders)
    .where(and(
      eq(orders.deliveryPersonId, deliveryPersonId),
      sql`${orders.createdAt} >= ${todayStart.toISOString()}`,
      sql`${orders.createdAt} < ${todayEnd.toISOString()}`
    ));
  
  const todayDelivered = todayOrders.filter((o: any) => o.status === 'delivered');
  const todayRevenue = todayDelivered.reduce((sum: number, o: any) => sum + Number(o.totalAmount || 0), 0);
  const todayProfit = todayDelivered.reduce((sum: number, o: any) => sum + Number(o.deliveryFee || 0), 0);

  // Yesterday's stats
  const yesterdayOrders = await db.select().from(orders)
    .where(and(
      eq(orders.deliveryPersonId, deliveryPersonId),
      sql`${orders.createdAt} >= ${yesterdayStart.toISOString()}`,
      sql`${orders.createdAt} < ${yesterdayEnd.toISOString()}`
    ));
  
  const yesterdayDelivered = yesterdayOrders.filter((o: any) => o.status === 'delivered');
  const yesterdayRevenue = yesterdayDelivered.reduce((sum: number, o: any) => sum + Number(o.totalAmount || 0), 0);
  const yesterdayProfit = yesterdayDelivered.reduce((sum: number, o: any) => sum + Number(o.deliveryFee || 0), 0);
  
  // Calculate delivery times for yesterday
  let yesterdayTotalDeliveryMinutes = 0;
  let yesterdayDeliveryCount = 0;
  
  yesterdayDelivered.forEach((order: any) => {
    if (order.acceptedAt && order.deliveredAt) {
      const minutes = Math.floor((new Date(order.deliveredAt).getTime() - new Date(order.acceptedAt).getTime()) / (1000 * 60));
      yesterdayTotalDeliveryMinutes += minutes;
      yesterdayDeliveryCount++;
    }
  });
  
  const yesterdayAvgDeliveryMinutes = yesterdayDeliveryCount > 0 ? Math.round(yesterdayTotalDeliveryMinutes / yesterdayDeliveryCount) : 0;

  // Current month stats
  const currentMonthOrders = await db.select().from(orders)
    .where(and(
      eq(orders.deliveryPersonId, deliveryPersonId),
      sql`${orders.createdAt} >= ${currentMonthStart.toISOString()}`,
      sql`${orders.createdAt} <= ${currentMonthEnd.toISOString()}`
    ));
  
  const currentMonthDelivered = currentMonthOrders.filter((o: any) => o.status === 'delivered');
  const currentMonthRevenue = currentMonthDelivered.reduce((sum: number, o: any) => sum + Number(o.totalAmount || 0), 0);
  const currentMonthProfit = currentMonthDelivered.reduce((sum: number, o: any) => sum + Number(o.deliveryFee || 0), 0);

  // Previous month stats
  const previousMonthOrders = await db.select().from(orders)
    .where(and(
      eq(orders.deliveryPersonId, deliveryPersonId),
      sql`${orders.createdAt} >= ${previousMonthStart.toISOString()}`,
      sql`${orders.createdAt} <= ${previousMonthEnd.toISOString()}`
    ));
  
  const previousMonthDelivered = previousMonthOrders.filter((o: any) => o.status === 'delivered');
  const previousMonthRevenue = previousMonthDelivered.reduce((sum: number, o: any) => sum + Number(o.totalAmount || 0), 0);
  const previousMonthProfit = previousMonthDelivered.reduce((sum: number, o: any) => sum + Number(o.deliveryFee || 0), 0);

  // Calculate delivery times for today
  let totalDeliveryMinutes = 0;
  let deliveryCount = 0;
  
  todayDelivered.forEach((order: any) => {
    if (order.acceptedAt && order.deliveredAt) {
      const minutes = Math.floor((new Date(order.deliveredAt).getTime() - new Date(order.acceptedAt).getTime()) / (1000 * 60));
      totalDeliveryMinutes += minutes;
      deliveryCount++;
    }
  });
  
  const avgDeliveryMinutes = deliveryCount > 0 ? Math.round(totalDeliveryMinutes / deliveryCount) : 0;

  // All-time stats
  const allOrders = await db.select().from(orders)
    .where(eq(orders.deliveryPersonId, deliveryPersonId));
  
  const allDelivered = allOrders.filter((o: any) => o.status === 'delivered');
  const allReturned = allOrders.filter((o: any) => o.status === 'returned');
  const allPostponed = allOrders.filter((o: any) => o.status === 'postponed');
  const allCancelled = allOrders.filter((o: any) => o.status === 'cancelled');
  const activeOrders = allOrders.filter((o: any) => ['pending', 'in_progress'].includes(o.status || ''));
  
  const totalRevenue = allDelivered.reduce((sum: number, o: any) => sum + Number(o.totalAmount || 0), 0);
  const totalProfit = allDelivered.reduce((sum: number, o: any) => sum + Number(o.deliveryFee || 0), 0);
  
  const successRate = allOrders.length > 0 
    ? Math.round((allDelivered.length / allOrders.length) * 100) 
    : 0;

  return {
    delivery: deliveryPerson,
    stats: {
      // Today
      today: {
        totalOrders: todayOrders.length,
        delivered: todayDelivered.length,
        revenue: todayRevenue,
        profit: todayProfit,
        avgDeliveryMinutes,
      },
      // Yesterday
      yesterday: {
        totalOrders: yesterdayOrders.length,
        delivered: yesterdayDelivered.length,
        revenue: yesterdayRevenue,
        profit: yesterdayProfit,
        avgDeliveryMinutes: yesterdayAvgDeliveryMinutes,
      },
      // Current month
      currentMonth: {
        totalOrders: currentMonthOrders.length,
        delivered: currentMonthDelivered.length,
        revenue: currentMonthRevenue,
        profit: currentMonthProfit,
      },
      // Previous month
      previousMonth: {
        totalOrders: previousMonthOrders.length,
        delivered: previousMonthDelivered.length,
        revenue: previousMonthRevenue,
        profit: previousMonthProfit,
      },
      // All-time
      allTime: {
        totalOrders: allOrders.length,
        delivered: allDelivered.length,
        returned: allReturned.length,
        postponed: allPostponed.length,
        cancelled: allCancelled.length,
        active: activeOrders.length,
        revenue: totalRevenue,
        profit: totalProfit,
        successRate,
        avgProfitPerOrder: allDelivered.length > 0 ? Math.round(totalProfit / allDelivered.length) : 0,
      },
      // Custom period (if provided)
      ...(customPeriodStats && { customPeriod: customPeriodStats }),
    },
  };
}

export async function getDeliveryPersonOrdersFiltered(deliveryPersonId?: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (deliveryPersonId) conditions.push(eq(orders.deliveryPersonId, deliveryPersonId));
  if (startDate) conditions.push(sql`${orders.createdAt} >= ${startDate}`);
  if (endDate) conditions.push(sql`${orders.createdAt} <= ${endDate}`);
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const orderList = await db
    .select({
      id: orders.id,
      customerName: customers.name,
      customerPhone: customers.phone,
      price: orders.price,
      status: orders.status,
      regionName: regions.name,
      provinceName: provinces.name,
      deliveryPersonId: orders.deliveryPersonId,
      deliveryPersonName: users.name,
      createdAt: orders.createdAt,
      acceptedAt: orders.acceptedAt,
      deliveredAt: orders.deliveredAt,
      deliveryMinutes: sql<number | null>`CASE WHEN ${orders.status} = 'delivered' AND ${orders.acceptedAt} IS NOT NULL AND ${orders.deliveredAt} IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, ${orders.acceptedAt}, ${orders.deliveredAt}) ELSE NULL END`,
      totalMinutes: sql<number | null>`CASE WHEN ${orders.status} = 'delivered' AND ${orders.deliveredAt} IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, ${orders.createdAt}, ${orders.deliveredAt}) ELSE NULL END`,
    })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .leftJoin(users, eq(orders.deliveryPersonId, users.id))
    .leftJoin(regions, eq(orders.regionId, regions.id))
    .leftJoin(provinces, eq(orders.provinceId, provinces.id))
    .where(whereClause)
    .orderBy(desc(orders.createdAt));

  return orderList;
}

// ===== Order Form Settings =====

/**
 * Get all order form settings
 */
export async function getOrderFormSettings() {
  const db = await getDb();
  if (!db) return [];

  const settings = await db
    .select()
    .from(orderFormSettings)
    .orderBy(orderFormSettings.displayOrder);

  return settings;
}

/**
 * Initialize default order form settings
 */
export async function initializeOrderFormSettings(branchId: number = 1) {
  const db = await getDb();
  if (!db) return;

  const defaultFields = [
    { fieldName: 'customerPhone', fieldLabel: 'رقم هاتف الزبون', displayOrder: 1, isRequired: 1 },
    { fieldName: 'hidePhone', fieldLabel: 'إخفاء رقم الهاتف عن المندوب', displayOrder: 2, isRequired: 0 },
    { fieldName: 'lastDeliveryLocation', fieldLabel: 'آخر موقع تسليم', displayOrder: 3, isRequired: 0 },
    { fieldName: 'region', fieldLabel: 'المنطقة', displayOrder: 4, isRequired: 1 },
    { fieldName: 'deliveryPerson', fieldLabel: 'المندوب', displayOrder: 5, isRequired: 1 },
    { fieldName: 'price', fieldLabel: 'السعر', displayOrder: 6, isRequired: 1 },
    { fieldName: 'notes', fieldLabel: 'ملاحظات', displayOrder: 7, isRequired: 0 },
    { fieldName: 'customerName', fieldLabel: 'اسم الزبون', displayOrder: 8, isRequired: 0 },
    { fieldName: 'customerEmail', fieldLabel: 'البريد الإلكتروني', displayOrder: 9, isRequired: 0 },
    { fieldName: 'customerAddress1', fieldLabel: 'العنوان الأول', displayOrder: 10, isRequired: 0 },
    { fieldName: 'customerAddress2', fieldLabel: 'العنوان الثاني', displayOrder: 11, isRequired: 0 },
    { fieldName: 'customerLocationUrl1', fieldLabel: 'رابط الموقع الأول', displayOrder: 12, isRequired: 0 },
    { fieldName: 'customerLocationUrl2', fieldLabel: 'رابط الموقع الثاني', displayOrder: 13, isRequired: 0 },
  ];

  for (const field of defaultFields) {
    await db.insert(orderFormSettings).values({ ...field, branchId }).onDuplicateKeyUpdate({
      set: { fieldLabel: field.fieldLabel },
    });
  }
}

/**
 * Update order form setting
 */
export async function updateOrderFormSetting(
  fieldName: string,
  updates: { isVisible?: boolean; displayOrder?: number; isRequired?: boolean }
) {
  const db = await getDb();
  if (!db) return null;

  const updateSet: Record<string, unknown> = {};
  if (updates.isVisible !== undefined) updateSet.isVisible = updates.isVisible;
  if (updates.displayOrder !== undefined) updateSet.displayOrder = updates.displayOrder;
  if (updates.isRequired !== undefined) updateSet.isRequired = updates.isRequired;

  await db
    .update(orderFormSettings)
    .set(updateSet)
    .where(eq(orderFormSettings.fieldName, fieldName));

  return true;
}

/**
 * Reorder form fields
 */
export async function reorderFormFields(fieldOrders: { fieldName: string; displayOrder: number }[]) {
  const db = await getDb();
  if (!db) return false;

  for (const field of fieldOrders) {
    await db
      .update(orderFormSettings)
      .set({ displayOrder: field.displayOrder })
      .where(eq(orderFormSettings.fieldName, field.fieldName));
  }

  return true;
}

// ===== Data Reset Functions =====

/**
 * Reset all data (orders, customers, delivery locations, etc.)
 * WARNING: This will delete all data!
 */
export async function resetAllData() {
  const db = await getDb();
  if (!db) return false;

  try {
    // Delete in order to respect foreign key constraints
    await db.delete(activityLogs);
    await db.delete(deliveryLocations);
    await db.delete(dailyStats);
    await db.delete(orders);
    await db.delete(customers);
    await db.delete(notifications);
    await db.delete(messages);
    
    console.log('[Database] All data reset successfully');
    return true;
  } catch (error) {
    console.error('[Database] Failed to reset data:', error);
    return false;
  }
}

/**
 * Reset delivery person location/time data only
 */
export async function resetDeliveryTimeData() {
  const db = await getDb();
  if (!db) return false;

  try {
    // Delete delivery locations
    await db.delete(deliveryLocations);
    
    // Reset user location fields
    await db.update(users).set({
      latitude: null,
      longitude: null,
      lastLocationUpdate: null,
    }).where(eq(users.role, 'delivery'));
    
    console.log('[Database] Delivery time data reset successfully');
    return true;
  } catch (error) {
    console.error('[Database] Failed to reset delivery time data:', error);
    return false;
  }
}

/**
 * Get active delivery persons only (for order assignment)
 */
export async function getActiveDeliveryPersons(branchId?: number | null) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [
    eq(users.role, 'delivery'),
    eq(users.isActive, 1)
  ];
  
  if (branchId) {
    conditions.push(eq(users.branchId, branchId));
  }

  const deliveryPersons = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      phone: users.phone,
      profileImage: users.profileImage,
    })
    .from(users)
    .where(and(...conditions))
    .orderBy(users.name);

  return deliveryPersons;
}


// ===== Order Route Tracking =====

/**
 * Save a route tracking point for an order
 */
export async function saveOrderRoutePoint(data: {
  branchId: number;
  orderId: number;
  deliveryPersonId: number;
  latitude: string;
  longitude: string;
  accuracy?: string;
  speed?: string;
  heading?: string;
  deviationFromRoute?: number;
  isOffRoute?: boolean;
}) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(orderRouteTracking).values({
    branchId: data.branchId,
    orderId: data.orderId,
    deliveryPersonId: data.deliveryPersonId,
    latitude: data.latitude,
    longitude: data.longitude,
    accuracy: data.accuracy,
    speed: data.speed,
    heading: data.heading,
    deviationFromRoute: data.deviationFromRoute,
    isOffRoute: data.isOffRoute ? 1 : 0,
  });

  return result;
}

/**
 * Get route tracking points for an order
 */
export async function getOrderRoutePoints(orderId: number) {
  const db = await getDb();
  if (!db) return [];

  const points = await db
    .select()
    .from(orderRouteTracking)
    .where(eq(orderRouteTracking.orderId, orderId))
    .orderBy(orderRouteTracking.timestamp);

  return points;
}

/**
 * Get delivery speed analytics for all delivery persons
 */
export async function getDeliverySpeedAnalytics(filters?: {
  deliveryPersonId?: number;
  startDate?: Date;
  endDate?: Date;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [
    eq(orders.status, 'delivered'),
    eq(orders.isDeleted, 0),
    isNotNull(orders.deliveryDuration),
  ];

  if (filters?.deliveryPersonId) {
    conditions.push(eq(orders.deliveryPersonId, filters.deliveryPersonId));
  }

  if (filters?.startDate) {
    conditions.push(sql`${orders.createdAt} >= ${filters.startDate}`);
  }

  if (filters?.endDate) {
    conditions.push(sql`${orders.createdAt} <= ${filters.endDate}`);
  }

  // Get all delivered orders with delivery time
  const deliveredOrders = await db
    .select({
      id: orders.id,
      deliveryPersonId: orders.deliveryPersonId,
      deliveryPersonName: users.name,
      deliveryDuration: orders.deliveryDuration,
      totalDuration: orders.totalDuration,
      price: orders.price,
      regionName: regions.name,
      provinceName: provinces.name,
      customerName: customers.name,
      createdAt: orders.createdAt,
      acceptedAt: orders.acceptedAt,
      deliveredAt: orders.deliveredAt,
    })
    .from(orders)
    .leftJoin(users, eq(orders.deliveryPersonId, users.id))
    .leftJoin(regions, eq(orders.regionId, regions.id))
    .leftJoin(provinces, eq(orders.provinceId, provinces.id))
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(and(...conditions))
    .orderBy(orders.deliveryDuration);

  // Group by delivery person
  const byDeliveryPerson: Record<number, {
    deliveryPersonId: number;
    deliveryPersonName: string;
    orders: typeof deliveredOrders;
    totalOrders: number;
    avgDeliveryTime: number;
    minDeliveryTime: number;
    maxDeliveryTime: number;
    fastestOrder: typeof deliveredOrders[0] | null;
    slowestOrder: typeof deliveredOrders[0] | null;
    totalRevenue: number;
  }> = {};

  for (const order of deliveredOrders) {
    const dpId = order.deliveryPersonId;
    if (!byDeliveryPerson[dpId]) {
      byDeliveryPerson[dpId] = {
        deliveryPersonId: dpId,
        deliveryPersonName: order.deliveryPersonName || `مندوب #${dpId}`,
        orders: [],
        totalOrders: 0,
        avgDeliveryTime: 0,
        minDeliveryTime: Infinity,
        maxDeliveryTime: 0,
        fastestOrder: null,
        slowestOrder: null,
        totalRevenue: 0,
      };
    }

    const dp = byDeliveryPerson[dpId];
    dp.orders.push(order);
    dp.totalOrders++;
    dp.totalRevenue += order.price || 0;

    const duration = order.deliveryDuration || 0;
    if (duration > 0) {
      if (duration < dp.minDeliveryTime) {
        dp.minDeliveryTime = duration;
        dp.fastestOrder = order;
      }
      if (duration > dp.maxDeliveryTime) {
        dp.maxDeliveryTime = duration;
        dp.slowestOrder = order;
      }
    }
  }

  // Calculate averages
  for (const dpId in byDeliveryPerson) {
    const dp = byDeliveryPerson[dpId];
    const validOrders = dp.orders.filter(o => o.deliveryDuration && o.deliveryDuration > 0);
    if (validOrders.length > 0) {
      dp.avgDeliveryTime = Math.round(
        validOrders.reduce((sum, o) => sum + (o.deliveryDuration || 0), 0) / validOrders.length
      );
    }
    if (dp.minDeliveryTime === Infinity) dp.minDeliveryTime = 0;
  }

  return Object.values(byDeliveryPerson).sort((a, b) => a.avgDeliveryTime - b.avgDeliveryTime);
}

/**
 * Get fastest and slowest orders overall
 */
export async function getFastestAndSlowestOrders(filters?: {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return { fastest: [], slowest: [] };

  const conditions = [
    eq(orders.status, 'delivered'),
    eq(orders.isDeleted, 0),
    isNotNull(orders.deliveryDuration),
    gt(orders.deliveryDuration, 0),
  ];

  if (filters?.startDate) {
    conditions.push(sql`${orders.createdAt} >= ${filters.startDate}`);
  }

  if (filters?.endDate) {
    conditions.push(sql`${orders.createdAt} <= ${filters.endDate}`);
  }

  const limit = filters?.limit || 10;

  // Fastest orders
  const fastest = await db
    .select({
      id: orders.id,
      deliveryPersonId: orders.deliveryPersonId,
      deliveryPersonName: users.name,
      deliveryDuration: orders.deliveryDuration,
      totalDuration: orders.totalDuration,
      price: orders.price,
      regionName: regions.name,
      provinceName: provinces.name,
      customerName: customers.name,
      createdAt: orders.createdAt,
      acceptedAt: orders.acceptedAt,
      deliveredAt: orders.deliveredAt,
    })
    .from(orders)
    .leftJoin(users, eq(orders.deliveryPersonId, users.id))
    .leftJoin(regions, eq(orders.regionId, regions.id))
    .leftJoin(provinces, eq(orders.provinceId, provinces.id))
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(and(...conditions))
    .orderBy(orders.deliveryDuration)
    .limit(limit);

  // Slowest orders
  const slowest = await db
    .select({
      id: orders.id,
      deliveryPersonId: orders.deliveryPersonId,
      deliveryPersonName: users.name,
      deliveryDuration: orders.deliveryDuration,
      totalDuration: orders.totalDuration,
      price: orders.price,
      regionName: regions.name,
      provinceName: provinces.name,
      customerName: customers.name,
      createdAt: orders.createdAt,
      acceptedAt: orders.acceptedAt,
      deliveredAt: orders.deliveredAt,
    })
    .from(orders)
    .leftJoin(users, eq(orders.deliveryPersonId, users.id))
    .leftJoin(regions, eq(orders.regionId, regions.id))
    .leftJoin(provinces, eq(orders.provinceId, provinces.id))
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(and(...conditions))
    .orderBy(desc(orders.deliveryDuration))
    .limit(limit);

  return { fastest, slowest };
}

/**
 * Get monthly best delivery times for each delivery person
 */
export async function getMonthlyBestTimes(year: number, month: number) {
  const db = await getDb();
  if (!db) return [];

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const conditions = [
    eq(orders.status, 'delivered'),
    eq(orders.isDeleted, 0),
    isNotNull(orders.deliveryDuration),
    gt(orders.deliveryDuration, 0),
    sql`${orders.createdAt} >= ${startDate}`,
    sql`${orders.createdAt} <= ${endDate}`,
  ];

  // Get all delivered orders for the month
  const monthOrders = await db
    .select({
      id: orders.id,
      deliveryPersonId: orders.deliveryPersonId,
      deliveryPersonName: users.name,
      deliveryDuration: orders.deliveryDuration,
      createdAt: orders.createdAt,
      deliveredAt: orders.deliveredAt,
      regionName: regions.name,
    })
    .from(orders)
    .leftJoin(users, eq(orders.deliveryPersonId, users.id))
    .leftJoin(regions, eq(orders.regionId, regions.id))
    .where(and(...conditions));

  // Group by delivery person and find best time
  const bestTimes: Record<number, {
    deliveryPersonId: number;
    deliveryPersonName: string;
    bestTime: number;
    bestOrder: typeof monthOrders[0] | null;
    totalOrders: number;
    avgTime: number;
  }> = {};

  for (const order of monthOrders) {
    const dpId = order.deliveryPersonId;
    if (!bestTimes[dpId]) {
      bestTimes[dpId] = {
        deliveryPersonId: dpId,
        deliveryPersonName: order.deliveryPersonName || `مندوب #${dpId}`,
        bestTime: Infinity,
        bestOrder: null,
        totalOrders: 0,
        avgTime: 0,
      };
    }

    const bt = bestTimes[dpId];
    bt.totalOrders++;
    
    const duration = order.deliveryDuration || 0;
    if (duration > 0 && duration < bt.bestTime) {
      bt.bestTime = duration;
      bt.bestOrder = order;
    }
  }

  // Calculate averages
  for (const dpId in bestTimes) {
    const bt = bestTimes[dpId];
    const dpOrders = monthOrders.filter(o => o.deliveryPersonId === parseInt(dpId));
    const validOrders = dpOrders.filter(o => o.deliveryDuration && o.deliveryDuration > 0);
    if (validOrders.length > 0) {
      bt.avgTime = Math.round(
        validOrders.reduce((sum, o) => sum + (o.deliveryDuration || 0), 0) / validOrders.length
      );
    }
    if (bt.bestTime === Infinity) bt.bestTime = 0;
  }

  return Object.values(bestTimes).sort((a, b) => a.bestTime - b.bestTime);
}


/**
 * Get all active orders with live tracking data
 */
export async function getActiveOrdersWithLiveTracking() {
  const db = await getDb();
  if (!db) return [];

  // Get all pending orders (being delivered)
  const activeOrders = await db
    .select({
      id: orders.id,
      customerName: customers.name,
      customerPhone: customers.phone,
      customerLocationUrl1: customers.locationUrl1,
      customerLocationUrl2: customers.locationUrl2,
      regionName: regions.name,
      deliveryPersonId: orders.deliveryPersonId,
      deliveryPersonName: users.name,
      deliveryPersonImage: users.profileImage,
      status: orders.status,
      createdAt: orders.createdAt,
      acceptedAt: orders.acceptedAt,
      note: orders.note,
      price: orders.price,
      locationLink: orders.locationLink,
    })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .leftJoin(regions, eq(orders.regionId, regions.id))
    .leftJoin(users, eq(orders.deliveryPersonId, users.id))
    .where(
      and(
        eq(orders.status, 'pending'),
        eq(orders.isDeleted, 0),
        isNotNull(orders.deliveryPersonId)
      )
    )
    .orderBy(desc(orders.createdAt));

  // Get latest tracking point for each order
  const ordersWithTracking = await Promise.all(
    activeOrders.map(async (order) => {
      // Get tracking points from order_route_tracking
      const latestPoint = await db
        .select()
        .from(orderRouteTracking)
        .where(eq(orderRouteTracking.orderId, order.id))
        .orderBy(desc(orderRouteTracking.timestamp))
        .limit(1);

      const trackingPoints = await db
        .select()
        .from(orderRouteTracking)
        .where(eq(orderRouteTracking.orderId, order.id))
        .orderBy(orderRouteTracking.timestamp);

      // Also get delivery person's latest location from delivery_locations
      let deliveryPersonLocation = null;
      if (order.deliveryPersonId) {
        const latestDeliveryLocation = await db
          .select()
          .from(deliveryLocations)
          .where(eq(deliveryLocations.deliveryPersonId, order.deliveryPersonId))
          .orderBy(desc(deliveryLocations.createdAt))
          .limit(1);
        deliveryPersonLocation = latestDeliveryLocation[0] || null;
      }

      // Determine if tracking is active
      // Consider tracking active if:
      // 1. There are tracking points in order_route_tracking, OR
      // 2. Delivery person has recent location (within last 10 minutes)
      const hasTrackingPoints = trackingPoints.length > 0;
      const hasRecentDeliveryLocation = deliveryPersonLocation && 
        (Date.now() - new Date(deliveryPersonLocation.createdAt).getTime()) < 10 * 60 * 1000;
      
      const isTracking = hasTrackingPoints || hasRecentDeliveryLocation;
      
      // Use the most recent location available
      const currentLocation = latestPoint[0] || deliveryPersonLocation;

      return {
        ...order,
        currentLocation,
        deliveryPersonLocation,
        trackingPoints: trackingPoints,
        totalPoints: trackingPoints.length,
        isTracking,
        lastUpdate: currentLocation?.timestamp || null,
      };
    })
  );

  return ordersWithTracking;
}

/**
 * Get live tracking data for a specific order
 */
export async function getOrderLiveTracking(orderId: number) {
  const db = await getDb();
  if (!db) return null;

  // Get order details
  const orderData = await db
    .select({
      id: orders.id,
      customerName: customers.name,
      customerPhone: customers.phone,
      customerLocationUrl1: customers.locationUrl1,
      customerLocationUrl2: customers.locationUrl2,
      regionName: regions.name,
      deliveryPersonId: orders.deliveryPersonId,
      deliveryPersonName: users.name,
      status: orders.status,
      createdAt: orders.createdAt,
      note: orders.note,
      locationLink: orders.locationLink,
    })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .leftJoin(regions, eq(orders.regionId, regions.id))
    .leftJoin(users, eq(orders.deliveryPersonId, users.id))
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!orderData[0]) return null;

  // Get all tracking points
  const trackingPoints = await db
    .select()
    .from(orderRouteTracking)
    .where(eq(orderRouteTracking.orderId, orderId))
    .orderBy(orderRouteTracking.timestamp);

  // Get latest delivery person location
  let deliveryPersonLocation = null;
  if (orderData[0].deliveryPersonId) {
    const latestLocation = await db
      .select()
      .from(deliveryLocations)
      .where(eq(deliveryLocations.deliveryPersonId, orderData[0].deliveryPersonId))
      .orderBy(desc(deliveryLocations.createdAt))
      .limit(1);
    
    deliveryPersonLocation = latestLocation[0] || null;
  }

  // Calculate progress
  let progress = 0;
  let distanceCovered = 0;
  let estimatedTimeRemaining = null;

  if (trackingPoints.length >= 2) {
    // Calculate total distance covered
    for (let i = 1; i < trackingPoints.length; i++) {
      const prev = trackingPoints[i - 1];
      const curr = trackingPoints[i];
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
      distanceCovered += R * c;
    }
  }

  return {
    order: orderData[0],
    trackingPoints,
    currentLocation: deliveryPersonLocation,
    stats: {
      totalPoints: trackingPoints.length,
      distanceCovered: Math.round(distanceCovered * 100) / 100,
      startTime: trackingPoints[0]?.timestamp || null,
      lastUpdate: trackingPoints[trackingPoints.length - 1]?.timestamp || null,
      isOffRoute: trackingPoints[trackingPoints.length - 1]?.isOffRoute || 0,
      deviation: trackingPoints[trackingPoints.length - 1]?.deviationFromRoute || 0,
    },
  };
}

/**
 * Get delivery progress for an order
 */
export async function getOrderDeliveryProgress(orderId: number) {
  const db = await getDb();
  if (!db) return null;

  // Get order with delivery person
  const orderData = await db
    .select({
      id: orders.id,
      deliveryPersonId: orders.deliveryPersonId,
      status: orders.status,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!orderData[0] || !orderData[0].deliveryPersonId) return null;

  // Get tracking points
  const trackingPoints = await db
    .select()
    .from(orderRouteTracking)
    .where(eq(orderRouteTracking.orderId, orderId))
    .orderBy(orderRouteTracking.timestamp);

  // Get current delivery person location
  const currentLocation = await db
    .select()
    .from(deliveryLocations)
    .where(eq(deliveryLocations.deliveryPersonId, orderData[0].deliveryPersonId))
    .orderBy(desc(deliveryLocations.createdAt))
    .limit(1);

  // Calculate average speed
  let avgSpeed = 0;
  let totalSpeed = 0;
  let speedCount = 0;
  
  for (const point of trackingPoints) {
    if (point.speed) {
      const speed = parseFloat(point.speed);
      if (!isNaN(speed) && speed > 0) {
        totalSpeed += speed;
        speedCount++;
      }
    }
  }
  
  if (speedCount > 0) {
    avgSpeed = Math.round((totalSpeed / speedCount) * 3.6); // Convert m/s to km/h
  }

  // Calculate duration
  let durationMinutes = 0;
  if (trackingPoints.length > 0) {
    const startTime = new Date(trackingPoints[0].timestamp).getTime();
    const endTime = new Date(trackingPoints[trackingPoints.length - 1].timestamp).getTime();
    durationMinutes = Math.round((endTime - startTime) / 60000);
  }

  return {
    orderId,
    status: orderData[0].status,
    isTracking: trackingPoints.length > 0,
    currentLocation: currentLocation[0] || null,
    trackingStats: {
      totalPoints: trackingPoints.length,
      avgSpeed,
      durationMinutes,
      lastUpdate: trackingPoints[trackingPoints.length - 1]?.timestamp || null,
      currentSpeed: currentLocation[0]?.speed ? Math.round(parseFloat(currentLocation[0].speed) * 3.6) : 0,
      accuracy: currentLocation[0]?.accuracy || null,
    },
    path: trackingPoints.map(p => ({
      lat: parseFloat(p.latitude),
      lng: parseFloat(p.longitude),
      timestamp: p.timestamp,
      speed: p.speed ? parseFloat(p.speed) : null,
      isOffRoute: p.isOffRoute,
    })),
  };
}

// ===== Backup Functions =====

export async function getAllOrdersForBackup() {
  const db = await getDb();
  if (!db) return [];
  
  try {
    const result = await db.select().from(orders);
    return result;
  } catch (error) {
    console.error('[Database] Error getting all orders for backup:', error);
    return [];
  }
}

export async function getAllDailyStats() {
  const db = await getDb();
  if (!db) return [];
  
  try {
    const result = await db.select().from(dailyStats);
    return result;
  } catch (error) {
    console.error('[Database] Error getting all daily stats:', error);
    return [];
  }
}

export async function getAllActivityLogs() {
  const db = await getDb();
  if (!db) return [];
  
  try {
    const result = await db.select().from(activityLogs);
    return result;
  } catch (error) {
    console.error('[Database] Error getting all activity logs:', error);
    return [];
  }
}

export async function getAllLocations() {
  return await getAllDeliveryLocations();
}

// ===== Settings Management =====

export async function getSetting(key: string) {
  const db = await getDb();
  if (!db) return null;
  
  try {
    const result = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('[Database] Error getting setting:', error);
    return null;
  }
}

export async function getAllSettings() {
  const db = await getDb();
  if (!db) return [];
  
  try {
    const result = await db.select().from(settings);
    return result;
  } catch (error) {
    console.error('[Database] Error getting all settings:', error);
    return [];
  }
}

export async function updateSetting(key: string, value: string) {
  const db = await getDb();
  if (!db) return false;
  
  try {
    await db.update(settings).set({ value }).where(eq(settings.key, key));
    return true;
  } catch (error) {
    console.error('[Database] Error updating setting:', error);
    return false;
  }
}

export async function getDayStartHour(): Promise<number> {
  const setting = await getSetting('day_start_hour');
  if (setting && setting.value) {
    const hour = parseInt(setting.value);
    if (!isNaN(hour) && hour >= 0 && hour <= 23) {
      return hour;
    }
  }
  return 5; // الافتراضي 5 صباحاً
}


// ===== Branch Management =====

export async function getAllBranches() {
  const db = await getDb();
  if (!db) return [];
  
  const { branches } = await import("../drizzle/schema");
  // Only return non-deleted branches
  return await db.select().from(branches)
    .where(sql`${branches.deletedAt} IS NULL`)
    .orderBy(desc(branches.createdAt));
}

export async function getBranchById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const { branches } = await import("../drizzle/schema");
  const result = await db.select().from(branches).where(eq(branches.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createBranch(data: {
  name: string;
  code: string;
  address?: string;
  phone?: string;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { branches } = await import("../drizzle/schema");
  const result = await db.insert(branches).values({
    name: data.name,
    code: data.code,
    address: data.address || null,
    phone: data.phone || null,
    subscriptionStartDate: data.subscriptionStartDate || null,
    subscriptionEndDate: data.subscriptionEndDate || null,
    isActive: 1,
  });
  
  // Get the created branch
  const newBranch = await db.select().from(branches).where(eq(branches.code, data.code)).limit(1);
  return newBranch[0];
}

export async function updateBranch(id: number, data: {
  name?: string;
  address?: string;
  phone?: string;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  isActive?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { branches } = await import("../drizzle/schema");
  const updateData: any = { ...data };
  if (typeof data.isActive === 'boolean') {
    updateData.isActive = data.isActive ? 1 : 0;
  }
  
  await db.update(branches).set(updateData).where(eq(branches.id, id));
}

// Soft delete branch (can be restored within 30 days)
export async function softDeleteBranch(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { branches } = await import("../drizzle/schema");
  await db.update(branches).set({ 
    deletedAt: new Date().toISOString(),
    isActive: 0 
  }).where(eq(branches.id, id));
}

// Restore deleted branch
export async function restoreBranch(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { branches } = await import("../drizzle/schema");
  await db.update(branches).set({ 
    deletedAt: null,
    isActive: 1 
  }).where(eq(branches.id, id));
}

// Get deleted branches
export async function getDeletedBranches() {
  const db = await getDb();
  if (!db) return [];
  
  const { branches } = await import("../drizzle/schema");
  return await db.select().from(branches)
    .where(sql`${branches.deletedAt} IS NOT NULL`)
    .orderBy(desc(branches.deletedAt));
}

// Permanently delete branches older than 30 days
export async function permanentlyDeleteOldBranches() {
  const db = await getDb();
  if (!db) return 0;
  
  const { branches } = await import("../drizzle/schema");
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  await db.delete(branches)
    .where(and(
      sql`${branches.deletedAt} IS NOT NULL`,
      sql`${branches.deletedAt} < ${thirtyDaysAgo.toISOString()}`
    ));
  
  return 1; // Success
}

export async function getAllBranchesStats() {
  const db = await getDb();
  if (!db) return [];
  
  const { branches } = await import("../drizzle/schema");
  
  // Get all branches
  const allBranches = await db.select().from(branches);
  
  // Get stats for each branch
  const stats = await Promise.all(allBranches.map(async (branch) => {
    // Count orders
    const orderStats = await db.select({
      total: sql<number>`COUNT(*)`,
      delivered: sql<number>`SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END)`,
      pending: sql<number>`SUM(CASE WHEN status IN ('pending', 'pending_approval') THEN 1 ELSE 0 END)`,
      revenue: sql<number>`SUM(CASE WHEN status = 'delivered' THEN price ELSE 0 END)`,
    }).from(orders).where(and(
      eq(orders.branchId, branch.id),
      eq(orders.isDeleted, 0)
    ));
    
    // Count delivery persons
    const deliveryPersonCount = await db.select({
      count: sql<number>`COUNT(*)`,
    }).from(users).where(and(
      eq(users.branchId, branch.id),
      eq(users.role, 'delivery'),
      eq(users.isActive, 1)
    ));
    
    // Count customers
    const customerCount = await db.select({
      count: sql<number>`COUNT(*)`,
    }).from(customers).where(eq(customers.branchId, branch.id));
    
    return {
      ...branch,
      stats: {
        totalOrders: orderStats[0]?.total || 0,
        deliveredOrders: orderStats[0]?.delivered || 0,
        pendingOrders: orderStats[0]?.pending || 0,
        revenue: orderStats[0]?.revenue || 0,
        deliveryPersons: deliveryPersonCount[0]?.count || 0,
        customers: customerCount[0]?.count || 0,
      }
    };
  }));
  
  return stats;
}

// ===== Advanced Delivery Person Stats =====

export async function getDeliveryPersonWorkingDays(deliveryPersonId: number, startDate?: string, endDate?: string) {
  const db = await getDb();
  if (!db) return { workingDays: 0, nonWorkingDays: 0, totalDays: 0, workingDaysList: [], nonWorkingDaysList: [] };
  
  // Default to current month if no dates provided
  const now = new Date();
  const start = startDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const end = endDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;
  
  // Get all days where delivery person had at least one delivered order
  const workingDaysResult = await db.execute(sql`
    SELECT DISTINCT DATE(createdAt) as workDay
    FROM orders
    WHERE deliveryPersonId = ${deliveryPersonId}
      AND status = 'delivered'
      AND isDeleted = 0
      AND DATE(createdAt) >= ${start}
      AND DATE(createdAt) <= ${end}
    ORDER BY workDay
  `);
  
  const workingDaysList = ((workingDaysResult[0] as unknown) as any[]).map((row: any) => row.workDay);
  
  // Calculate total days in range
  const startDateObj = new Date(start);
  const endDateObj = new Date(end);
  const totalDays = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  // Get all days in range
  const allDays: string[] = [];
  for (let d = new Date(start); d <= endDateObj; d.setDate(d.getDate() + 1)) {
    allDays.push(d.toISOString().split('T')[0]);
  }
  
  // Find non-working days
  const nonWorkingDaysList = allDays.filter(day => !workingDaysList.includes(day));
  
  return {
    workingDays: workingDaysList.length,
    nonWorkingDays: nonWorkingDaysList.length,
    totalDays,
    workingDaysList,
    nonWorkingDaysList,
  };
}

// ===== Subscription Codes Management =====

export async function generateSubscriptionCode(params: {
  durationType: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  customDays?: number;
  createdBy: number;
  expiresAt?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { subscriptionCodes } = await import("../drizzle/schema");

  // حساب عدد الأيام حسب نوع الاشتراك
  let durationDays: number;
  switch (params.durationType) {
    case 'daily':
      durationDays = 1;
      break;
    case 'weekly':
      durationDays = 7;
      break;
    case 'monthly':
      durationDays = 30;
      break;
    case 'yearly':
      durationDays = 365;
      break;
    case 'custom':
      if (!params.customDays || params.customDays <= 0) {
        throw new Error("يجب تحديد عدد الأيام للفترة المخصصة");
      }
      durationDays = params.customDays;
      break;
    default:
      throw new Error("نوع الاشتراك غير صحيح");
  }

  // توليد كود فريد
  const code = `SUB-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

  await db.insert(subscriptionCodes).values({
    code,
    durationType: params.durationType,
    durationDays,
    createdBy: params.createdBy,
    expiresAt: params.expiresAt,
  });

  return { code, durationDays };
}

export async function getAllSubscriptionCodes() {
  const db = await getDb();
  if (!db) return [];

  const { subscriptionCodes, branches } = await import("../drizzle/schema");

  const codes = await db
    .select({
      id: subscriptionCodes.id,
      code: subscriptionCodes.code,
      durationType: subscriptionCodes.durationType,
      durationDays: subscriptionCodes.durationDays,
      isUsed: subscriptionCodes.isUsed,
      usedBy: subscriptionCodes.usedBy,
      usedAt: subscriptionCodes.usedAt,
      createdAt: subscriptionCodes.createdAt,
      expiresAt: subscriptionCodes.expiresAt,
      branchName: branches.name,
    })
    .from(subscriptionCodes)
    .leftJoin(branches, eq(subscriptionCodes.usedBy, branches.id))
    .orderBy(desc(subscriptionCodes.createdAt));

  return codes;
}

export async function validateAndUseSubscriptionCode(code: string, branchId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { subscriptionCodes, branches } = await import("../drizzle/schema");

  // البحث عن الكود
  const codeResult = await db
    .select()
    .from(subscriptionCodes)
    .where(eq(subscriptionCodes.code, code))
    .limit(1);

  if (codeResult.length === 0) {
    throw new Error("كود الاشتراك غير صحيح");
  }

  const subscriptionCode = codeResult[0];

  // التحقق من أن الكود لم يستخدم من قبل
  if (subscriptionCode.isUsed) {
    throw new Error("هذا الكود مستخدم بالفعل");
  }

  // التحقق من صلاحية الكود
  if (subscriptionCode.expiresAt) {
    const expiryDate = new Date(subscriptionCode.expiresAt);
    if (expiryDate < new Date()) {
      throw new Error("انتهت صلاحية هذا الكود");
    }
  }

  // الحصول على معلومات الفرع
  const branch = await db
    .select()
    .from(branches)
    .where(eq(branches.id, branchId))
    .limit(1);

  if (branch.length === 0) {
    throw new Error("الفرع غير موجود");
  }

  // حساب تاريخ انتهاء الاشتراك الجديد
  const currentEndDate = branch[0].subscriptionEndDate 
    ? new Date(branch[0].subscriptionEndDate)
    : new Date();
  
  // إذا كان الاشتراك الحالي منتهي، نبدأ من اليوم
  const startDate = currentEndDate > new Date() ? currentEndDate : new Date();
  
  const newEndDate = new Date(startDate);
  newEndDate.setDate(newEndDate.getDate() + subscriptionCode.durationDays);

  // تحديث الفرع
  await db
    .update(branches)
    .set({
      subscriptionEndDate: newEndDate.toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(branches.id, branchId));

  // تحديث الكود كمستخدم
  await db
    .update(subscriptionCodes)
    .set({
      isUsed: 1,
      usedBy: branchId,
      usedAt: new Date().toISOString(),
    })
    .where(eq(subscriptionCodes.id, subscriptionCode.id));

  return {
    success: true,
    newEndDate: newEndDate.toISOString(),
    daysAdded: subscriptionCode.durationDays,
  };
}

export async function deleteSubscriptionCode(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { subscriptionCodes } = await import("../drizzle/schema");
  await db.delete(subscriptionCodes).where(eq(subscriptionCodes.id, id));
}

export async function getSubscriptionPrice() {
  const db = await getDb();
  if (!db) return { price: 3000 };

  const result = await db
    .select()
    .from(settings)
    .where(eq(settings.key, 'subscription_annual_price'))
    .limit(1);

  if (result.length === 0) {
    return { price: 3000 };
  }

  return { price: parseInt(result[0].value) };
}

export async function updateSubscriptionPrice(price: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(settings)
    .set({ value: price.toString() })
    .where(eq(settings.key, 'subscription_annual_price'));
}

// ===== Pharmacy Registration =====

export async function registerPharmacy(params: {
  activationCode: string;
  pharmacyName: string;
  address?: string;
  phone?: string;
  ownerName: string;
  username: string;
  password: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { subscriptionCodes, branches, users } = await import("../drizzle/schema");

  // التحقق من كود التفعيل
  const codeResult = await db
    .select()
    .from(subscriptionCodes)
    .where(eq(subscriptionCodes.code, params.activationCode))
    .limit(1);

  if (codeResult.length === 0) {
    throw new Error("كود التفعيل غير صحيح");
  }

  const subscriptionCode = codeResult[0];

  if (subscriptionCode.isUsed) {
    throw new Error("هذا الكود مستخدم بالفعل");
  }

  if (subscriptionCode.expiresAt) {
    const expiryDate = new Date(subscriptionCode.expiresAt);
    if (expiryDate < new Date()) {
      throw new Error("انتهت صلاحية كود التفعيل");
    }
  }

  // التحقق من أن اسم المستخدم غير مستخدم
  const existingUser = await getUserByUsername(params.username);
  if (existingUser) {
    throw new Error("اسم المستخدم مستخدم بالفعل");
  }

  // إنشاء الفرع (الصيدلية)
  const branchCode = `PH-${Date.now()}`;
  const subscriptionEndDate = new Date();
  subscriptionEndDate.setDate(subscriptionEndDate.getDate() + subscriptionCode.durationDays);

  const [branchResult] = await db.insert(branches).values({
    name: params.pharmacyName,
    code: branchCode,
    address: params.address || '',
    phone: params.phone || '',
    isActive: 1,
    subscriptionStartDate: new Date().toISOString(),
    subscriptionEndDate: subscriptionEndDate.toISOString(),
  });

  const branchId = Number(branchResult.insertId);

  // إنشاء حساب المدير
  const passwordHash = await hash(params.password, 10);
  
  await db.insert(users).values({
    branchId,
    username: params.username,
    passwordHash,
    name: params.ownerName,
    role: 'admin',
    isActive: 1,
  });

  // تحديث الكود كمستخدم
  await db
    .update(subscriptionCodes)
    .set({
      isUsed: 1,
      usedBy: branchId,
      usedAt: new Date().toISOString(),
    })
    .where(eq(subscriptionCodes.id, subscriptionCode.id));

  return {
    success: true,
    branchId,
    subscriptionEndDate: subscriptionEndDate.toISOString(),
  };
}

// ===== Maintenance Mode Management =====

/**
 * Get maintenance mode status
 */
export async function getMaintenanceMode() {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(maintenanceMode).limit(1);
  return result.length > 0 ? result[0] : null;
}

/**
 * Update maintenance mode
 */
export async function updateMaintenanceMode(data: {
  isEnabled: number;
  message?: string;
  estimatedEndTime?: string | null;
  updatedBy: number;
}) {
  const db = await getDb();
  if (!db) return null;
  
  // Check if record exists
  const existing = await db.select().from(maintenanceMode).limit(1);
  
  if (existing.length > 0) {
    // Update existing record
    await db.update(maintenanceMode)
      .set({
        isEnabled: data.isEnabled,
        message: data.message,
        estimatedEndTime: data.estimatedEndTime,
        updatedBy: data.updatedBy,
      })
      .where(eq(maintenanceMode.id, existing[0].id));
    
    return { success: true };
  } else {
    // Insert new record
    await db.insert(maintenanceMode).values({
      isEnabled: data.isEnabled,
      message: data.message,
      estimatedEndTime: data.estimatedEndTime,
      updatedBy: data.updatedBy,
    });
    
    return { success: true };
  }
}


// ==================== Store Functions ====================

export async function getAllStoreProducts() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(storeProducts).where(eq(storeProducts.isActive, 1)).orderBy(desc(storeProducts.createdAt));
}

export async function createStoreProduct(data: { name: string; description?: string; price: string; type: 'product' | 'subscription'; durationMonths?: number }) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(storeProducts).values(data);
  return { success: true };
}

export async function purchaseProduct(branchId: number, productId: number, price: string) {
  const db = await getDb();
  if (!db) return null;
  
  const activationCode = `ACT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  
  await db.insert(storePurchases).values({
    branchId,
    productId,
    activationCode,
    price,
    isActivated: 0,
  });
  
  return { activationCode };
}

export async function activateSubscription(activationCode: string, branchId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const purchase = await db.select().from(storePurchases)
    .where(and(eq(storePurchases.activationCode, activationCode), eq(storePurchases.branchId, branchId)))
    .limit(1);
  
  if (!purchase.length || purchase[0].isActivated) {
    return { success: false, message: 'كود غير صالح أو مستخدم بالفعل' };
  }
  
  const product = await db.select().from(storeProducts).where(eq(storeProducts.id, purchase[0].productId)).limit(1);
  if (!product.length || product[0].type !== 'subscription') {
    return { success: false, message: 'المنتج غير صالح' };
  }
  
  const startDate = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + (product[0].durationMonths || 1));
  
  await db.update(storePurchases).set({ isActivated: 1, activatedAt: startDate.toISOString() })
    .where(eq(storePurchases.id, purchase[0].id));
  
  await db.insert(subscriptionActivations).values({
    branchId,
    productId: purchase[0].productId,
    purchaseId: purchase[0].id,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    isActive: 1,
  });
  
  return { success: true, endDate: endDate.toISOString() };
}

export async function getBranchPurchases(branchId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(storePurchases).where(eq(storePurchases.branchId, branchId)).orderBy(desc(storePurchases.purchasedAt));
}

export async function getActiveSubscriptions(branchId: number) {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return await db.select().from(subscriptionActivations)
    .where(and(
      eq(subscriptionActivations.branchId, branchId),
      gt(subscriptionActivations.endDate, now.toISOString())
    ))
    .orderBy(desc(subscriptionActivations.createdAt));
}



// ===== دوال نظام التحديثات =====
export async function getAllUpdates() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(updates).orderBy(desc(updates.createdAt));
}

export async function createUpdate(data: { title: string; content: string; type: string; imageUrl?: string; createdBy: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const result = await db.insert(updates).values(data);
  return result;
}

export async function updateUpdate(id: number, data: { title?: string; content?: string; type?: string; imageUrl?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  await db.update(updates).set(data).where(eq(updates.id, id));
  return { success: true };
}

export async function deleteUpdate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  await db.delete(updates).where(eq(updates.id, id));
  return { success: true };
}

// ===== دوال نظام الإعلانات =====
export async function getAllAnnouncements() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(announcements).orderBy(desc(announcements.createdAt));
}

export async function createAnnouncement(data: { title: string; content: string; type: string; imageUrl?: string; isActive: number; createdBy: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const result = await db.insert(announcements).values(data);
  return result;
}

export async function getActiveAnnouncement(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  // الحصول على الإعلان النشط
  const activeAnnouncements = await db.select().from(announcements)
    .where(eq(announcements.isActive, 1))
    .orderBy(desc(announcements.createdAt))
    .limit(1);
  
  if (activeAnnouncements.length === 0) return null;
  
  const announcement = activeAnnouncements[0];
  
  // التحقق من أن المستخدم لم يقرأ الإعلان
  const reads = await db.select().from(announcementReads)
    .where(and(
      eq(announcementReads.announcementId, announcement.id),
      eq(announcementReads.userId, userId)
    ));
  
  if (reads.length > 0) return null;
  
  return announcement;
}

export async function markAnnouncementAsRead(announcementId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  await db.insert(announcementReads).values({ announcementId, userId });
  return { success: true };
}

export async function updateAnnouncement(id: number, data: { title?: string; content?: string; type?: string; imageUrl?: string; isActive?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  await db.update(announcements).set(data).where(eq(announcements.id, id));
  return { success: true };
}

export async function deleteAnnouncement(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  await db.delete(announcements).where(eq(announcements.id, id));
  return { success: true };
}

// ===== دوال نظام إعدادات الموقع =====
export async function getSiteSettings() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(siteSettings);
}

export async function updateSiteSetting(key: string, value: string) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  
  // التحقق من وجود الإعداد
  const existing = await db.select().from(siteSettings).where(eq(siteSettings.settingKey, key));
  
  if (existing.length > 0) {
    // تحديث الإعداد الموجود
    await db.update(siteSettings).set({ settingValue: value }).where(eq(siteSettings.settingKey, key));
  } else {
    // إنشاء إعداد جديد
    await db.insert(siteSettings).values({ settingKey: key, settingValue: value });
  }
  
  return { success: true };
}

// ===== Notification Settings =====

export async function getNotificationSettings(branchId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(notificationSettings).where(eq(notificationSettings.branchId, branchId));
  return result[0] || null;
}

export async function createNotificationSettings(data: {
  branchId: number;
  oneSignalAppId?: string;
  oneSignalRestApiKey?: string;
  notifyOnNewOrder?: number;
  notifyOnMessage?: number;
  isEnabled?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  
  await db.insert(notificationSettings).values(data);
  return { success: true };
}

export async function updateNotificationSettings(branchId: number, data: {
  oneSignalAppId?: string;
  oneSignalRestApiKey?: string;
  notifyOnNewOrder?: number;
  notifyOnMessage?: number;
  isEnabled?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  
  await db.update(notificationSettings).set(data).where(eq(notificationSettings.branchId, branchId));
  return { success: true };
}

export async function getAllNotificationSettings() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(notificationSettings);
}

// ===== Notification Logs =====

export async function createNotificationLog(data: {
  branchId: number;
  userId?: number;
  title: string;
  message: string;
  recipientCount: number;
  status: 'success' | 'failed';
  errorMessage?: string;
  oneSignalResponse?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  
  await db.insert(notificationLogs).values(data);
  return { success: true };
}

export async function getNotificationLogs(branchId: number, limit: number = 100) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(notificationLogs)
    .where(eq(notificationLogs.branchId, branchId))
    .orderBy(desc(notificationLogs.createdAt))
    .limit(limit);
}

export async function getNotificationStats(branchId: number, startDate?: string, endDate?: string) {
  const db = await getDb();
  if (!db) return null;
  
  const conditions = [eq(notificationLogs.branchId, branchId)];
  
  if (startDate) {
    conditions.push(sql`${notificationLogs.createdAt} >= ${startDate}`);
  }
  
  if (endDate) {
    conditions.push(sql`${notificationLogs.createdAt} <= ${endDate}`);
  }
  
  const logs = await db.select()
    .from(notificationLogs)
    .where(and(...conditions));
  
  const totalSent = logs.length;
  const successCount = logs.filter(log => log.status === 'success').length;
  const failedCount = logs.filter(log => log.status === 'failed').length;
  const totalRecipients = logs.reduce((sum, log) => sum + (log.recipientCount || 0), 0);

  return {
    totalSent,
    successCount,
    failedCount,
    successRate: totalSent > 0 ? ((successCount / totalSent) * 100).toFixed(2) : '0',
    totalRecipients,
  };
}

// ===== FCM Token Management =====

export async function saveFCMToken(userId: number, fcmToken: string) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const user = await db.select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user.length === 0) {
    throw new Error("User not found");
  }

  await db.update(users)
    .set({ fcmToken })
    .where(eq(users.id, userId));

  return { success: true };
}

export async function getFCMToken(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const user = await db.select({ fcmToken: users.fcmToken })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user.length > 0 ? user[0].fcmToken : null;
}

export async function getAllFCMTokens(role?: string) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [isNotNull(users.fcmToken)];

  if (role) {
    conditions.push(eq(users.role, role));
  }

  const result = await db.select({ id: users.id, fcmToken: users.fcmToken })
    .from(users)
    .where(and(...conditions));

  return result;
}

// ===== Location Tracking =====

export async function saveDeliveryLocation(data: {
  userId: number;
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
  createdAt?: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const result = await db.insert(deliveryLocations).values({
    userId: data.userId,
    latitude: data.latitude.toString(),
    longitude: data.longitude.toString(),
    accuracy: data.accuracy,
    altitude: data.altitude,
    heading: data.heading,
    speed: data.speed,
    createdAt: data.createdAt || new Date(),
  });

  return result;
}

export async function getDeliveryLocations(userId: number, limit: number = 50, withinMinutes: number = 60) {
  const db = await getDb();
  if (!db) return [];

  const timeCutoff = new Date(Date.now() - withinMinutes * 60 * 1000);

  const locations = await db.select()
    .from(deliveryLocations)
    .where(
      and(
        eq(deliveryLocations.userId, userId),
        gte(deliveryLocations.createdAt, timeCutoff)
      )
    )
    .orderBy(desc(deliveryLocations.createdAt))
    .limit(limit);

  return locations.map(loc => ({
    ...loc,
    latitude: parseFloat(loc.latitude),
    longitude: parseFloat(loc.longitude),
  }));
}

export async function getCurrentDeliveryLocation(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const location = await db.select()
    .from(deliveryLocations)
    .where(eq(deliveryLocations.userId, userId))
    .orderBy(desc(deliveryLocations.createdAt))
    .limit(1);

  if (location.length === 0) return null;

  return {
    ...location[0],
    latitude: parseFloat(location[0].latitude),
    longitude: parseFloat(location[0].longitude),
  };
}

export async function getActiveDeliveryLocations(branchId: number, withinMinutes: number = 15) {
  const db = await getDb();
  if (!db) return [];

  const timeCutoff = new Date(Date.now() - withinMinutes * 60 * 1000);

  // Get latest location for each active delivery person in branch
  const locations = await db.select()
    .from(deliveryLocations)
    .innerJoin(users, eq(deliveryLocations.userId, users.id))
    .where(
      and(
        eq(users.branchId, branchId),
        gte(deliveryLocations.createdAt, timeCutoff)
      )
    )
    .orderBy(desc(deliveryLocations.createdAt));

  // Group by user to get latest location
  const latestByUser = new Map();
  locations.forEach(({ delivery_locations, users: user }) => {
    if (!latestByUser.has(delivery_locations.userId)) {
      latestByUser.set(delivery_locations.userId, {
        userId: delivery_locations.userId,
        userName: user.name,
        latitude: parseFloat(delivery_locations.latitude),
        longitude: parseFloat(delivery_locations.longitude),
        accuracy: delivery_locations.accuracy,
        heading: delivery_locations.heading,
        speed: delivery_locations.speed,
        updatedAt: delivery_locations.createdAt,
      });
    }
  });

  return Array.from(latestByUser.values());
}

export async function getDeliveryRoute(orderId: string) {
  const db = await getDb();
  if (!db) return [];

  // Get delivery person for this order
  const delivery = await db.select()
    .from(deliveries)
    .where(eq(deliveries.orderId, orderId))
    .limit(1);

  if (delivery.length === 0) return [];

  const userId = delivery[0].userId;

  // Get all locations during delivery
  const locations = await db.select()
    .from(deliveryLocations)
    .where(eq(deliveryLocations.userId, userId))
    .orderBy(asc(deliveryLocations.createdAt));

  return locations.map(loc => ({
    ...loc,
    latitude: parseFloat(loc.latitude),
    longitude: parseFloat(loc.longitude),
  }));
}
