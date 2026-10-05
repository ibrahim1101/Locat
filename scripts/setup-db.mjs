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
  console.log("Locat database ready. Existing accounts and messages were preserved.");
} finally {
  if (locked) await connection.query("SELECT RELEASE_LOCK('locat_schema_setup')");
  await connection.end();
}
