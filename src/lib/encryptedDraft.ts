import { b64decode, b64encode, type IdentityKeys } from "./crypto";
import { kvDel, kvGet, kvSet } from "./localdb";
import { z } from "zod";
const encoder = new TextEncoder();
export const MAX_ENCRYPTED_DRAFT = 4096;
const recordSchema = z.object({ version: z.literal(1), iv: z.string().max(24), data: z.string().max(40_000) }).strict();
const queues = new Map<string, Promise<void>>();
const keys = new WeakMap<CryptoKey, Map<string, Promise<CryptoKey>>>();
export function draftScope(server: string, userId: number): string {
  const url = new URL(server);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || !Number.isSafeInteger(userId) || userId <= 0) throw new Error("Invalid draft account scope");
  return JSON.stringify([url.origin, userId]);
}
function context(server: string, userId: number, conversationId: number) {
  if (!Number.isSafeInteger(conversationId) || conversationId <= 0) throw new Error("Invalid draft conversation");
  const scope = draftScope(server, userId);
  return { scope, storage: `encrypted-draft:v1:${scope}:${conversationId}` };
}
async function keyFor(identity: IdentityKeys, scope: string): Promise<CryptoKey> {
  let cache = keys.get(identity.privateKey);
  if (!cache) { cache = new Map(); keys.set(identity.privateKey, cache); }
  let pending = cache.get(scope);
  if (!pending) {
    pending = (async () => {
      const bits = await crypto.subtle.deriveBits({ name: "ECDH", public: identity.publicKey }, identity.privateKey, 256);
      const base = await crypto.subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
      return crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: encoder.encode(scope),
        info: encoder.encode("Locat device encrypted drafts v1") }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    })();
    cache.set(scope, pending);
    void pending.catch(() => cache?.delete(scope));
  }
  return pending;
}
export async function loadEncryptedDraft(identity: IdentityKeys, server: string, userId: number, conversationId: number): Promise<string> {
  const { scope, storage } = context(server, userId, conversationId);
  await queues.get(storage)?.catch(() => undefined);
  const raw = await kvGet(userId, storage);
  if (!raw) return "";
  const record = recordSchema.parse(raw);
  const iv = b64decode(record.iv);
  if (iv.length !== 12) throw new Error("Invalid encrypted draft nonce");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource,
    additionalData: encoder.encode(storage) }, await keyFor(identity, scope), b64decode(record.data) as BufferSource);
  const text = new TextDecoder().decode(plain);
  if (text.length > MAX_ENCRYPTED_DRAFT) throw new Error("Draft exceeds the size limit");
  return text;
}
export async function saveEncryptedDraft(identity: IdentityKeys, server: string, userId: number, conversationId: number, text: string): Promise<void> {
  const { scope, storage } = context(server, userId, conversationId);
  const capped = text.slice(0, MAX_ENCRYPTED_DRAFT);
  const pending = (queues.get(storage) ?? Promise.resolve()).catch(() => undefined).then(async () => {
    if (!capped) { await kvDel(userId, storage); return; }
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(storage) },
      await keyFor(identity, scope), encoder.encode(capped));
    await kvSet(userId, storage, { version: 1, iv: b64encode(iv), data: b64encode(data) });
  });
  queues.set(storage, pending);
  void pending.finally(() => { if (queues.get(storage) === pending) queues.delete(storage); }).catch(() => undefined);
  return pending;
}
