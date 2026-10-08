/**
 * Locat Quick Sign-In cryptographic primitives.
 *
 * A randomly generated 256-bit secret is the only recovery credential.
 * The server receives a domain-separated SHA-256 verifier, never the secret.
 * The encrypted PKCS#8 backup is independently wrapped client-side with
 * a key derived from the secret using PBKDF2-SHA256 and AES-256-GCM.
 *
 * Not connected to authentication endpoints until the server-side credential
 * lifecycle, rate limiting, revocation, and account recovery tests are ready.
 */
import { b64decode, b64encode, type IdentityKeys } from "./crypto";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const PREFIX = "LQ1";
const ITERATIONS = 310_000;

export function generateQuickSignInKey(): string {
  const secret = crypto.getRandomValues(new Uint8Array(32));
  const encoded = Array.from(secret, byte => byte.toString(16).padStart(2, "0").toUpperCase()).join("");
  return `${PREFIX}-${encoded.match(/.{1,8}/g)!.join("-")}`;
}

export function parseQuickSignInKey(value: string): Uint8Array {
  const normalized = value.trim().toUpperCase().replace(/[-\s]/g, "");
  if (!/^LQ1[0-9A-F]{64}$/.test(normalized)) {
    throw new Error("Invalid Locat Quick Sign-In Key.");
  }
  const hex = normalized.slice(3);
  return Uint8Array.from(hex.match(/../g)!, pair => Number.parseInt(pair, 16));
}

export async function quickSignInVerifier(value: string): Promise<string> {
  const secret = parseQuickSignInKey(value);
  const domain = encoder.encode("locat-quick-signin-verifier-v1:");
  const bytes = new Uint8Array(domain.length + secret.length);
  bytes.set(domain);
  bytes.set(secret, domain.length);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function wrappingKey(secret: Uint8Array, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", secret as BufferSource, "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: ITERATIONS },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function wrapQuickSignInIdentity(keys: IdentityKeys, code: string): Promise<string> {
  const secret = parseQuickSignInKey(code);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await wrappingKey(secret, salt);
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", keys.privateKey);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, pkcs8);
  return b64encode(encoder.encode(JSON.stringify({
    version: 1, salt: b64encode(salt), iv: b64encode(iv), ciphertext: b64encode(ciphertext),
  })));
}

export async function unwrapQuickSignInIdentity(blob: string, code: string): Promise<CryptoKey> {
  const secret = parseQuickSignInKey(code);
  const envelope = JSON.parse(decoder.decode(b64decode(blob))) as {
    version: number; salt: string; iv: string; ciphertext: string;
  };
  if (envelope.version !== 1) throw new Error("Unsupported Quick Sign-In backup version.");
  const salt = b64decode(envelope.salt);
  const iv = b64decode(envelope.iv);
  if (salt.length !== 16 || iv.length !== 12) throw new Error("Invalid Quick Sign-In backup.");
  const key = await wrappingKey(secret, salt);
  const pkcs8 = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    b64decode(envelope.ciphertext) as BufferSource,
  );
  return crypto.subtle.importKey("pkcs8", pkcs8, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
}
