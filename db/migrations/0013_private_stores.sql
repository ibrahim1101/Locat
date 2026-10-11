-- Additive reconciliation of tables historically created only by db:setup,
-- plus encrypted private stores. Existing tables/data are preserved.
CREATE TABLE IF NOT EXISTS `device_link_requests` (
	`id` varchar(128) NOT NULL,
	`code_hash` varchar(64) NOT NULL,
	`requester_public_key` text NOT NULL,
	`approver_public_key` text,
	`approved_by` bigint unsigned,
	`encrypted_identity` text,
	`state` enum('pending','approved','consumed','rejected') NOT NULL DEFAULT 'pending',
	`attempts` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`expires_at` timestamp NOT NULL,
	CONSTRAINT `device_link_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `device_link_requests_approved_by_users_id_fk` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action,
	KEY `device_link_requests_expires_idx` (`expires_at`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `integration_tokens` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`name` varchar(80) NOT NULL,
	`source` varchar(64) NOT NULL DEFAULT 'custom',
	`scope` varchar(255) NOT NULL DEFAULT 'incidents:write',
	`token_hash` varchar(64) NOT NULL,
	`token_prefix` varchar(16) NOT NULL,
	`last_used_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`revoked_at` timestamp,
	CONSTRAINT `integration_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `integration_tokens_token_hash_unique` UNIQUE(`token_hash`),
	CONSTRAINT `integration_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action,
	KEY `integration_tokens_user_idx` (`user_id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `link_devices` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`name` varchar(80) NOT NULL,
	`platform` varchar(32) NOT NULL DEFAULT 'web',
	`public_key` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`last_seen_at` timestamp NOT NULL DEFAULT (now()),
	`revoked_at` timestamp,
	CONSTRAINT `link_devices_id` PRIMARY KEY(`id`),
	CONSTRAINT `link_devices_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action,
	KEY `link_devices_user_idx` (`user_id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `private_objects` (
	`id` varchar(36) NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`module` enum('vault','secrets') NOT NULL,
	`revision` int unsigned NOT NULL DEFAULT 1,
	`envelope` mediumtext NOT NULL,
	`bytes` int unsigned NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `private_object_owner_module_id_unique` UNIQUE(`user_id`,`module`,`id`),
	CONSTRAINT `private_objects_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `private_stores` (
	`user_id` bigint unsigned NOT NULL,
	`module` enum('vault','secrets') NOT NULL,
	`config` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `private_store_owner_module_unique` UNIQUE(`user_id`,`module`),
	CONSTRAINT `private_stores_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `recovery_credentials` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`verifier` varchar(64) NOT NULL,
	`encrypted_identity` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`revoked_at` timestamp,
	CONSTRAINT `recovery_credentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `recovery_credentials_verifier_unique` UNIQUE(`verifier`),
	CONSTRAINT `recovery_credentials_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action,
	KEY `recovery_credentials_user_idx` (`user_id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `incidents` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`token_id` bigint unsigned,
	`source` varchar(64) NOT NULL DEFAULT 'custom',
	`severity` enum('info','low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`status` enum('open','acknowledged','resolved') NOT NULL DEFAULT 'open',
	`title` varchar(200) NOT NULL,
	`description` text,
	`fingerprint` varchar(128),
	`external_id` varchar(128),
	`acknowledged_by` bigint unsigned,
	`acknowledged_at` timestamp,
	`resolved_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `incidents_id` PRIMARY KEY(`id`),
	CONSTRAINT `incidents_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action,
	CONSTRAINT `incidents_token_id_integration_tokens_id_fk` FOREIGN KEY (`token_id`) REFERENCES `integration_tokens`(`id`) ON DELETE set null ON UPDATE no action,
	KEY `incidents_user_idx` (`user_id`),
	KEY `incidents_user_status_idx` (`user_id`,`status`),
	KEY `incidents_fingerprint_idx` (`user_id`,`fingerprint`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `link_messages` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`from_device` bigint unsigned NOT NULL,
	`to_device` bigint unsigned NOT NULL,
	`kind` enum('clipboard','text','url') NOT NULL DEFAULT 'clipboard',
	`iv` varchar(32) NOT NULL,
	`data` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`delivered_at` timestamp,
	CONSTRAINT `link_messages_id` PRIMARY KEY(`id`),
	CONSTRAINT `link_messages_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action,
	CONSTRAINT `link_messages_from_device_link_devices_id_fk` FOREIGN KEY (`from_device`) REFERENCES `link_devices`(`id`) ON DELETE cascade ON UPDATE no action,
	CONSTRAINT `link_messages_to_device_link_devices_id_fk` FOREIGN KEY (`to_device`) REFERENCES `link_devices`(`id`) ON DELETE cascade ON UPDATE no action,
	KEY `link_messages_to_idx` (`to_device`,`delivered_at`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `link_pairings` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`device_a` bigint unsigned NOT NULL,
	`device_b` bigint unsigned NOT NULL,
	`confirmed_a` boolean NOT NULL DEFAULT false,
	`confirmed_b` boolean NOT NULL DEFAULT false,
	`status` enum('pending','verified','rejected') NOT NULL DEFAULT 'pending',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `link_pairings_id` PRIMARY KEY(`id`),
	CONSTRAINT `link_pairings_pair_unique` UNIQUE(`device_a`,`device_b`),
	CONSTRAINT `link_pairings_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action,
	CONSTRAINT `link_pairings_device_a_link_devices_id_fk` FOREIGN KEY (`device_a`) REFERENCES `link_devices`(`id`) ON DELETE cascade ON UPDATE no action,
	CONSTRAINT `link_pairings_device_b_link_devices_id_fk` FOREIGN KEY (`device_b`) REFERENCES `link_devices`(`id`) ON DELETE cascade ON UPDATE no action,
	KEY `link_pairings_user_idx` (`user_id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `link_transfers` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`from_device` bigint unsigned NOT NULL,
	`to_device` bigint unsigned NOT NULL,
	`filename` varchar(255) NOT NULL,
	`mime` varchar(128) NOT NULL DEFAULT 'application/octet-stream',
	`size` bigint unsigned NOT NULL,
	`chunk_count` int NOT NULL,
	`status` enum('pending','active','complete','cancelled','failed') NOT NULL DEFAULT 'pending',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `link_transfers_id` PRIMARY KEY(`id`),
	CONSTRAINT `link_transfers_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action,
	CONSTRAINT `link_transfers_from_device_link_devices_id_fk` FOREIGN KEY (`from_device`) REFERENCES `link_devices`(`id`) ON DELETE cascade ON UPDATE no action,
	CONSTRAINT `link_transfers_to_device_link_devices_id_fk` FOREIGN KEY (`to_device`) REFERENCES `link_devices`(`id`) ON DELETE cascade ON UPDATE no action,
	KEY `link_transfers_user_idx` (`user_id`),
	KEY `link_transfers_to_idx` (`to_device`,`status`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `incident_events` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`incident_id` bigint unsigned NOT NULL,
	`action` enum('created','updated','acknowledged','resolved','reopened','note') NOT NULL,
	`actor_id` bigint unsigned,
	`detail` varchar(500),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `incident_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `incident_events_incident_id_incidents_id_fk` FOREIGN KEY (`incident_id`) REFERENCES `incidents`(`id`) ON DELETE cascade ON UPDATE no action,
	KEY `incident_events_incident_idx` (`incident_id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `link_transfer_chunks` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`transfer_id` bigint unsigned NOT NULL,
	`seq` int NOT NULL,
	`iv` varchar(32) NOT NULL,
	`data` mediumtext NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `link_transfer_chunks_id` PRIMARY KEY(`id`),
	CONSTRAINT `link_chunk_unique` UNIQUE(`transfer_id`,`seq`),
	CONSTRAINT `link_transfer_chunks_transfer_id_link_transfers_id_fk` FOREIGN KEY (`transfer_id`) REFERENCES `link_transfers`(`id`) ON DELETE cascade ON UPDATE no action
);
