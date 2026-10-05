CREATE TABLE `group_keys` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`conversation_id` bigint unsigned NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`epoch` int NOT NULL,
	`wrapped_key` text NOT NULL,
	`wrapper_public_key` text NOT NULL,
	CONSTRAINT `group_keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `group_key_user_epoch_unique` UNIQUE(`conversation_id`,`user_id`,`epoch`)
);
--> statement-breakpoint
ALTER TABLE `conversations` ADD `group_epoch` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `conversations` ADD `rotation_required` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `group_keys` ADD CONSTRAINT `group_keys_conversation_id_conversations_id_fk` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `group_keys` ADD CONSTRAINT `group_keys_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;