// ─── Locat Link device crypto (WebCrypto) ───────────────────────────────────
// Device identity keys are ECDH P-256, separate from the messaging identity.
// Pairing is authenticated with a Short Authentication String (SAS) derived
// from BOTH device public keys: a man-in-the-middle that swaps a key produces a
// different SAS on each side, so the user-visible verification fails. Transfer
// and clipboard payloads use AES-GCM with a key derived from ECDH between the
// two paired devices. No custom cryptographic primitives — only WebCrypto
// ECDH / HKDF / AES-GCM, matching the existing messenger.
import { b64encode, b64decode } from "@/lib/crypto";

const te = new TextEncoder();

export type DeviceIdentity = { privateKey: CryptoKey; publicKey: CryptoKey; publicKeyB64: string };

export async function generateDeviceIdentity(): Promise<DeviceIdentity> {
  if (!globalThis.crypto?.subtle) throw new Error("Secure context required for Locat Link.");
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const spki = await crypto.subtle.exportKey("spki", pair.publicKey);
  return { privateKey: pair.privateKey, publicKey: pair.publicKey, publicKeyB64: b64encode(spki) };
}

export async function importDevicePublicKey(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("spki", b64decode(b64) as BufferSource, { name: "ECDH", namedCurve: "P-256" }, true, []);
}

async function ecdhBits(myPriv: CryptoKey, theirPubB64: string): Promise<ArrayBuffer> {
  const pub = await importDevicePublicKey(theirPubB64);
  return crypto.subtle.deriveBits({ name: "ECDH", public: pub }, myPriv, 256);
}

/** AES-GCM transfer/clipboard key shared by the two paired devices. */
export async function deviceSharedKey(myPriv: CryptoKey, theirPubB64: string): Promise<CryptoKey> {
  const bits = await ecdhBits(myPriv, theirPubB64);
  const base = await crypto.subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", salt: te.encode("locat-link"), info: te.encode("device-transfer-key"), hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Six-digit Short Authentication String over the SORTED pair of public keys.
 * Order-independent so both devices compute the same value; MITM key swap
 * changes it. Pure given WebCrypto digest.
 */
export async function pairingSas(pubA_b64: string, pubB_b64: string): Promise<string> {
  const [lo, hi] = [pubA_b64, pubB_b64].sort();
  const digest = await crypto.subtle.digest("SHA-256", te.encode(`locat-link-sas:${lo}:${hi}`) as BufferSource);
  const bytes = new Uint8Array(digest);
  // Take 20 bits → 0..1,048,575 → 6-digit code (mod 1e6), zero-padded.
  const n = ((bytes[0] << 12) | (bytes[1] << 4) | (bytes[2] >> 4)) % 1_000_000;
  return String(n).padStart(6, "0");
}

export const CHUNK_SIZE = 256 * 1024; // 256 KB plaintext per chunk

export function chunkCount(size: number, chunk = CHUNK_SIZE): number {
  return Math.max(1, Math.ceil(size / chunk));
}

export function sliceChunk(bytes: Uint8Array, seq: number, chunk = CHUNK_SIZE): Uint8Array {
  return bytes.subarray(seq * chunk, (seq + 1) * chunk);
}

export async function encryptChunk(key: CryptoKey, bytes: Uint8Array): Promise<{ iv: string; data: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes as BufferSource);
  return { iv: b64encode(iv), data: b64encode(data) };
}

export async function decryptChunk(key: CryptoKey, iv: string, data: string): Promise<Uint8Array> {
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64decode(iv) as BufferSource }, key, b64decode(data) as BufferSource);
  return new Uint8Array(plain);
}

