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

export async function encryptText(key: CryptoKey, text: string): Promise<{ iv: string; data: string }> {
  return encryptChunk(key, te.encode(text));
}

export async function decryptText(key: CryptoKey, iv: string, data: string): Promise<string> {
  return new TextDecoder().decode(await decryptChunk(key, iv, data));
}
