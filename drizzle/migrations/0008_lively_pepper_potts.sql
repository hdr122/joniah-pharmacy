CREATE TABLE `activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`activityType` enum('login','logout','page_view','order_create','order_update','order_delete','delivery_assign','status_change','settings_change','user_create','user_update','user_delete','customer_create','customer_update','customer_delete') NOT NULL,
	`description` text,
	`metadata` text,
	`ipAddress` varchar(50),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `branches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`code` varchar(50) NOT NULL,
	`address` text,
	`phone` varchar(20),
	`isActive` tinyint NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `branches_id` PRIMARY KEY(`id`)
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
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dailyStats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` varchar(10) NOT NULL,
	`totalOrders` int NOT NULL DEFAULT 0,
	`deliveredOrders` int NOT NULL DEFAULT 0,
	`pendingOrders` int NOT NULL DEFAULT 0,
	`postponedOrders` int NOT NULL DEFAULT 0,
	`returnedOrders` int NOT NULL DEFAULT 0,
	`activeDeliveries` int NOT NULL DEFAULT 0,
	`totalRegions` int NOT NULL DEFAULT 0,
	`totalProfit` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dailyStats_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `delivery_locations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deliveryPersonId` int NOT NULL,
	`deviceId` varchar(100),
	`latitude` varchar(50) NOT NULL,
	`longitude` varchar(50) NOT NULL,
	`accuracy` varchar(50),
	`speed` varchar(20),
	`heading` varchar(20),
	`battery` varchar(10),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `delivery_locations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`senderId` int NOT NULL,
	`receiverId` int,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`type` enum('message','order_notification','system') NOT NULL DEFAULT 'message',
	`isRead` tinyint NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`type` enum('order_assigned','order_accepted','order_rejected','order_delivered','order_postponed','order_returned','message','general') NOT NULL DEFAULT 'general',
	`orderId` int,
	`isRead` tinyint NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_form_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fieldName` varchar(50) NOT NULL,
	`fieldLabel` varchar(100) NOT NULL,
	`isVisible` tinyint NOT NULL DEFAULT 1,
	`displayOrder` int NOT NULL DEFAULT 0,
	`isRequired` tinyint NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `order_form_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_locations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`deliveryPersonId` int NOT NULL,
	`locationType` enum('accept','deliver') NOT NULL,
	`latitude` varchar(50) NOT NULL,
	`longitude` varchar(50) NOT NULL,
	`accuracy` varchar(50),
	`timestamp` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	CONSTRAINT `order_locations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_route_tracking` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`deliveryPersonId` int NOT NULL,
	`latitude` varchar(50) NOT NULL,
	`longitude` varchar(50) NOT NULL,
	`accuracy` varchar(50),
	`speed` varchar(20),
	`heading` varchar(20),
	`deviationFromRoute` int,
	`isOffRoute` tinyint DEFAULT 0,
	`timestamp` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	CONSTRAINT `order_route_tracking_id` PRIMARY KEY(`id`)
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
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `provinces` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `provinces_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`endpoint` text NOT NULL,
	`p256Dh` text NOT NULL,
	`auth` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `push_subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `regions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branchId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`provinceId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `regions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`value` text NOT NULL,
	`description` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` DROP INDEX `users_openId_unique`;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `openId` varchar(64);--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('superadmin','admin','branch_admin','branch_user','delivery') NOT NULL DEFAULT 'branch_user';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `lastSignedIn` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `users` ADD `branchId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `username` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `permissions` text;--> statement-breakpoint
ALTER TABLE `users` ADD `profileImage` text;--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` tinyint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `latitude` varchar(50);--> statement-breakpoint
ALTER TABLE `users` ADD `longitude` varchar(50);--> statement-breakpoint
ALTER TABLE `users` ADD `lastLocationUpdate` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `traccarUsername` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `traccarPassword` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `fcmToken` text;--> statement-breakpoint
CREATE INDEX `code_idx` ON `branches` (`code`);--> statement-breakpoint
CREATE INDEX `branch_idx` ON `customers` (`branchId`);--> statement-breakpoint
CREATE INDEX `date` ON `dailyStats` (`date`);--> statement-breakpoint
CREATE INDEX `fieldName` ON `order_form_settings` (`fieldName`);--> statement-breakpoint
CREATE INDEX `order_route_order_idx` ON `order_route_tracking` (`orderId`);--> statement-breakpoint
CREATE INDEX `order_route_timestamp_idx` ON `order_route_tracking` (`timestamp`);--> statement-breakpoint
CREATE INDEX `branch_idx` ON `orders` (`branchId`);--> statement-breakpoint
CREATE INDEX `delivery_person_idx` ON `orders` (`deliveryPersonId`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `orders` (`status`);--> statement-breakpoint
CREATE INDEX `created_at_idx` ON `orders` (`createdAt`);--> statement-breakpoint
CREATE INDEX `is_deleted_idx` ON `orders` (`isDeleted`);--> statement-breakpoint
CREATE INDEX `branch_idx` ON `regions` (`branchId`);--> statement-breakpoint
CREATE INDEX `key_idx` ON `settings` (`key`);--> statement-breakpoint
CREATE INDEX `branch_idx` ON `users` (`branchId`);--> statement-breakpoint
CREATE INDEX `openId` ON `users` (`openId`);--> statement-breakpoint
CREATE INDEX `username` ON `users` (`username`);