ALTER TABLE `regions` ADD `branchId` int NOT NULL;--> statement-breakpoint
CREATE INDEX `branch_idx` ON `regions` (`branchId`);