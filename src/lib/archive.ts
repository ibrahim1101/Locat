import { z } from "zod";
import { b64encode, b64decode } from "./crypto";
import type { LocalMessage } from "./localdb";

export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;
const base64 = z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/);
export const messagePayloadSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().max(1_000_000) }),
  z.object({ type: z.literal("image"), mime: z.enum(["image/jpeg","image/png","image/webp","image/gif","image/avif"]),
    name: z.string().max(1024), dataB64: base64.max(6_000_000) }),
]);
const messageSchema = z.object({
  mid: z.number().int().positive(), conversationId: z.number().int().positive(),
  senderId: z.number().int().positive(), senderName: z.string().max(128),
  outgoing: z.boolean(), payload: messagePayloadSchema,
  createdAt: z.number().int().nonnegative().max(8_640_000_000_000_000),
});
const accountSchema = z.object({ userId: z.number().int().positive(), username: z.string(), origin: z.string() });
export type ArchiveAccount = z.infer<typeof accountSchema>;
const archiveSchema = z.object({ account: accountSchema, messages: z.array(messageSchema).max(50_000) });
const containerSchema = z.object({ app: z.literal("Locat"), version: z.literal(1),
  salt: base64, iv: base64, data: base64 });
const encoder = new TextEncoder();
const aad = encoder.encode("Locat encrypted history backup v1");

async function backupKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  if (password.length < 8) throw new Error("Use a backup password of at least 8 characters.");
  const base = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", iterations: 310_000,
    salt: salt as BufferSource }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function encodeArchive(account: ArchiveAccount, messages: LocalMessage[], password: string): Promise<string> {
  const archive = archiveSchema.parse({ account, messages });
  const plain = encoder.encode(JSON.stringify(archive));
  if (plain.byteLength > MAX_BACKUP_BYTES * 0.7) throw new Error("History is too large for a 50 MB backup.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await backupKey(password, salt);
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad }, key, plain);
  return JSON.stringify({ app: "Locat", version: 1, salt: b64encode(salt), iv: b64encode(iv), data: b64encode(data) });
}

export async function decodeArchive(text: string, expected: ArchiveAccount, password: string): Promise<LocalMessage[]> {
  if (encoder.encode(text).byteLength > MAX_BACKUP_BYTES) throw new Error("Backup must be smaller than 50 MB.");
  const container = containerSchema.parse(JSON.parse(text));
  const salt = b64decode(container.salt);
  const iv = b64decode(container.iv);
  if (salt.length !== 16 || iv.length !== 12) throw new Error("Invalid backup format.");
  const key = await backupKey(password, salt);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource, additionalData: aad }, key,
      b64decode(container.data) as BufferSource);
  } catch { throw new Error("Cannot unlock backup. Check the password and file."); }
  const archive = archiveSchema.parse(JSON.parse(new TextDecoder().decode(plain)));
  if (archive.account.userId !== expected.userId || archive.account.username !== expected.username || archive.account.origin !== expected.origin) {
    throw new Error("This backup belongs to a different Locat account or server.");
  }
  return archive.messages.map((m) => ({ ...m, outgoing: m.senderId === expected.userId }));
}
