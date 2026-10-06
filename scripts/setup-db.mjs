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
  const [[bioColumn]] = await connection.query("SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'bio'");
  if (Number(bioColumn.n) === 0) await connection.query("ALTER TABLE users ADD COLUMN bio VARCHAR(280) NULL");
  const [[avatarColumn]] = await connection.query("SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatar'");
  if (Number(avatarColumn.n) === 0) await connection.query("ALTER TABLE users ADD COLUMN avatar TEXT NULL");
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
  for (const [name, definition] of [["group_epoch", "INT NOT NULL DEFAULT 1"], ["rotation_required", "BOOLEAN NOT NULL DEFAULT FALSE"]]) {
    const [[column]] = await connection.query("SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'conversations' AND COLUMN_NAME = ?", [name]);
    if (Number(column.n) === 0) await connection.query(`ALTER TABLE conversations ADD COLUMN ${name} ${definition}`);
  }
  await connection.query("CREATE TABLE IF NOT EXISTS group_keys (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, conversation_id BIGINT UNSIGNED NOT NULL, user_id BIGINT UNSIGNED NOT NULL, epoch INT NOT NULL, wrapped_key TEXT NOT NULL, wrapper_public_key TEXT NOT NULL, UNIQUE KEY group_key_user_epoch_unique (conversation_id,user_id,epoch), CONSTRAINT group_keys_conversation_id_conversations_id_fk FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE, CONSTRAINT group_keys_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)");
  await connection.query("INSERT INTO group_keys (conversation_id,user_id,epoch,wrapped_key,wrapper_public_key) SELECT cm.conversation_id,cm.user_id,c.group_epoch,cm.wrapped_key,u.public_key FROM conversation_members cm JOIN conversations c ON c.id=cm.conversation_id JOIN users u ON u.id=cm.wrapped_by WHERE c.type='group' AND cm.wrapped_key IS NOT NULL AND NOT EXISTS (SELECT 1 FROM group_keys g WHERE g.conversation_id=c.id AND g.user_id=cm.user_id AND g.epoch=c.group_epoch)");
  console.log("Locat database ready. Existing accounts and messages were preserved.");
} finally {
  if (locked) await connection.query("SELECT RELEASE_LOCK('locat_schema_setup')");
  await connection.end();
}
