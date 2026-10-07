CREATE TABLE `contact_relationships` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_low_id` bigint unsigned NOT NULL,
	`user_high_id` bigint unsigned NOT NULL,
	`requested_by_id` bigint unsigned NOT NULL,
	`status` enum('pending','accepted') NOT NULL DEFAULT 'pending',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contact_relationships_id` PRIMARY KEY(`id`),
	CONSTRAINT `contact_relationships_pair_unique` UNIQUE(`user_low_id`,`user_high_id`)
);
--> statement-breakpoint
ALTER TABLE `contact_relationships` ADD CONSTRAINT `contact_relationships_user_low_id_users_id_fk` FOREIGN KEY (`user_low_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contact_relationships` ADD CONSTRAINT `contact_relationships_user_high_id_users_id_fk` FOREIGN KEY (`user_high_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contact_relationships` ADD CONSTRAINT `contact_relationships_requested_by_id_users_id_fk` FOREIGN KEY (`requested_by_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `contact_relationships_high_idx` ON `contact_relationships` (`user_high_id`);--> statement-breakpoint
CREATE INDEX `contact_relationships_requester_idx` ON `contact_relationships` (`requested_by_id`);