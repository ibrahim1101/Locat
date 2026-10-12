import { z } from "zod";
import { b64encode, b64decode, type IdentityKeys } from "./crypto";
import { draftScope, MAX_ENCRYPTED_DRAFT } from "./encryptedDraft";
import { kvDel, kvGet, kvKeys, putBoundedKv } from "./localdb";
import { messagePayloadSchema } from "@contracts/messagePayload";
const encoder = new TextEncoder();
const schema = z.object({ clientMessageId: z.string().uuid(), conversationId: z.number().int().positive(),
  deliverAt: z.iso.datetime(), envelope: z.string().min(2).max(60_000),
  payload: messagePayloadSchema.refine(p => p.type === "text" && p.text.length <= MAX_ENCRYPTED_DRAFT),
}).strict();
export type ScheduledCopy = z.infer<typeof schema>;
const recordSchema = z.object({ version: z.literal(1), iv: z.string().max(24), data: z.string().max(140_000) }).strict();
const cache = new WeakMap<CryptoKey, Map<string, Promise<CryptoKey>>>();
function prefix(server: string, userId: number) { return `scheduled-copy:v1:${draftScope(server, userId)}:`; }
function storageKey(server: string, userId: number, id: string) { z.string().uuid().parse(id); return prefix(server, userId) + id; }
async function keyFor(identity: IdentityKeys, scope: string) {
  let keys = cache.get(identity.privateKey); if (!keys) { keys = new Map(); cache.set(identity.privateKey, keys); }
  let key = keys.get(scope);
  if (!key) {
    key = (async () => {
      const bits = await crypto.subtle.deriveBits({ name: "ECDH", public: identity.publicKey }, identity.privateKey, 256);
      const base = await crypto.subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
      return crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: encoder.encode(scope),
        info: encoder.encode("Locat scheduled text copies v1") }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    })();
    keys.set(scope, key); void key.catch(() => keys?.delete(scope));
  }
  return key;
}
export async function saveScheduledCopy(identity: IdentityKeys, server: string, userId: number, value: ScheduledCopy) {
  const copy = schema.parse(value), storage = storageKey(server, userId, copy.clientMessageId);
  const plain = encoder.encode(JSON.stringify(copy)); if (plain.length > 90_000) throw new Error("Scheduled copy too large");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(storage) },
    await keyFor(identity, draftScope(server, userId)), plain);
  await putBoundedKv(userId, storage, prefix(server, userId), { version: 1, iv: b64encode(iv), data: b64encode(data) }, 200);
}
export async function loadScheduledCopy(identity: IdentityKeys, server: string, userId: number, id: string): Promise<ScheduledCopy | undefined> {
  const storage = storageKey(server, userId, id), raw = await kvGet(userId, storage); if (!raw) return undefined;
  const record = recordSchema.parse(raw), iv = b64decode(record.iv); if (iv.length !== 12) throw new Error("Invalid scheduled copy");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource, additionalData: encoder.encode(storage) },
    await keyFor(identity, draftScope(server, userId)), b64decode(record.data) as BufferSource);
  const copy = schema.parse(JSON.parse(new TextDecoder().decode(plain)));
  if (copy.clientMessageId !== id) throw new Error("Scheduled copy identity mismatch"); return copy;
}
export async function listScheduledCopies(identity: IdentityKeys, server: string, userId: number) {
  const scope = prefix(server, userId), ids = (await kvKeys(userId)).filter((k): k is string => typeof k === "string" && k.startsWith(scope));
  const copies: ScheduledCopy[] = []; let errors = 0;
  for (const key of ids) { try { const copy = await loadScheduledCopy(identity, server, userId, key.slice(scope.length)); if (copy) copies.push(copy); } catch { errors++; } }
  return { copies, errors };
}
export async function forgetScheduledCopy(server: string, userId: number, id: string) { await kvDel(userId, storageKey(server, userId, id)); }
