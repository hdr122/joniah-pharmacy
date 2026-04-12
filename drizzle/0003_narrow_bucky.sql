CREATE TABLE `notification_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branchId` int NOT NULL,
	`userId` int,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`recipientCount` int NOT NULL DEFAULT 0,
	`status` enum('success','failed') NOT NULL,
	`errorMessage` text,
	`oneSignalResponse` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notification_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `branch_id_idx` ON `notification_logs` (`branchId`);--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `notification_logs` (`userId`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `notification_logs` (`status`);--> statement-breakpoint
CREATE INDEX `created_at_idx` ON `notification_logs` (`createdAt`);