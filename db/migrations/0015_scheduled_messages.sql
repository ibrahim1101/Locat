CREATE TABLE `scheduled_messages` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`sender_id` bigint unsigned NOT NULL,
	`conversation_id` bigint unsigned NOT NULL,
	`client_message_id` varchar(36) NOT NULL,
	`envelope` mediumtext,
	`envelope_hash` varchar(64) NOT NULL,
	`group_epoch` int,
	`deliver_at` timestamp NOT NULL,
	`state` enum('pending','delivered','cancelled','failed') NOT NULL DEFAULT 'pending',
	`message_id` bigint unsigned,
	`failure_code` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scheduled_messages_id` PRIMARY KEY(`id`),
	CONSTRAINT `scheduled_sender_client_unique` UNIQUE(`sender_id`,`client_message_id`)
);
--> statement-breakpoint
ALTER TABLE `scheduled_messages` ADD CONSTRAINT `scheduled_messages_sender_id_users_id_fk` FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `scheduled_messages` ADD CONSTRAINT `scheduled_messages_conversation_id_conversations_id_fk` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `scheduled_due_idx` ON `scheduled_messages` (`state`,`deliver_at`);
--> statement-breakpoint
CREATE INDEX `scheduled_sender_idx` ON `scheduled_messages` (`sender_id`,`state`);
