// ─── End-to-end encryption layer (WebCrypto) ───────────────────────────────
// Everything here runs on the device. The server only ever sees:
//   - public keys (directory)
//   - private keys wrapped with a password-derived key (backup blob)
//   - AES-GCM envelopes it cannot open
import type { EncryptedEnvelope, MessagePayload } from "@contracts/types";

const te = new TextEncoder();
const td = new TextDecoder();

export function b64encode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

export function b64decode(b64: string): Uint8Array {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

// ─── Identity keys ──────────────────────────────────────────────────────────

export type IdentityKeys = {
  privateKey: CryptoKey; // ECDH P-256
  publicKey: CryptoKey;
  publicKeyB64: string; // base64 SPKI — published to the key directory
};

export async function generateIdentity(): Promise<IdentityKeys> {
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ]);
  const spki = await crypto.subtle.exportKey("spki", pair.publicKey);
  return { privateKey: pair.privateKey, publicKey: pair.publicKey, publicKeyB64: b64encode(spki) };
}

export async function importPublicKey(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("spki", b64decode(b64) as BufferSource, { name: "ECDH", namedCurve: "P-256" }, true, []);
}

async function importPrivateKey(b64: string, extractable: boolean): Promise<CryptoKey> {
  return crypto.subtle.importKey("pkcs8", b64decode(b64) as BufferSource, { name: "ECDH", namedCurve: "P-256" }, extractable, [
    "deriveBits",
  ]);
}

// ─── Password-wrapped private key backup (multi-device restore) ─────────────

async function passwordKey(password: string, saltB64: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", te.encode(password), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: b64decode(saltB64) as BufferSource, iterations: 210_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Encrypt the PKCS8 private key with a password-derived key. Returns b64 JSON. */
export async function wrapPrivateKeyForBackup(
  keys: IdentityKeys,
  password: string,
): Promise<{ encryptedPrivateKey: string; keySalt: string }> {
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", keys.privateKey);
  const keySalt = b64encode(crypto.getRandomValues(new Uint8Array(16)));
  const aes = await passwordKey(password, keySalt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, pkcs8);
  return {
    encryptedPrivateKey: b64encode(te.encode(JSON.stringify({ iv: b64encode(iv), data: b64encode(data) }))),
    keySalt,
  };
}

/** Restore the identity from the server-stored backup blob + password. */
export async function unwrapPrivateKeyBackup(
  encryptedPrivateKey: string,
  keySalt: string,
  password: string,
): Promise<CryptoKey> {
  const { iv, data } = JSON.parse(td.decode(b64decode(encryptedPrivateKey)));
  const aes = await passwordKey(password, keySalt);
  const pkcs8 = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64decode(iv) as BufferSource },
    aes,
    b64decode(data) as BufferSource,
  );
  return importPrivateKey(b64encode(pkcs8), false);
}

// ─── Shared secret derivation ────────────────────────────────────────────────

async function ecdhBits(myPriv: CryptoKey, theirPubB64: string): Promise<ArrayBuffer> {
  const pub = await importPublicKey(theirPubB64);
  return crypto.subtle.deriveBits({ name: "ECDH", public: pub }, myPriv, 256);
}

async function hkdfAesKey(bits: ArrayBuffer, salt: string, info: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", salt: te.encode(salt), info: te.encode(info), hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

/** Deterministic pairwise key for a 1:1 conversation (order-independent). */
export function deriveDirectKey(
  myPriv: CryptoKey,
  theirPubB64: string,
  userIdA: number,
  userIdB: number,
): Promise<CryptoKey> {
  const [lo, hi] = [Math.min(userIdA, userIdB), Math.max(userIdA, userIdB)];
  return ecdhBits(myPriv, theirPubB64).then((bits) =>
    hkdfAesKey(bits, `relaychat-direct:${lo}:${hi}`, "message-key"),
  );
}

// ─── Group keys ──────────────────────────────────────────────────────────────

export async function generateGroupKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

export type WrappedGroupKey = { nonce: string; iv: string; data: string };

/** Wrap a group key for one member using ECDH(wrapper, member) + random nonce. */
export async function wrapGroupKey(
  groupKey: CryptoKey,
  wrapperPriv: CryptoKey,
  memberPubB64: string,
): Promise<string> {
  const nonce = b64encode(crypto.getRandomValues(new Uint8Array(16)));
  const bits = await ecdhBits(wrapperPriv, memberPubB64);
  const kek = await hkdfAesKey(bits, `relaychat-groupkey:${nonce}`, "group-key-wrap");
  const raw = await crypto.subtle.exportKey("raw", groupKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, kek, raw);
  const payload: WrappedGroupKey = { nonce, iv: b64encode(iv), data: b64encode(data) };
  return b64encode(te.encode(JSON.stringify(payload)));
}

/** Unwrap my copy of the group key. */
export async function unwrapGroupKey(
  wrapped: string,
  myPriv: CryptoKey,
  wrapperPubB64: string,
): Promise<CryptoKey> {
  const payload: WrappedGroupKey = JSON.parse(td.decode(b64decode(wrapped)));
  const bits = await ecdhBits(myPriv, wrapperPubB64);
  const kek = await hkdfAesKey(bits, `relaychat-groupkey:${payload.nonce}`, "group-key-wrap");
  const raw = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64decode(payload.iv) as BufferSource },
    kek,
    b64decode(payload.data) as BufferSource,
  );
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

// ─── Message envelopes ───────────────────────────────────────────────────────

export async function encryptPayload(key: CryptoKey, payload: MessagePayload): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, te.encode(JSON.stringify(payload)));
  const envelope: EncryptedEnvelope = { v: 1, iv: b64encode(iv), data: b64encode(data) };
  return JSON.stringify(envelope);
}

export async function decryptPayload(key: CryptoKey, envelopeJson: string): Promise<MessagePayload> {
  const envelope: EncryptedEnvelope = JSON.parse(envelopeJson);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64decode(envelope.iv) as BufferSource },
    key,
    b64decode(envelope.data) as BufferSource,
  );
  return JSON.parse(td.decode(plain));
}

/** Short SHA-256 fingerprint of a public key — the "safety number" style check. */
export async function keyFingerprintB64(publicKeyB64: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", b64decode(publicKeyB64) as BufferSource);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24)
    .toUpperCase();
}

// ─── Image preprocessing (keep payloads small for the relay) ────────────────

export async function imageToPayload(file: File): Promise<MessagePayload> {
  const MAX_EDGE = 1600;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap || (bitmap.width <= MAX_EDGE && bitmap.height <= MAX_EDGE && file.size <= 900_000)) {
    const buf = await file.arrayBuffer();
    return { type: "image", mime: file.type || "image/jpeg", name: file.name, dataB64: b64encode(buf) };
  }
  const scale = MAX_EDGE / Math.max(bitmap.width, bitmap.height);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.85));
  return { type: "image", mime: "image/jpeg", name: file.name, dataB64: b64encode(await blob.arrayBuffer()) };
}

export function imageUrl(payload: MessagePayload): string | null {
  if (payload.type !== "image") return null;
  const blob = new Blob([b64decode(payload.dataB64) as BlobPart], { type: payload.mime });
  return URL.createObjectURL(blob);
}
