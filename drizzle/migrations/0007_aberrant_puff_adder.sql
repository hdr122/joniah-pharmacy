DROP TABLE `activity_logs`;--> statement-breakpoint
DROP TABLE `branches`;--> statement-breakpoint
DROP TABLE `customers`;--> statement-breakpoint
DROP TABLE `dailyStats`;--> statement-breakpoint
DROP TABLE `delivery_locations`;--> statement-breakpoint
DROP TABLE `messages`;--> statement-breakpoint
DROP TABLE `notifications`;--> statement-breakpoint
DROP TABLE `order_form_settings`;--> statement-breakpoint
DROP TABLE `order_locations`;--> statement-breakpoint
DROP TABLE `order_route_tracking`;--> statement-breakpoint
DROP TABLE `orders`;--> statement-breakpoint
DROP TABLE `provinces`;--> statement-breakpoint
DROP TABLE `push_subscriptions`;--> statement-breakpoint
DROP TABLE `regions`;--> statement-breakpoint
DROP TABLE `settings`;--> statement-breakpoint
DROP INDEX `branch_idx` ON `users`;--> statement-breakpoint
DROP INDEX `openId` ON `users`;--> statement-breakpoint
DROP INDEX `username` ON `users`;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `openId` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `lastSignedIn` timestamp NOT NULL DEFAULT (now());--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_openId_unique` UNIQUE(`openId`);--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `branchId`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `username`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `passwordHash`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `permissions`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `profileImage`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `phone`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `isActive`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `latitude`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `longitude`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `lastLocationUpdate`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `traccarUsername`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `traccarPassword`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `fcmToken`;