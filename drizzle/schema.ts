import { mysqlTable, mysqlSchema, AnyMySqlColumn, int, mysqlEnum, text, varchar, timestamp, index, tinyint, decimal } from "drizzle-orm/mysql-core"
import { sql } from "drizzle-orm"

// جدول الفروع
export const branches = mysqlTable("branches", {
	id: int().autoincrement().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	code: varchar({ length: 50 }).notNull(),
	address: text(),
	phone: varchar({ length: 20 }),
	isActive: tinyint().default(1).notNull(),
	subscriptionStartDate: timestamp({ mode: 'string' }),
	subscriptionEndDate: timestamp({ mode: 'string' }),
	deletedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("code_idx").on(table.code),
]);

export const activityLogs = mysqlTable("activity_logs", {
	id: int().autoincrement().primaryKey().notNull(),
	branchId: int().notNull(),
	userId: int().notNull(),
	activityType: mysqlEnum(['login','logout','page_view','order_create','order_update','order_delete','delivery_assign','status_change','settings_change','user_create','user_update','user_delete','customer_create','customer_update','customer_delete']).notNull(),
	description: text(),
	metadata: text(),
	ipAddress: varchar({ length: 50 }),
	userAgent: text(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
});

export const customers = mysqlTable("customers", {
	id: int().autoincrement().primaryKey().notNull(),
	branchId: int().notNull(),
	name: varchar({ length: 255 }),
	phone: varchar({ length: 20 }),
	email: varchar({ length: 320 }),
	address1: text(),
	address2: text(),
	locationUrl1: text(),
	locationUrl2: text(),
	notes: text(),
	regionId: int(),
	lastDeliveryLocation: text(),
	lastDeliveryAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("branch_idx").on(table.branchId),
]);

export const dailyStats = mysqlTable("dailyStats", {
	id: int().autoincrement().primaryKey().notNull(),
	branchId: int().notNull(),
	date: varchar({ length: 10 }).notNull(),
	totalOrders: int().default(0).notNull(),
	deliveredOrders: int().default(0).notNull(),
	pendingOrders: int().default(0).notNull(),
	postponedOrders: int().default(0).notNull(),
	returnedOrders: int().default(0).notNull(),
	activeDeliveries: int().default(0).notNull(),
	totalRegions: int().default(0).notNull(),
	totalProfit: int().default(0).notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
},
(table) => [
	index("date").on(table.date),
	index("branch_idx").on(table.branchId),
]);

export const deliveryLocations = mysqlTable("delivery_locations", {
	id: int().autoincrement().primaryKey().notNull(),
	branchId: int().notNull(),
	deliveryPersonId: int().notNull(),
	deviceId: varchar({ length: 100 }),
	latitude: varchar({ length: 50 }).notNull(),
	longitude: varchar({ length: 50 }).notNull(),
	accuracy: varchar({ length: 50 }),
	speed: varchar({ length: 20 }),
	heading: varchar({ length: 20 }),
	battery: varchar({ length: 10 }),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
});

export const messages = mysqlTable("messages", {
	id: int().autoincrement().primaryKey().notNull(),
	branchId: int().notNull(),
	senderId: int().notNull(),
	receiverId: int(),
	title: varchar({ length: 255 }).notNull(),
	content: text().notNull(),
	type: mysqlEnum(['message','order_notification','system']).default('message').notNull(),
	isRead: tinyint().default(0).notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
});

export const notifications = mysqlTable("notifications", {
	id: int().autoincrement().primaryKey().notNull(),
	branchId: int().notNull(),
	userId: int().notNull(),
	title: varchar({ length: 255 }).notNull(),
	message: text().notNull(),
	type: mysqlEnum(['order_assigned','order_accepted','order_rejected','order_delivered','order_postponed','order_returned','message','general']).default('general').notNull(),
	orderId: int(),
	isRead: tinyint().default(0).notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
});

export const orderFormSettings = mysqlTable("order_form_settings", {
	id: int().autoincrement().primaryKey().notNull(),
	branchId: int().notNull(),
	fieldName: varchar({ length: 50 }).notNull(),
	fieldLabel: varchar({ length: 100 }).notNull(),
	isVisible: tinyint().default(1).notNull(),
	displayOrder: int().default(0).notNull(),
	isRequired: tinyint().default(0).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("fieldName").on(table.fieldName),
]);

export const orderLocations = mysqlTable("order_locations", {
	id: int().autoincrement().primaryKey().notNull(),
	branchId: int().notNull(),
	orderId: int().notNull(),
	deliveryPersonId: int().notNull(),
	locationType: mysqlEnum(['accept','deliver']).notNull(),
	latitude: varchar({ length: 50 }).notNull(),
	longitude: varchar({ length: 50 }).notNull(),
	accuracy: varchar({ length: 50 }),
	timestamp: timestamp({ mode: 'string' }).defaultNow().notNull(),
});

export const orderRouteTracking = mysqlTable("order_route_tracking", {
	id: int().autoincrement().primaryKey().notNull(),
	branchId: int().notNull(),
	orderId: int().notNull(),
	deliveryPersonId: int().notNull(),
	latitude: varchar({ length: 50 }).notNull(),
	longitude: varchar({ length: 50 }).notNull(),
	accuracy: varchar({ length: 50 }),
	speed: varchar({ length: 20 }),
	heading: varchar({ length: 20 }),
	deviationFromRoute: int(),
	isOffRoute: tinyint().default(0),
	timestamp: timestamp({ mode: 'string' }).defaultNow().notNull(),
},
(table) => [
	index("order_route_order_idx").on(table.orderId),
	index("order_route_timestamp_idx").on(table.timestamp),
]);

export const orders = mysqlTable("orders", {
	id: int().autoincrement().primaryKey().notNull(),
	branchId: int().notNull(),
	customerId: int(),
	deliveryPersonId: int().notNull(),
	regionId: int().notNull(),
	provinceId: int().notNull(),
	price: int().notNull(),
	note: text(),
	locationLink: text(),
	address: text(),
	status: mysqlEnum(['pending_approval','pending','delivered','postponed','cancelled','returned']).default('pending_approval').notNull(),
	postponeReason: text(),
	returnReason: text(),
	deliveryImage: text(),
	deliveryNote: text(),
	deliveryLocationName: text(),
	acceptedAt: timestamp({ mode: 'string' }),
	deliveredAt: timestamp({ mode: 'string' }),
	deliveryDuration: int(),
	totalDuration: int(),
	isDeleted: tinyint().default(0).notNull(),
	deletedAt: timestamp({ mode: 'string' }),
	deletedBy: int(),
	hidePhoneFromDelivery: int().default(0),
	createdBy: int(),
	deliveryProfit: int(),
	deliveredByAdmin: int(),
	deliveredByAdminUsername: varchar({ length: 100 }),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("branch_idx").on(table.branchId),
	index("delivery_person_idx").on(table.deliveryPersonId),
	index("status_idx").on(table.status),
	index("created_at_idx").on(table.createdAt),
	index("is_deleted_idx").on(table.isDeleted),
]);

export const provinces = mysqlTable("provinces", {
	id: int().autoincrement().primaryKey().notNull(),
	branchId: int().notNull(),
	name: varchar({ length: 100 }).notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("branch_idx").on(table.branchId),
]);

export const pushSubscriptions = mysqlTable("push_subscriptions", {
	id: int().autoincrement().primaryKey().notNull(),
	branchId: int().notNull(),
	userId: int().notNull(),
	endpoint: text().notNull(),
	p256Dh: text().notNull(),
	auth: text().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
},
(table) => [
	index("branch_idx").on(table.branchId),
]);

export const regions = mysqlTable("regions", {
	id: int().autoincrement().primaryKey().notNull(),
	branchId: int().notNull(),
	name: varchar({ length: 100 }).notNull(),
	provinceId: int().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("branch_idx").on(table.branchId),
]);

export const settings = mysqlTable("settings", {
	id: int().autoincrement().primaryKey().notNull(),
	key: varchar({ length: 100 }).notNull(),
	value: text().notNull(),
	description: text(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("key_idx").on(table.key),
]);

export const maintenanceMode = mysqlTable("maintenance_mode", {
	id: int().autoincrement().primaryKey().notNull(),
	isEnabled: tinyint().default(0).notNull(),
	message: text(),
	estimatedEndTime: timestamp({ mode: 'string' }),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	updatedBy: int(),
});

export const users = mysqlTable("users", {
	id: int().autoincrement().primaryKey().notNull(),
	branchId: int(),
	openId: varchar({ length: 64 }),
	username: varchar({ length: 100 }),
	passwordHash: varchar({ length: 255 }),
	name: text(),
	email: varchar({ length: 320 }),
	loginMethod: varchar({ length: 64 }),
	role: mysqlEnum(['superadmin','super_admin','admin','branch_admin','branch_user','delivery']).default('delivery').notNull(),
	permissions: text(),
	profileImage: text(),
	phone: varchar({ length: 20 }),
	isActive: tinyint().default(1).notNull(),
	latitude: varchar({ length: 50 }),
	longitude: varchar({ length: 50 }),
	lastLocationUpdate: timestamp({ mode: 'string' }),
	traccarUsername: varchar({ length: 100 }),
	traccarPassword: varchar({ length: 255 }),
	fcmToken: text(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	lastSignedIn: timestamp({ mode: 'string' }).defaultNow().notNull(),
},
(table) => [
	index("branch_idx").on(table.branchId),
	index("openId").on(table.openId),
	index("username").on(table.username),
]);

// جدول كودات الاشتراك
export const subscriptionCodes = mysqlTable("subscription_codes", {
	id: int().autoincrement().primaryKey().notNull(),
	code: varchar({ length: 100 }).notNull(),
	durationType: mysqlEnum(['daily', 'weekly', 'monthly', 'yearly', 'custom']).notNull(),
	durationDays: int().notNull(), // عدد الأيام للاشتراك
	isUsed: tinyint().default(0).notNull(),
	usedBy: int(), // ID الصيدلية التي استخدمت الكود
	usedAt: timestamp({ mode: 'string' }),
	createdBy: int().notNull(), // ID المستخدم الذي أنشأ الكود (super_admin)
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp({ mode: 'string' }), // تاريخ انتهاء صلاحية الكود (اختياري)
},
(table) => [
	index("code_idx").on(table.code),
	index("is_used_idx").on(table.isUsed),
]);

// TypeScript types for inserts
export type InsertUser = typeof users.$inferInsert;
export type InsertRegion = typeof regions.$inferInsert;
export type InsertProvince = typeof provinces.$inferInsert;
export type InsertOrder = typeof orders.$inferInsert;
export type InsertDeliveryLocation = typeof deliveryLocations.$inferInsert;
export type InsertCustomer = typeof customers.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertActivityLog = typeof activityLogs.$inferInsert;
export type InsertOrderFormSetting = typeof orderFormSettings.$inferInsert;
export type InsertOrderRouteTracking = typeof orderRouteTracking.$inferInsert;
export type InsertSubscriptionCode = typeof subscriptionCodes.$inferInsert;
export type SubscriptionCode = typeof subscriptionCodes.$inferSelect;

// جدول منتجات المتجر
export const storeProducts = mysqlTable("store_products", {
	id: int().autoincrement().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	price: decimal({ precision: 10, scale: 2 }).notNull(),
	type: mysqlEnum(['product', 'subscription']).notNull(),
	durationMonths: int(), // للاشتراكات فقط
	isActive: tinyint().default(1).notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

// جدول مشتريات المتجر
export const storePurchases = mysqlTable("store_purchases", {
	id: int().autoincrement().primaryKey().notNull(),
	branchId: int().notNull(),
	productId: int().notNull(),
	activationCode: varchar({ length: 100 }).notNull(),
	price: decimal({ precision: 10, scale: 2 }).notNull(),
	isActivated: tinyint().default(0).notNull(),
	purchasedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	activatedAt: timestamp({ mode: 'string' }),
},
(table) => [
	index("branch_idx").on(table.branchId),
	index("product_idx").on(table.productId),
	index("activation_code_idx").on(table.activationCode),
]);

// جدول تفعيل الاشتراكات
export const subscriptionActivations = mysqlTable("subscription_activations", {
	id: int().autoincrement().primaryKey().notNull(),
	branchId: int().notNull(),
	productId: int().notNull(),
	purchaseId: int().notNull(),
	startDate: timestamp({ mode: 'string' }).notNull(),
	endDate: timestamp({ mode: 'string' }).notNull(),
	isActive: tinyint().default(1).notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
},
(table) => [
	index("branch_idx").on(table.branchId),
	index("product_idx").on(table.productId),
	index("end_date_idx").on(table.endDate),
]);



// جدول التحديثات
export const updates = mysqlTable("updates", {
	id: int().autoincrement().primaryKey().notNull(),
	title: varchar({ length: 255 }).notNull(),
	content: text().notNull(),
	type: varchar({ length: 50 }).notNull(), // 'update', 'article', 'news'
	imageUrl: text(),
	createdBy: int().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

// جدول الإعلانات
export const announcements = mysqlTable("announcements", {
	id: int().autoincrement().primaryKey().notNull(),
	title: varchar({ length: 255 }).notNull(),
	content: text().notNull(),
	type: varchar({ length: 50 }).notNull(), // 'info', 'warning', 'success'
	imageUrl: text(),
	isActive: tinyint().default(1).notNull(),
	createdBy: int().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

// جدول تتبع قراءة الإعلانات
export const announcementReads = mysqlTable("announcement_reads", {
	id: int().autoincrement().primaryKey().notNull(),
	announcementId: int().notNull(),
	userId: int().notNull(),
	readAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
},
(table) => [
	index("announcement_idx").on(table.announcementId),
]);

// جدول إعدادات الموقع
export const siteSettings = mysqlTable("site_settings", {
	id: int().autoincrement().primaryKey().notNull(),
	settingKey: varchar({ length: 100 }).notNull().unique(),
	settingValue: text().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

// جدول إعدادات الإشعارات
export const notificationSettings = mysqlTable("notification_settings", {
	id: int().autoincrement().primaryKey().notNull(),
	branchId: int().notNull(),
	oneSignalAppId: varchar({ length: 255 }),
	oneSignalRestApiKey: varchar({ length: 255 }),
	notifyOnNewOrder: tinyint().default(1).notNull(), // إشعار عند إنشاء طلب جديد
	notifyOnMessage: tinyint().default(1).notNull(), // إشعار عند إرسال رسالة
	isEnabled: tinyint().default(0).notNull(), // تفعيل/تعطيل الإشعارات للفرع
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("branch_id_idx").on(table.branchId),
]);

// جدول سجلات الإشعارات
export const notificationLogs = mysqlTable("notification_logs", {
	id: int().autoincrement().primaryKey().notNull(),
	branchId: int().notNull(),
	userId: int(), // معرف المستخدم (إذا كان لمستخدم محدد)
	title: varchar({ length: 255 }).notNull(),
	message: text().notNull(),
	recipientCount: int().default(0).notNull(), // عدد المستقبلين
	status: mysqlEnum(['success', 'failed']).notNull(),
	errorMessage: text(), // رسالة الخطأ (إذا فشل)
	oneSignalResponse: text(), // استجابة OneSignal
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
},
(table) => [
	index("branch_id_idx").on(table.branchId),
	index("user_id_idx").on(table.userId),
	index("status_idx").on(table.status),
	index("created_at_idx").on(table.createdAt),
]);

// TypeScript types
export type InsertStoreProduct = typeof storeProducts.$inferInsert;
export type StoreProduct = typeof storeProducts.$inferSelect;
export type InsertStorePurchase = typeof storePurchases.$inferInsert;
export type StorePurchase = typeof storePurchases.$inferSelect;
export type InsertSubscriptionActivation = typeof subscriptionActivations.$inferInsert;
export type SubscriptionActivation = typeof subscriptionActivations.$inferSelect;

export type InsertUpdate = typeof updates.$inferInsert;
export type Update = typeof updates.$inferSelect;
export type InsertAnnouncement = typeof announcements.$inferInsert;
export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncementRead = typeof announcementReads.$inferInsert;
export type AnnouncementRead = typeof announcementReads.$inferSelect;
export type InsertSiteSetting = typeof siteSettings.$inferInsert;
export type SiteSetting = typeof siteSettings.$inferSelect;
export type InsertNotificationSetting = typeof notificationSettings.$inferInsert;
export type NotificationSetting = typeof notificationSettings.$inferSelect;

