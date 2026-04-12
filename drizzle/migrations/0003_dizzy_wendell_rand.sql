ALTER TABLE `activity_logs` ADD PRIMARY KEY(`id`);--> statement-breakpoint
ALTER TABLE `branches` ADD PRIMARY KEY(`id`);--> statement-breakpoint
ALTER TABLE `customers` ADD PRIMARY KEY(`id`);--> statement-breakpoint
ALTER TABLE `dailyStats` ADD PRIMARY KEY(`id`);--> statement-breakpoint
ALTER TABLE `delivery_locations` ADD PRIMARY KEY(`id`);--> statement-breakpoint
ALTER TABLE `messages` ADD PRIMARY KEY(`id`);--> statement-breakpoint
ALTER TABLE `notifications` ADD PRIMARY KEY(`id`);--> statement-breakpoint
ALTER TABLE `order_form_settings` ADD PRIMARY KEY(`id`);--> statement-breakpoint
ALTER TABLE `order_locations` ADD PRIMARY KEY(`id`);--> statement-breakpoint
ALTER TABLE `order_route_tracking` ADD PRIMARY KEY(`id`);--> statement-breakpoint
ALTER TABLE `orders` ADD PRIMARY KEY(`id`);--> statement-breakpoint
ALTER TABLE `provinces` ADD PRIMARY KEY(`id`);--> statement-breakpoint
ALTER TABLE `push_subscriptions` ADD PRIMARY KEY(`id`);--> statement-breakpoint
ALTER TABLE `regions` ADD PRIMARY KEY(`id`);--> statement-breakpoint
ALTER TABLE `settings` ADD PRIMARY KEY(`id`);--> statement-breakpoint
ALTER TABLE `users` ADD PRIMARY KEY(`id`);