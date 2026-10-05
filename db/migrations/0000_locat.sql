CREATE TABLE `conversation_members` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`conversation_id` bigint unsigned NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`wrapped_key` text,
	`wrapped_by` bigint unsigned,
	`joined_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `conversation_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `conv_member_unique` UNIQUE(`conversation_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`type` enum('direct','group') NOT NULL,
	`name` varchar(128),
	`created_by` bigint unsigned NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `message_deliveries` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`message_id` bigint unsigned NOT NULL,
	`recipient_id` bigint unsigned NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `message_deliveries_id` PRIMARY KEY(`id`),
	CONSTRAINT `delivery_unique` UNIQUE(`message_id`,`recipient_id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`conversation_id` bigint unsigned NOT NULL,
	`sender_id` bigint unsigned NOT NULL,
	`envelope` mediumtext NOT NULL,
	`client_message_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`),
	CONSTRAINT `messages_sender_client_unique` UNIQUE(`sender_id`,`client_message_id`)
);
--> statement-breakpoint
CREATE TABLE `send_receipts` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`sender_id` bigint unsigned NOT NULL,
	`client_message_id` varchar(36) NOT NULL,
	`message_id` bigint unsigned NOT NULL,
	`conversation_id` bigint unsigned NOT NULL,
	`envelope_hash` varchar(64) NOT NULL,
	`created_at` timestamp NOT NULL,
	CONSTRAINT `send_receipts_id` PRIMARY KEY(`id`),
	CONSTRAINT `receipt_sender_client_unique` UNIQUE(`sender_id`,`client_message_id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`token` varchar(128) NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`expires_at` timestamp NOT NULL,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `sessions_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`username` varchar(64) NOT NULL,
	`display_name` varchar(128) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`public_key` text NOT NULL,
	`encrypted_private_key` text NOT NULL,
	`key_salt` varchar(64) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
ALTER TABLE `conversation_members` ADD CONSTRAINT `conversation_members_conversation_id_conversations_id_fk` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversation_members` ADD CONSTRAINT `conversation_members_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `message_deliveries` ADD CONSTRAINT `message_deliveries_message_id_messages_id_fk` FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `message_deliveries` ADD CONSTRAINT `message_deliveries_recipient_id_users_id_fk` FOREIGN KEY (`recipient_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `messages_conversation_id_conversations_id_fk` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `messages_sender_id_users_id_fk` FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `send_receipts` ADD CONSTRAINT `send_receipts_sender_id_users_id_fk` FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `member_user_idx` ON `conversation_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `delivery_recipient_idx` ON `message_deliveries` (`recipient_id`);--> statement-breakpoint
CREATE INDEX `messages_conv_idx` ON `messages` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `receipt_created_idx` ON `send_receipts` (`created_at`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);