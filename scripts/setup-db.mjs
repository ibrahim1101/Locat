import { randomInt } from "node:crypto";
import "dotenv/config";
import mysql from "mysql2/promise";
import { readFile } from "node:fs/promises";

// Additive schema bootstrap supports both fresh installations and the original
// Locat schema created by db:push. It never drops, truncates, or renames tables.
if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL in .env first.");
const connection = await mysql.createConnection(process.env.DATABASE_URL);
let locked = false;
try {
  const [[lock]] = await connection.query("SELECT GET_LOCK('locat_schema_setup', 30) AS acquired");
  if (Number(lock.acquired) !== 1) throw new Error("Another Locat database setup is running. Try again shortly.");
  locked = true;
  const sql = await readFile(new URL("../db/migrations/0000_locat.sql", import.meta.url), "utf8");
  const statements = sql.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
  for (const statement of statements.filter((s) => s.startsWith("CREATE TABLE"))) {
    await connection.query(statement.replace("CREATE TABLE", "CREATE TABLE IF NOT EXISTS"));
  }
  const [[lcColumn]] = await connection.query("SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'lc_code'");
  if (Number(lcColumn.n) === 0) await connection.query("ALTER TABLE users ADD COLUMN lc_code VARCHAR(16) NULL");
  const [[lcIndex]] = await connection.query("SELECT COUNT(*) AS n FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'users_lc_code_unique'");
  if (Number(lcIndex.n) === 0) await connection.query("CREATE UNIQUE INDEX users_lc_code_unique ON users(lc_code)");
  const [accounts] = await connection.query("SELECT id,lc_code FROM users");
  if (accounts.length > 9000) throw new Error("Four-digit LC numbers support at most 9000 accounts.");
  const usedCodes = new Set(accounts.map(row => row.lc_code).filter(code => /^[1-9][0-9]{3}$/.test(code ?? "")));
  for (const row of accounts.filter(row => !/^[1-9][0-9]{3}$/.test(row.lc_code ?? ""))) {
    const start = randomInt(0, 9000);
    let assigned = false;
    for (let attempt = 0; attempt < 9000; attempt++) {
      const code = String(1000 + (start + attempt) % 9000);
      if (usedCodes.has(code)) continue;
      try {
        await connection.query("UPDATE users SET lc_code=? WHERE id=?", [code, row.id]);
        usedCodes.add(code); assigned = true; break;
      } catch (error) { if (error.code !== "ER_DUP_ENTRY") throw error; }
    }
    if (!assigned) throw new Error("No free four-digit LC numbers remain.");
  }
  const [[bioColumn]] = await connection.query("SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'bio'");
  if (Number(bioColumn.n) === 0) await connection.query("ALTER TABLE users ADD COLUMN bio VARCHAR(280) NULL");
  const [[avatarColumn]] = await connection.query("SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatar'");
  if (Number(avatarColumn.n) === 0) await connection.query("ALTER TABLE users ADD COLUMN avatar TEXT NULL");
  const [[downloadColumn]] = await connection.query("SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'allow_avatar_download'");
  if (Number(downloadColumn.n) === 0) await connection.query("ALTER TABLE users ADD COLUMN allow_avatar_download BOOLEAN NOT NULL DEFAULT FALSE");
  const [[usernameVisibilityColumn]] = await connection.query("SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'username_visibility'");
  if (Number(usernameVisibilityColumn.n) === 0) await connection.query("ALTER TABLE users ADD COLUMN username_visibility ENUM('everyone','contacts','nobody') NOT NULL DEFAULT 'everyone'");
  for (const [name, defaultValue] of [["profile_visibility", "everyone"], ["presence_visibility", "contacts"]]) {
    const [[privacyColumn]] = await connection.query("SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = ?", [name]);
    if (Number(privacyColumn.n) === 0) await connection.query(`ALTER TABLE users ADD COLUMN ${name} ENUM('everyone','contacts','nobody') NOT NULL DEFAULT '${defaultValue}'`);
  }
  const [[column]] = await connection.query(
    "SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'messages' AND COLUMN_NAME = 'client_message_id'",
  );
  if (Number(column.n) === 0) await connection.query("ALTER TABLE messages ADD COLUMN client_message_id VARCHAR(36) NULL");
  const [[retryIndex]] = await connection.query(
    "SELECT COUNT(*) AS n FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'messages' AND INDEX_NAME = 'messages_sender_client_unique'",
  );
  if (Number(retryIndex.n) === 0) await connection.query("CREATE UNIQUE INDEX messages_sender_client_unique ON messages(sender_id, client_message_id)");
  for (const statement of statements.filter((s) => !s.startsWith("CREATE TABLE"))) {
    const constraint = statement.match(/^ALTER TABLE `([^`]+)` ADD CONSTRAINT `([^`]+)`/);
    const index = statement.match(/^CREATE INDEX `([^`]+)` ON `([^`]+)`/);
    let rows;
    if (constraint) {
      [rows] = await connection.query("SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?", [constraint[1], constraint[2]]);
    } else if (index) {
      [rows] = await connection.query("SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?", [index[2], index[1]]);
    } else { throw new Error("Unrecognized bootstrap statement; review the schema upgrade."); }
    if (rows.length === 0) await connection.query(statement);
  }
  const [[disabledColumn]] = await connection.query("SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'disabled'");
  if (Number(disabledColumn.n) === 0) await connection.query("ALTER TABLE users ADD COLUMN disabled BOOLEAN NOT NULL DEFAULT FALSE");
  const [[adminColumn]] = await connection.query("SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'is_admin'");
  if (Number(adminColumn.n) === 0) await connection.query("ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE");
  await connection.query("CREATE TABLE IF NOT EXISTS admin_audit (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, actor_id BIGINT UNSIGNED NOT NULL, action VARCHAR(64) NOT NULL, target_id BIGINT UNSIGNED NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  await connection.query("CREATE TABLE IF NOT EXISTS push_subscriptions (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, session_token VARCHAR(128) NOT NULL, endpoint_hash VARCHAR(64) NOT NULL UNIQUE, endpoint TEXT NOT NULL, p256dh VARCHAR(128) NOT NULL, auth VARCHAR(64) NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT push_subscriptions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)");
  const [[contactTable]] = await connection.query("SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contact_relationships'");
  for (const [name, definition] of [["group_epoch", "INT NOT NULL DEFAULT 1"], ["rotation_required", "BOOLEAN NOT NULL DEFAULT FALSE"]]) {
    const [[column]] = await connection.query("SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'conversations' AND COLUMN_NAME = ?", [name]);
    if (Number(column.n) === 0) await connection.query(`ALTER TABLE conversations ADD COLUMN ${name} ${definition}`);
  }
  await connection.query("CREATE TABLE IF NOT EXISTS group_keys (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, conversation_id BIGINT UNSIGNED NOT NULL, user_id BIGINT UNSIGNED NOT NULL, epoch INT NOT NULL, wrapped_key TEXT NOT NULL, wrapper_public_key TEXT NOT NULL, UNIQUE KEY group_key_user_epoch_unique (conversation_id,user_id,epoch), CONSTRAINT group_keys_conversation_id_conversations_id_fk FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE, CONSTRAINT group_keys_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)");
  await connection.query("CREATE TABLE IF NOT EXISTS user_blocks (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, blocker_id BIGINT UNSIGNED NOT NULL, blocked_id BIGINT UNSIGNED NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY user_blocks_pair_unique (blocker_id,blocked_id), KEY user_blocks_blocked_idx (blocked_id), CONSTRAINT user_blocks_blocker_id_users_id_fk FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE, CONSTRAINT user_blocks_blocked_id_users_id_fk FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE)");
  await connection.query("CREATE TABLE IF NOT EXISTS contact_relationships (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_low_id BIGINT UNSIGNED NOT NULL, user_high_id BIGINT UNSIGNED NOT NULL, requested_by_id BIGINT UNSIGNED NOT NULL, status ENUM('pending','accepted') NOT NULL DEFAULT 'pending', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY contact_relationships_pair_unique (user_low_id,user_high_id), KEY contact_relationships_high_idx (user_high_id), KEY contact_relationships_requester_idx (requested_by_id), CONSTRAINT contact_relationships_low_users_id_fk FOREIGN KEY (user_low_id) REFERENCES users(id) ON DELETE CASCADE, CONSTRAINT contact_relationships_high_users_id_fk FOREIGN KEY (user_high_id) REFERENCES users(id) ON DELETE CASCADE, CONSTRAINT contact_relationships_requester_users_id_fk FOREIGN KEY (requested_by_id) REFERENCES users(id) ON DELETE CASCADE)");
  // Backfill only when upgrading a server without contacts. Repeating setup
  // must not revive a removed contact from its retained chat history.
  if (Number(contactTable.n) === 0) await connection.query("INSERT IGNORE INTO contact_relationships (user_low_id,user_high_id,requested_by_id,status) SELECT LEAST(a.user_id,b.user_id),GREATEST(a.user_id,b.user_id),c.created_by,'accepted' FROM conversations c JOIN conversation_members a ON a.conversation_id=c.id JOIN conversation_members b ON b.conversation_id=c.id AND a.user_id<b.user_id WHERE c.type='direct' AND NOT EXISTS (SELECT 1 FROM user_blocks ub WHERE (ub.blocker_id=a.user_id AND ub.blocked_id=b.user_id) OR (ub.blocker_id=b.user_id AND ub.blocked_id=a.user_id))");
  await connection.query("INSERT INTO group_keys (conversation_id,user_id,epoch,wrapped_key,wrapper_public_key) SELECT cm.conversation_id,cm.user_id,c.group_epoch,cm.wrapped_key,u.public_key FROM conversation_members cm JOIN conversations c ON c.id=cm.conversation_id JOIN users u ON u.id=cm.wrapped_by WHERE c.type='group' AND cm.wrapped_key IS NOT NULL AND NOT EXISTS (SELECT 1 FROM group_keys g WHERE g.conversation_id=c.id AND g.user_id=cm.user_id AND g.epoch=c.group_epoch)");
  // Reserved schema for future passwordless sign-in; no login routes are enabled.
  await connection.query(`CREATE TABLE IF NOT EXISTS recovery_credentials (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    verifier VARCHAR(64) NOT NULL UNIQUE,
    encrypted_identity TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP NULL,
    KEY recovery_credentials_user_idx (user_id),
    CONSTRAINT recovery_credentials_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  await connection.query(`CREATE TABLE IF NOT EXISTS device_link_requests (
    id VARCHAR(128) PRIMARY KEY,
    code_hash VARCHAR(64) NOT NULL,
    requester_public_key TEXT NOT NULL,
    approver_public_key TEXT NULL,
    approved_by BIGINT UNSIGNED NULL,
    encrypted_identity TEXT NULL,
    state ENUM('pending','approved','consumed','rejected') NOT NULL DEFAULT 'pending',
    attempts INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    KEY device_link_requests_expires_idx (expires_at),
    CONSTRAINT device_link_requests_approver_fk FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE CASCADE
  )`);
  // ── Locat Sentinel (M1): additive incident-management tables ──────────────
  await connection.query(`CREATE TABLE IF NOT EXISTS integration_tokens (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(80) NOT NULL,
    source VARCHAR(64) NOT NULL DEFAULT 'custom',
    scope VARCHAR(255) NOT NULL DEFAULT 'incidents:write',
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    token_prefix VARCHAR(16) NOT NULL,
    last_used_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP NULL,
    KEY integration_tokens_user_idx (user_id),
    CONSTRAINT integration_tokens_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  await connection.query(`CREATE TABLE IF NOT EXISTS incidents (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    token_id BIGINT UNSIGNED NULL,
    source VARCHAR(64) NOT NULL DEFAULT 'custom',
    severity ENUM('info','low','medium','high','critical') NOT NULL DEFAULT 'medium',
    status ENUM('open','acknowledged','resolved') NOT NULL DEFAULT 'open',
    title VARCHAR(200) NOT NULL,
    description TEXT NULL,
    fingerprint VARCHAR(128) NULL,
    external_id VARCHAR(128) NULL,
    acknowledged_by BIGINT UNSIGNED NULL,
    acknowledged_at TIMESTAMP NULL,
    resolved_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY incidents_user_idx (user_id),
    KEY incidents_user_status_idx (user_id, status),
    KEY incidents_fingerprint_idx (user_id, fingerprint),
    CONSTRAINT incidents_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT incidents_token_fk FOREIGN KEY (token_id) REFERENCES integration_tokens(id) ON DELETE SET NULL
  )`);
  await connection.query(`CREATE TABLE IF NOT EXISTS incident_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    incident_id BIGINT UNSIGNED NOT NULL,
    action ENUM('created','updated','acknowledged','resolved','reopened','note') NOT NULL,
    actor_id BIGINT UNSIGNED NULL,
    detail VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY incident_events_incident_idx (incident_id),
    CONSTRAINT incident_events_incident_fk FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
  )`);
  console.log("Locat database ready. Existing accounts and messages were preserved.");
} finally {
  if (locked) await connection.query("SELECT RELEASE_LOCK('locat_schema_setup')");
  await connection.end();
}