/** Authenticated context prevents ciphertext substitution across transfers or positions. */
export type TransferContext = {
  id: number; userId: number; fromDevice: number; toDevice: number;
  filename: string; mime: string; size: number; chunkCount: number;
};
export function validateTransferContext(t: TransferContext, seq = 0): void {
  for (const value of [t.id, t.userId, t.fromDevice, t.toDevice, t.chunkCount]) {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error("Invalid transfer context");
  }
  if (!Number.isSafeInteger(t.size) || t.size < 0 || t.size > 200 * 1024 * 1024 ||
      t.chunkCount !== chunkCount(t.size) || !Number.isSafeInteger(seq) || seq < 0 || seq >= t.chunkCount ||
      t.fromDevice === t.toDevice || typeof t.filename !== "string" || typeof t.mime !== "string") {
    throw new Error("Invalid transfer context");
  }
}
function transferAad(t: TransferContext, seq: number): Uint8Array {
  validateTransferContext(t, seq);
  return te.encode(JSON.stringify(["locat-link-file:v1", t.userId, t.id, t.fromDevice,
    t.toDevice, t.filename, t.mime, t.size, t.chunkCount, seq]));
}
function expectedChunkLength(t: TransferContext, seq: number): number {
  return Math.min(CHUNK_SIZE, t.size - seq * CHUNK_SIZE);
}
/** Read only the requested chunk, keeping upload buffering bounded. */
export async function readFileChunk(file: Pick<Blob, "size" | "slice">, seq: number): Promise<Uint8Array> {
  if (!Number.isSafeInteger(file.size) || file.size < 0 || file.size > 200 * 1024 * 1024 ||
    !Number.isSafeInteger(seq) || seq < 0 || seq >= chunkCount(file.size)) throw new Error("Invalid file chunk");
  const start = seq * CHUNK_SIZE;
  const bytes = new Uint8Array(await file.slice(start, Math.min(file.size, start + CHUNK_SIZE)).arrayBuffer());
  if (bytes.length !== Math.min(CHUNK_SIZE, file.size - start)) throw new Error("File chunk length mismatch");
  return bytes;
}

export async function encryptTransferChunk(key: CryptoKey, bytes: Uint8Array, t: TransferContext, seq: number) {
  const additionalData = transferAad(t, seq);
  if (bytes.length !== expectedChunkLength(t, seq)) throw new Error("Transfer chunk length mismatch");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: additionalData as BufferSource }, key, bytes as BufferSource);
  return { iv: b64encode(iv), data: b64encode(data) };
}
export async function decryptTransferChunk(key: CryptoKey, iv: string, data: string, t: TransferContext, seq: number) {
  const additionalData = transferAad(t, seq);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64decode(iv) as BufferSource,
    additionalData: additionalData as BufferSource }, key, b64decode(data) as BufferSource));
  if (plain.length !== expectedChunkLength(t, seq)) throw new Error("Transfer chunk length mismatch");
  return plain;
}

export async function encryptText(key: CryptoKey, text: string): Promise<{ iv: string; data: string }> {
  return encryptChunk(key, te.encode(text));
}

export async function decryptText(key: CryptoKey, iv: string, data: string): Promise<string> {
  return new TextDecoder().decode(await decryptChunk(key, iv, data));
}

/** Decrypt a fresh server challenge; proves possession of this device's ECDH key. */
export async function solveDeviceChallenge(identity: DeviceIdentity, challenge: {
  id: string; deviceId: number; userId: number; publicKey: string; iv: string; data: string;
}): Promise<string> {
  const context = `locat-link-device-proof:v1:${challenge.userId}:${challenge.deviceId}:${challenge.id}`;
  const bits = await ecdhBits(identity.privateKey, challenge.publicKey);
  const base = await crypto.subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: te.encode(context), info: te.encode("challenge-response") }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64decode(challenge.iv) as BufferSource,
    additionalData: te.encode(context) }, key, b64decode(challenge.data) as BufferSource);
  return b64encode(plain);
}

export type LinkMessageContext = { id: number; userId: number; fromDevice: number; toDevice: number; kind: "clipboard" | "text" | "url" };
function messageAad(c: LinkMessageContext) {
  if ([c.id, c.userId, c.fromDevice, c.toDevice].some(n => !Number.isSafeInteger(n) || n < 1) ||
    c.fromDevice === c.toDevice || !["clipboard", "text", "url"].includes(c.kind)) throw new Error("Invalid message context");
  return te.encode(JSON.stringify(["locat-link-message:v1", c.userId, c.id, c.fromDevice, c.toDevice, c.kind]));
}
export async function encryptLinkMessage(key: CryptoKey, text: string, c: LinkMessageContext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: messageAad(c) }, key, te.encode(text));
  return { iv: b64encode(iv), data: b64encode(data) };
}
export async function decryptLinkMessage(key: CryptoKey, iv: string, data: string, c: LinkMessageContext) {
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64decode(iv) as BufferSource,
    additionalData: messageAad(c) }, key, b64decode(data) as BufferSource);
  return new TextDecoder().decode(plain);
}
