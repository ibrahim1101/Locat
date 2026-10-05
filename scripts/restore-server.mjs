import "dotenv/config";
import { readFile, stat } from "node:fs/promises";
import { scrypt, createDecipheriv } from "node:crypto";
import { promisify } from "node:util";
import mysql from "mysql2/promise";
import { z } from "zod";
const path = process.argv[2];
if (!path || !process.env.LOCAT_BACKUP_PASSWORD || !process.env.DATABASE_URL)
  throw new Error(
    "Set LOCAT_BACKUP_PASSWORD and DATABASE_URL. Usage: npm run restore:server -- FILE.locat-server. Target database must be empty and bootstrapped."
  );
if ((await stat(path)).size > 40_000_000)
  throw new Error("Backup is too large");
const b64 = z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/);
const container = z
  .object({
    app: z.literal("Locat server metadata"),
    version: z.literal(1),
    kdf: z.literal("scrypt-16384-8-1"),
    salt: b64,
    iv: b64,
    tag: b64,
    data: b64,
  })
  .parse(JSON.parse(await readFile(path, "utf8")));
const salt = Buffer.from(container.salt, "base64"),
  iv = Buffer.from(container.iv, "base64"),
  tag = Buffer.from(container.tag, "base64");
if (salt.length !== 16 || iv.length !== 12 || tag.length !== 16)
  throw new Error("Invalid backup format");
const key = await promisify(scrypt)(
  process.env.LOCAT_BACKUP_PASSWORD,
  salt,
  32
);
delete process.env.LOCAT_BACKUP_PASSWORD;
const decipher = createDecipheriv("aes-256-gcm", key, iv);
decipher.setAAD(Buffer.from("Locat server metadata v1"));
decipher.setAuthTag(tag);
let plain;
try {
  plain = Buffer.concat([
    decipher.update(Buffer.from(container.data, "base64")),
    decipher.final(),
  ]);
} catch {
  throw new Error("Cannot unlock backup. Check the backup password and file.");
}
const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const date = z.coerce.date();
const account = z.object({
  id,
  username: z.string().min(3).max(64),
  displayName: z.string().min(1).max(128),
  passwordHash: z
    .string()
    .regex(/^scrypt\$/)
    .max(255),
  publicKey: z.string().max(16000),
  encryptedPrivateKey: z.string().max(16000),
  keySalt: z.string().max(64),
  disabled: z.boolean(),
  isAdmin: z.boolean(),
  createdAt: date,
});
const conversation = z.object({
  id,
  type: z.enum(["direct", "group"]),
  name: z.string().max(128).nullable(),
  createdBy: id,
  createdAt: date,
});
const member = z.object({
  id,
  conversationId: id,
  userId: id,
  wrappedKey: z.string().max(16000).nullable(),
  wrappedBy: id.nullable(),
  joinedAt: date,
});
const data = z
  .object({
    version: z.literal(1),
    createdAt: date,
    accounts: z.array(account).max(10000),
    conversations: z.array(conversation).max(10000),
    members: z.array(member).max(100000),
  })
  .parse(JSON.parse(plain.toString("utf8")));
const db = await mysql.createConnection(process.env.DATABASE_URL);
try {
  await db.beginTransaction();
  for (const table of [
    "users",
    "conversations",
    "conversation_members",
    "messages",
    "sessions",
  ]) {
    const [rows] = await db.query(`SELECT id FROM ${table} LIMIT 1 FOR UPDATE`);
    if (rows.length)
      throw new Error(
        "Restore refused: target database is not empty. Use a fresh installation and stop the application first."
      );
  }
  for (const row of data.accounts)
    await db.query(
      "INSERT INTO users (id,username,display_name,password_hash,public_key,encrypted_private_key,key_salt,disabled,is_admin,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [
        row.id,
        row.username,
        row.displayName,
        row.passwordHash,
        row.publicKey,
        row.encryptedPrivateKey,
        row.keySalt,
        row.disabled,
        row.isAdmin,
        row.createdAt,
      ]
    );
  for (const row of data.conversations)
    await db.query(
      "INSERT INTO conversations (id,type,name,created_by,created_at) VALUES (?,?,?,?,?)",
      [row.id, row.type, row.name, row.createdBy, row.createdAt]
    );
  for (const row of data.members)
    await db.query(
      "INSERT INTO conversation_members (id,conversation_id,user_id,wrapped_key,wrapped_by,joined_at) VALUES (?,?,?,?,?,?)",
      [
        row.id,
        row.conversationId,
        row.userId,
        row.wrappedKey,
        row.wrappedBy,
        row.joinedAt,
      ]
    );
  await db.query(
    "INSERT INTO admin_audit (actor_id,action) VALUES (0,'metadata-restore')"
  );
  await db.commit();
  console.log(
    `Restored ${data.accounts.length} accounts and ${data.conversations.length} conversations. Users must log in again.`
  );
} catch (error) {
  await db.rollback();
  throw error;
} finally {
  await db.end();
}
