import "dotenv/config";
import { access } from "node:fs/promises";
import mysql from "mysql2/promise";

// Read-only installation checks. Never print configuration values or driver errors:
// these can contain database credentials and subscription secrets.
let failures = 0;
function report(ok, label, advice = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${!ok && advice ? ` — ${advice}` : ""}`);
  if (!ok) failures++;
}
console.log("Locat server diagnostics (read-only)");
const [major, minor] = process.versions.node.split(".").map(Number);
report((major === 22 && minor >= 12) || major >= 24, "Supported Node.js runtime", "Install Node.js 22.12+ or 24+.");
for (const file of ["dist/boot.js", "dist/public/index.html", "dist/public/sw.js"]) {
  let exists = true;
  try { await access(new URL(`../${file}`, import.meta.url)); } catch { exists = false; }
  report(exists, `Build file ${file}`, "Run npm ci, then npm run build.");
}
const port = Number(process.env.PORT || "3000");
report(Number.isInteger(port) && port >= 1 && port <= 65535, "Valid server port", "Set PORT to a number from 1 to 65535.");
const origin = process.env.PUBLIC_ORIGIN;
let validOrigin = true;
if (origin) {
  try {
    const url = new URL(origin);
    validOrigin = url.protocol === "https:" && !url.username && !url.password && url.origin === origin;
  } catch { validOrigin = false; }
}
report(validOrigin, "Public origin configuration", "Use the exact HTTPS origin without a path or trailing slash.");
if (!origin) console.log("INFO PUBLIC_ORIGIN is unset; requests must use the same host. Use HTTPS for secure login.");
const push = ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"].map(key => Boolean(process.env[key]));
report(push.every(Boolean) || push.every(value => !value), "Consistent optional push configuration", "Configure all three VAPID settings together.");
if (push.every(value => !value)) console.log("INFO Background notifications are not configured (optional).");
report(Boolean(process.env.DATABASE_URL), "Database configuration present", "Set DATABASE_URL in .env.");
if (process.env.DATABASE_URL) {
  let connection;
  try {
    const url = new URL(process.env.DATABASE_URL);
    if (url.protocol !== "mysql:" || !url.pathname.slice(1)) throw new Error("Invalid database configuration");
    connection = await mysql.createConnection({
      host: url.hostname, port: Number(url.port || 3306),
      user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.slice(1)), connectTimeout: 5000,
    });
    await connection.query({ sql: "SELECT 1", timeout: 5000 });
    report(true, "Database connection");
    for (const [label, sql] of [
      ["Account/admin schema", "SELECT id, disabled, is_admin, bio FROM users LIMIT 0"],
      ["Delivery schema", "SELECT client_message_id FROM messages LIMIT 0"],
      ["Retry receipts", "SELECT id FROM send_receipts LIMIT 0"],
      ["Group version schema", "SELECT group_epoch, rotation_required FROM conversations LIMIT 0"],
      ["Group keys", "SELECT id FROM group_keys LIMIT 0"],
      ["Push subscriptions", "SELECT id FROM push_subscriptions LIMIT 0"],
    ]) {
      try { await connection.query({ sql, timeout: 5000 }); report(true, label); }
      catch { report(false, label, "Back up the database, then run npm run db:setup."); }
    }
  } catch { report(false, "Database connection", "Check DATABASE_URL and whether MariaDB is running/reachable."); }
  finally { if (connection) await connection.end(); }
}
console.log(failures ? `Locat needs attention: ${failures} failed check(s).` : "Installation checks passed. Test HTTPS login and messaging in your browser next.");
process.exitCode = failures ? 1 : 0;
