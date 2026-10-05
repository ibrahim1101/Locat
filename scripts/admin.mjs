import "dotenv/config";
import mysql from "mysql2/promise";
const [command, username] = process.argv.slice(2);
const allowed = [
  "users",
  "stats",
  "disable",
  "enable",
  "revoke-sessions",
  "cleanup",
  "grant-admin",
  "revoke-admin",
];
if (
  !allowed.includes(command) ||
  ([
    "disable",
    "enable",
    "revoke-sessions",
    "grant-admin",
    "revoke-admin",
  ].includes(command) &&
    !username)
) {
  console.log(
    "Locat administration (run on the server):\n  npm run admin -- users\n  npm run admin -- stats\n  npm run admin -- disable USERNAME\n  npm run admin -- enable USERNAME\n  npm run admin -- revoke-sessions USERNAME\n  npm run admin -- cleanup\n  npm run admin -- grant-admin USERNAME\n  npm run admin -- revoke-admin USERNAME"
  );
  process.exit(command ? 1 : 0);
}
if (!process.env.DATABASE_URL)
  throw new Error(
    "DATABASE_URL is required. Run from the installation directory."
  );
const db = await mysql.createConnection(process.env.DATABASE_URL);
try {
  if (command === "users") {
    const [rows] = await db.query(
      "SELECT id, username, display_name, disabled, is_admin, created_at FROM users ORDER BY id"
    );
    console.table(rows);
  } else if (command === "stats") {
    for (const table of [
      "users",
      "sessions",
      "conversations",
      "messages",
      "message_deliveries",
    ]) {
      const [[row]] = await db.query(`SELECT COUNT(*) AS count FROM ${table}`);
      console.log(`${table}: ${row.count}`);
    }
    const [[queue]] = await db.query(
      "SELECT COALESCE(SUM(OCTET_LENGTH(envelope)),0) AS bytes FROM messages"
    );
    console.log(`Encrypted queue bytes: ${queue.bytes}`);
  } else if (command === "cleanup") {
    await db.beginTransaction();
    await db.query("DELETE FROM sessions WHERE expires_at < NOW()");
    await db.query(
      "DELETE FROM send_receipts WHERE created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)"
    );
    const [result] = await db.query(
      "DELETE FROM messages WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)"
    );
    await db.query(
      "INSERT INTO admin_audit(actor_id, action) VALUES (0, 'cleanup')"
    );
    await db.commit();
    console.log(
      `Expired ${result.affectedRows} queued messages older than 30 days.`
    );
  } else {
    await db.beginTransaction();
    const [[user]] = await db.query(
      "SELECT id FROM users WHERE username = ? FOR UPDATE",
      [username.toLowerCase()]
    );
    if (!user) throw new Error("Account not found");
    if (["grant-admin", "revoke-admin"].includes(command)) {
      await db.query("UPDATE users SET is_admin = ? WHERE id = ?", [
        command === "grant-admin",
        user.id,
      ]);
      await db.query(
        "INSERT INTO admin_audit(actor_id, action, target_id) VALUES (0, ?, ?)",
        [command, user.id]
      );
    }
    if (["disable", "enable"].includes(command))
      await db.query("UPDATE users SET disabled = ? WHERE id = ?", [
        command === "disable",
        user.id,
      ]);
    if (["disable", "revoke-sessions", "revoke-admin"].includes(command)) {
      await db.query("DELETE FROM push_subscriptions WHERE user_id = ?", [
        user.id,
      ]);
      await db.query("DELETE FROM sessions WHERE user_id = ?", [user.id]);
    }
    if (!["grant-admin", "revoke-admin"].includes(command))
      await db.query(
        "INSERT INTO admin_audit(actor_id, action, target_id) VALUES (0, ?, ?)",
        [command, user.id]
      );
    await db.commit();
    console.log(`${command}: ${username}`);
  }
} catch (error) {
  await db.rollback();
  throw error;
} finally {
  await db.end();
}
