CREATE TABLE `notification_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branchId` int NOT NULL,
	`oneSignalAppId` varchar(255),
	`oneSignalRestApiKey` varchar(255),
	`notifyOnNewOrder` tinyint NOT NULL DEFAULT 1,
	`notifyOnMessage` tinyint NOT NULL DEFAULT 1,
	`isEnabled` tinyint NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notification_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `branch_id_idx` ON `notification_settings` (`branchId`);