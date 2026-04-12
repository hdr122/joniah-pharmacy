CREATE TABLE `activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branchId` int NOT NULL,
	`userId` int NOT NULL,
	`activityType` enum('login','logout','page_view','order_create','order_update','order_delete','delivery_assign','status_change','settings_change','user_create','user_update','user_delete','customer_create','customer_update','customer_delete') NOT NULL,
	`description` text,
	`metadata` text,
	`ipAddress` varchar(50),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now())
);
--> statement-breakpoint
CREATE TABLE `announcement_reads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`announcementId` int NOT NULL,
	`userId` int NOT NULL,
	`readAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `announcement_reads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `announcements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`type` varchar(50) NOT NULL,
	`imageUrl` text,
	`isActive` tinyint NOT NULL DEFAULT 1,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `announcements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `branches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`code` varchar(50) NOT NULL,
	`address` text,
	`phone` varchar(20),
	`isActive` tinyint NOT NULL DEFAULT 1,
	`subscriptionStartDate` timestamp,
	`subscriptionEndDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branchId` int NOT NULL,
	`name` varchar(255),
	`phone` varchar(20),
	`email` varchar(320),
	`address1` text,
	`address2` text,
	`locationUrl1` text,
	`locationUrl2` text,
	`notes` text,
	`regionId` int,
	`lastDeliveryLocation` text,
	`lastDeliveryAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `dailyStats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branchId` int NOT NULL,
	`date` varchar(10) NOT NULL,
	`totalOrders` int NOT NULL DEFAULT 0,
	`deliveredOrders` int NOT NULL DEFAULT 0,
	`pendingOrders` int NOT NULL DEFAULT 0,
	`postponedOrders` int NOT NULL DEFAULT 0,
	`returnedOrders` int NOT NULL DEFAULT 0,
	`activeDeliveries` int NOT NULL DEFAULT 0,
	`totalRegions` int NOT NULL DEFAULT 0,
	`totalProfit` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now())
);
--> statement-breakpoint
CREATE TABLE `delivery_locations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branchId` int NOT NULL,
	`deliveryPersonId` int NOT NULL,
	`deviceId` varchar(100),
	`latitude` varchar(50) NOT NULL,
	`longitude` varchar(50) NOT NULL,
	`accuracy` varchar(50),
	`speed` varchar(20),
	`heading` varchar(20),
	`battery` varchar(10),
	`createdAt` timestamp NOT NULL DEFAULT (now())
);
--> statement-breakpoint
CREATE TABLE `maintenance_mode` (
	`id` int AUTO_INCREMENT NOT NULL,
	`isEnabled` tinyint NOT NULL DEFAULT 0,
	`message` text,
	`estimatedEndTime` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`updatedBy` int
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branchId` int NOT NULL,
	`senderId` int NOT NULL,
	`receiverId` int,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`type` enum('message','order_notification','system') NOT NULL DEFAULT 'message',
	`isRead` tinyint NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now())
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branchId` int NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`type` enum('order_assigned','order_accepted','order_rejected','order_delivered','order_postponed','order_returned','message','general') NOT NULL DEFAULT 'general',
	`orderId` int,
	`isRead` tinyint NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now())
);
--> statement-breakpoint
CREATE TABLE `order_form_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branchId` int NOT NULL,
	`fieldName` varchar(50) NOT NULL,
	`fieldLabel` varchar(100) NOT NULL,
	`isVisible` tinyint NOT NULL DEFAULT 1,
	`displayOrder` int NOT NULL DEFAULT 0,
	`isRequired` tinyint NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `order_locations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branchId` int NOT NULL,
	`orderId` int NOT NULL,
	`deliveryPersonId` int NOT NULL,
	`locationType` enum('accept','deliver') NOT NULL,
	`latitude` varchar(50) NOT NULL,
	`longitude` varchar(50) NOT NULL,
	`accuracy` varchar(50),
	`timestamp` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE TABLE `order_route_tracking` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branchId` int NOT NULL,
	`orderId` int NOT NULL,
	`deliveryPersonId` int NOT NULL,
	`latitude` varchar(50) NOT NULL,
	`longitude` varchar(50) NOT NULL,
	`accuracy` varchar(50),
	`speed` varchar(20),
	`heading` varchar(20),
	`deviationFromRoute` int,
	`isOffRoute` tinyint DEFAULT 0,
	`timestamp` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branchId` int NOT NULL,
	`customerId` int,
	`deliveryPersonId` int NOT NULL,
	`regionId` int NOT NULL,
	`provinceId` int NOT NULL,
	`price` int NOT NULL,
	`note` text,
	`locationLink` text,
	`address` text,
	`status` enum('pending_approval','pending','delivered','postponed','cancelled','returned') NOT NULL DEFAULT 'pending_approval',
	`postponeReason` text,
	`returnReason` text,
	`deliveryImage` text,
	`deliveryNote` text,
	`deliveryLocationName` text,
	`acceptedAt` timestamp,
	`deliveredAt` timestamp,
	`deliveryDuration` int,
	`totalDuration` int,
	`isDeleted` tinyint NOT NULL DEFAULT 0,
	`deletedAt` timestamp,
	`deletedBy` int,
	`hidePhoneFromDelivery` int DEFAULT 0,
	`createdBy` int,
	`deliveryProfit` int,
	`deliveredByAdmin` int,
	`deliveredByAdminUsername` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `provinces` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branchId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branchId` int NOT NULL,
	`userId` int NOT NULL,
	`endpoint` text NOT NULL,
	`p256Dh` text NOT NULL,
	`auth` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now())
);
--> statement-breakpoint
CREATE TABLE `regions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branchId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`provinceId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`value` text NOT NULL,
	`description` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `site_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settingKey` varchar(100) NOT NULL,
	`settingValue` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `site_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `site_settings_settingKey_unique` UNIQUE(`settingKey`)
);
--> statement-breakpoint
CREATE TABLE `store_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`price` decimal(10,2) NOT NULL,
	`type` enum('product','subscription') NOT NULL,
	`durationMonths` int,
	`isActive` tinyint NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `store_products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `store_purchases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branchId` int NOT NULL,
	`productId` int NOT NULL,
	`activationCode` varchar(100) NOT NULL,
	`price` decimal(10,2) NOT NULL,
	`isActivated` tinyint NOT NULL DEFAULT 0,
	`purchasedAt` timestamp NOT NULL DEFAULT (now()),
	`activatedAt` timestamp,
	CONSTRAINT `store_purchases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscription_activations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branchId` int NOT NULL,
	`productId` int NOT NULL,
	`purchaseId` int NOT NULL,
	`startDate` timestamp NOT NULL,
	`endDate` timestamp NOT NULL,
	`isActive` tinyint NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `subscription_activations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscription_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(100) NOT NULL,
	`durationType` enum('daily','weekly','monthly','yearly','custom') NOT NULL,
	`durationDays` int NOT NULL,
	`isUsed` tinyint NOT NULL DEFAULT 0,
	`usedBy` int,
	`usedAt` timestamp,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp
);
--> statement-breakpoint
CREATE TABLE `updates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`type` varchar(50) NOT NULL,
	`imageUrl` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `updates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branchId` int,
	`openId` varchar(64),
	`username` varchar(100),
	`passwordHash` varchar(255),
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('superadmin','super_admin','admin','branch_admin','branch_user','delivery') NOT NULL DEFAULT 'delivery',
	`permissions` text,
	`profileImage` text,
	`phone` varchar(20),
	`isActive` tinyint NOT NULL DEFAULT 1,
	`latitude` varchar(50),
	`longitude` varchar(50),
	`lastLocationUpdate` timestamp,
	`traccarUsername` varchar(100),
	`traccarPassword` varchar(255),
	`fcmToken` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE INDEX `announcement_idx` ON `announcement_reads` (`announcementId`);--> statement-breakpoint
CREATE INDEX `code_idx` ON `branches` (`code`);--> statement-breakpoint
CREATE INDEX `branch_idx` ON `customers` (`branchId`);--> statement-breakpoint
CREATE INDEX `date` ON `dailyStats` (`date`);--> statement-breakpoint
CREATE INDEX `branch_idx` ON `dailyStats` (`branchId`);--> statement-breakpoint
CREATE INDEX `fieldName` ON `order_form_settings` (`fieldName`);--> statement-breakpoint
CREATE INDEX `order_route_order_idx` ON `order_route_tracking` (`orderId`);--> statement-breakpoint
CREATE INDEX `order_route_timestamp_idx` ON `order_route_tracking` (`timestamp`);--> statement-breakpoint
CREATE INDEX `branch_idx` ON `orders` (`branchId`);--> statement-breakpoint
CREATE INDEX `delivery_person_idx` ON `orders` (`deliveryPersonId`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `orders` (`status`);--> statement-breakpoint
CREATE INDEX `created_at_idx` ON `orders` (`createdAt`);--> statement-breakpoint
CREATE INDEX `is_deleted_idx` ON `orders` (`isDeleted`);--> statement-breakpoint
CREATE INDEX `branch_idx` ON `provinces` (`branchId`);--> statement-breakpoint
CREATE INDEX `branch_idx` ON `push_subscriptions` (`branchId`);--> statement-breakpoint
CREATE INDEX `branch_idx` ON `regions` (`branchId`);--> statement-breakpoint
CREATE INDEX `key_idx` ON `settings` (`key`);--> statement-breakpoint
CREATE INDEX `branch_idx` ON `store_purchases` (`branchId`);--> statement-breakpoint
CREATE INDEX `product_idx` ON `store_purchases` (`productId`);--> statement-breakpoint
CREATE INDEX `activation_code_idx` ON `store_purchases` (`activationCode`);--> statement-breakpoint
CREATE INDEX `branch_idx` ON `subscription_activations` (`branchId`);--> statement-breakpoint
CREATE INDEX `product_idx` ON `subscription_activations` (`productId`);--> statement-breakpoint
CREATE INDEX `end_date_idx` ON `subscription_activations` (`endDate`);--> statement-breakpoint
CREATE INDEX `code_idx` ON `subscription_codes` (`code`);--> statement-breakpoint
CREATE INDEX `is_used_idx` ON `subscription_codes` (`isUsed`);--> statement-breakpoint
CREATE INDEX `branch_idx` ON `users` (`branchId`);--> statement-breakpoint
CREATE INDEX `openId` ON `users` (`openId`);--> statement-breakpoint
CREATE INDEX `username` ON `users` (`username`);