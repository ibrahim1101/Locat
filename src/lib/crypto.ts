import { downloadBlob } from "@/lib/download";
// ─── End-to-end encryption layer (WebCrypto) ───────────────────────────────
// Everything here runs on the device. The server only ever sees:
//   - public keys (directory)
//   - private keys wrapped with a password-derived key (backup blob)
//   - AES-GCM envelopes it cannot open
import type { EncryptedEnvelope, MessagePayload } from "@contracts/types";
import { decodeBrowserImage } from "./browserImage";
import { relayPayloadSchema, type MessageControl } from "@contracts/messagePayload";

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
  if (!globalThis.crypto?.subtle) {
    throw new Error("Open Locat over HTTPS to enable encryption. HTTP only works on localhost.");
  }
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

/** Deterministic pairwise key. Legacy protocol salts preserve existing ciphertext. */
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

export async function encryptPayload(key: CryptoKey, payload: MessagePayload | MessageControl): Promise<string> {
  const validated = relayPayloadSchema.parse(payload);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, te.encode(JSON.stringify(validated)));
  const envelope: EncryptedEnvelope = { v: 1, iv: b64encode(iv), data: b64encode(data) };
  return JSON.stringify(envelope);
}

export async function decryptPayload(key: CryptoKey, envelopeJson: string): Promise<MessagePayload | MessageControl> {
  const envelope: EncryptedEnvelope = JSON.parse(envelopeJson);
  if (!envelope || envelope.v !== 1 || typeof envelope.iv !== "string" || typeof envelope.data !== "string") {
    throw new Error("Unsupported or malformed message envelope");
  }
  if (b64decode(envelope.iv).byteLength !== 12) throw new Error("Invalid message nonce");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64decode(envelope.iv) as BufferSource },
    key,
    b64decode(envelope.data) as BufferSource,
  );
  const payload: unknown = JSON.parse(td.decode(plain));
  const validated = relayPayloadSchema.safeParse(payload);
  if (!validated.success) throw new Error("Unsupported or malformed message payload");
  return validated.data;
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

/** MIME types that can render inline in every supported browser/WebView. */
export const SUPPORTED_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"] as const;
export type SupportedImageMime = (typeof SUPPORTED_IMAGE_MIMES)[number];

/**
 * Normalise a sender-reported MIME type. Android's share sheet and some
 * gallery pickers hand us HEIC photos (`image/heic`) or an empty type with a
 * content URI; storing those verbatim would make the message fail the relay
 * schema or render as "Unsupported image format" on the receiving device.
 * Returns the supported MIME unchanged, or null when the caller must
 * re-encode (JPEG) instead.
 */
export function normalizeImageMime(mime: string | undefined | null): SupportedImageMime | null {
  if (!mime) return null;
  const lower = mime.toLowerCase();
  return (SUPPORTED_IMAGE_MIMES as readonly string[]).includes(lower) ? (lower as SupportedImageMime) : null;
}

/**
 * Sniff the real image format from magic bytes. Payload MIME labels can be
 * wrong when a sender's OS reported an empty or generic type, so the
 * receiving preview decides on bytes, not on the label.
 */
export function sniffImageMime(bytes: Uint8Array): SupportedImageMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  // AVIF / HEIC share the ISO BMFF box: ... "ftyp" + brand.
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = String.fromCharCode(...bytes.subarray(8, 12));
    if (brand === "avif" || brand === "avis") return "image/avif";
  }
  return null;
}

/** MIME values allowed on the outbound download blob; anything else degrades to octet-stream. */
export function sanitizeAttachmentMime(mime: string): string {
  return /^[\w!#$&^+-]{1,100}\/[\w!#$&^+.-]{1,100}$/.test(mime) ? mime : "application/octet-stream";
}

export async function imageToPayload(file: File): Promise<MessagePayload> {
  const MAX_EDGE = 1600;
  const bitmap = await decodeBrowserImage(file);
  try {
  const safeMime = normalizeImageMime(file.type);
  // Keep the original bytes only when the format is inline-renderable on
  // every client. Unknown or HEIC-type images are always re-encoded so
  // receivers never see "Unsupported image format" for a valid picture.
  if (safeMime && bitmap.width <= MAX_EDGE && bitmap.height <= MAX_EDGE && file.size <= 900_000) {
    const buf = await file.arrayBuffer();
    return { type: "image", mime: safeMime, name: file.name, dataB64: b64encode(buf) };
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image editing is unavailable in this browser.");
  context.fillStyle = "#ffffff"; context.fillRect(0, 0, w, h);
  context.drawImage(bitmap.image, 0, 0, w, h);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Could not prepare this image.")), "image/jpeg", 0.85));
  return { type: "image", mime: "image/jpeg", name: file.name, dataB64: b64encode(await blob.arrayBuffer()) };
  } finally { bitmap.close(); }
}

export function imageUrl(payload: MessagePayload): string | null {
  if (payload.type !== "image") return null;
  const bytes = b64decode(payload.dataB64);
  // Trust the bytes, not the label: sniff the real format first, fall back
  // to the declared MIME when sniffing is inconclusive but allowed.
  const mime = sniffImageMime(bytes) ?? normalizeImageMime(payload.mime);
  if (!mime) return null;
  const blob = new Blob([bytes as BlobPart], { type: mime });
  return URL.createObjectURL(blob);
}

export async function voiceToPayload(blob: Blob, durationMs: number): Promise<MessagePayload> {
  const mime = blob.type.split(";")[0];
  if (!["audio/webm", "audio/ogg", "audio/mp4"].includes(mime))
    throw new Error("This browser's voice recording format is not supported.");
  if (durationMs < 250) throw new Error("Voice message is too short.");
  if (durationMs > 60_000) throw new Error("Voice messages are limited to 60 seconds.");
  if (blob.size > 2_900_000) throw new Error("Voice message is too large. Try a shorter recording.");
  return { type: "voice", mime: mime as "audio/webm" | "audio/ogg" | "audio/mp4",
    dataB64: b64encode(await blob.arrayBuffer()), durationMs: Math.round(durationMs) };
}

export function voiceUrl(payload: MessagePayload): string | null {
  if (payload.type !== "voice" || !["audio/webm", "audio/ogg", "audio/mp4"].includes(payload.mime)) return null;
  return URL.createObjectURL(new Blob([b64decode(payload.dataB64) as BlobPart], { type: payload.mime }));
}

function safeAttachmentName(name: string): string {
  const cleaned = Array.from(name, (char) => {
    const code = char.charCodeAt(0);
    return char === "/" || char === "\\" || code <= 31 || code === 127 ? "_" : char;
  }).join("").trim();
  return (cleaned || "attachment").slice(0, 255);
}

export async function fileToPayload(file: File): Promise<MessagePayload> {
  if (!file.size) throw new Error("This file is empty.");
  if (file.size > 2_900_000) throw new Error("Files above 2.9 MB will use Locat's upcoming chunked attachment transfer.");
  return {
    type: "file",
    mime: (file.type || "application/octet-stream").slice(0, 255),
    name: safeAttachmentName(file.name),
    size: file.size,
    dataB64: b64encode(await file.arrayBuffer()),
  };
}

export async function downloadFilePayload(payload: MessagePayload): Promise<void> {
  if (payload.type !== "file") return;
  // Preserve the real content type so Android / desktop file managers can
  // hand the attachment to the right app; anything malformed degrades to a
  // safe octet-stream label.
  const blob = new Blob([b64decode(payload.dataB64) as BlobPart], { type: sanitizeAttachmentMime(payload.mime) });
  await downloadBlob(blob, safeAttachmentName(payload.name));
}
