import { b64decode, b64encode } from "./crypto";
import { privateConfigSchema, privateEnvelopeSchema, privateEntrySchema, PRIVATE_KDF_ITERATIONS,
  type PrivateConfig, type PrivateEnvelope, type PrivateEntry, type PrivateModule } from "@contracts/privateStore";

const te = new TextEncoder();
export type PrivateScope = { userId: number; origin: string; module: PrivateModule };
function aad(scope: PrivateScope, storeId: string, recordId: string): Uint8Array {
  return te.encode(JSON.stringify(["Locat private store", 1, scope.origin, scope.userId, scope.module, storeId, recordId]));
}
async function passphraseKey(passphrase: string, config: PrivateConfig): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", te.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: b64decode(config.salt) as BufferSource,
    iterations: config.iterations }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function seal(key: CryptoKey, bytes: Uint8Array, additionalData: Uint8Array): Promise<PrivateEnvelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: additionalData as BufferSource }, key, bytes as BufferSource);
  return privateEnvelopeSchema.parse({ v: 1, iv: b64encode(iv), data: b64encode(data) });
}
async function open(key: CryptoKey, input: PrivateEnvelope, additionalData: Uint8Array): Promise<ArrayBuffer> {
  const e = privateEnvelopeSchema.parse(input);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: b64decode(e.iv) as BufferSource, additionalData: additionalData as BufferSource },
    key, b64decode(e.data) as BufferSource);
}
/** Random per-store master key; no passphrase or key is sent to the server. */
export async function createPrivateStore(passphrase: string, scope: PrivateScope): Promise<{ config: PrivateConfig; key: CryptoKey }> {
  if ([...passphrase].length < 15 || passphrase.length > 1024) throw new Error("Use a passphrase of 15–1024 characters.");
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const config: PrivateConfig = { v: 1, storeId: crypto.randomUUID(), salt: b64encode(crypto.getRandomValues(new Uint8Array(16))),
    iterations: PRIVATE_KDF_ITERATIONS, wrappedKey: { v: 1, iv: "", data: "" } };
  const wrappingKey = await passphraseKey(passphrase, config);
  config.wrappedKey = await seal(wrappingKey, raw, aad(scope, config.storeId, "master-key"));
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  raw.fill(0);
  return { config, key };
}
export async function unlockPrivateStore(passphrase: string, input: PrivateConfig, scope: PrivateScope): Promise<CryptoKey> {
  const config = privateConfigSchema.parse(input);
  const raw = new Uint8Array(await open(await passphraseKey(passphrase, config), config.wrappedKey, aad(scope, config.storeId, "master-key")));
  try {
    if (raw.byteLength !== 32) throw new Error("Invalid master key length");
    return await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  }
  finally { raw.fill(0); }
}
export async function encryptPrivateEntry(key: CryptoKey, config: PrivateConfig, scope: PrivateScope, id: string, entry: PrivateEntry): Promise<PrivateEnvelope> {
  const valid = privateEntrySchema.parse(entry);
  if ((scope.module === "vault") !== (valid.kind === "file")) throw new Error("Wrong entry module");
  return seal(key, te.encode(JSON.stringify(valid)), aad(scope, config.storeId, id));
}
export async function decryptPrivateEntry(key: CryptoKey, config: PrivateConfig, scope: PrivateScope, id: string, envelope: PrivateEnvelope): Promise<PrivateEntry> {
  const valid = privateEntrySchema.parse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(await open(key, envelope, aad(scope, config.storeId, id)))));
  if ((scope.module === "vault") !== (valid.kind === "file")) throw new Error("Wrong entry module");
  if (valid.kind === "file" && b64decode(valid.data).byteLength !== valid.bytes) throw new Error("File length mismatch");
  return valid;
}
/** Rejection sampling avoids modulo bias; uses only the platform CSPRNG. */
export function generatePrivatePassword(length = 24): string {
  if (!Number.isInteger(length) || length < 15 || length > 128) throw new Error("Invalid password length");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*+-_=?.";
  const limit = 256 - (256 % alphabet.length);
  let result = "";
  while (result.length < length) {
    for (const n of crypto.getRandomValues(new Uint8Array(64))) {
      if (n < limit && result.length < length) result += alphabet[n % alphabet.length];
    }
  }
  return result;
}
