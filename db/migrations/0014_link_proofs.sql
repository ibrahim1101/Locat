-- Preserve historical records; version zero requires both devices to re-confirm.
ALTER TABLE `link_pairings` ADD COLUMN `proof_version` INT NOT NULL DEFAULT 0;
