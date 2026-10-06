ALTER TABLE `users` ADD `lc_code` varchar(16);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_lc_code_unique` UNIQUE(`lc_code`);