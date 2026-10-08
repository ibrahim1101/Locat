/**
 * Client-side encrypted identity transfer for Locat Link Device.
 * This module does not authenticate or approve pairing requests; those checks
 * must be enforced by the server before the encrypted payload is relayed.
 */
import { b64decode, b64encode } from "./crypto";

const te = new TextEncoder();

export type LinkEphemeralKeys = {
  privateKey: CryptoKey;
  publicKey: string;
};

export async function newLinkEphemeralKeys(): Promise<LinkEphemeralKeys> {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"],
  );
  return {
    privateKey: pair.privateKey,
    publicKey: b64encode(await crypto.subtle.exportKey("spki", pair.publicKey)),
  };
}

async function transferKey(
  privateKey: CryptoKey,
  remotePublicKey: string,
  requestId: string,
  senderPublicKey: string,
  recipientPublicKey: string,
): Promise<CryptoKey> {
  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(requestId)) throw new Error("Invalid link request identifier");
  const remote = await crypto.subtle.importKey(
    "spki", b64decode(remotePublicKey) as BufferSource,
    { name: "ECDH", namedCurve: "P-256" }, false, [],
  );
  const secret = await crypto.subtle.deriveBits({ name: "ECDH", public: remote }, privateKey, 256);
  const base = await crypto.subtle.importKey("raw", secret, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF", hash: "SHA-256",
      salt: te.encode("locat-link-device-v1:" + requestId),
      info: te.encode(senderPublicKey + ":" + recipientPublicKey),
    },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
  );
}

export async function encryptLinkedIdentity(
  extractableIdentityPrivateKey: CryptoKey,
  sender: LinkEphemeralKeys,
  recipientPublicKey: string,
  requestId: string,
): Promise<string> {
  const key = await transferKey(sender.privateKey, recipientPublicKey, requestId, sender.publicKey, recipientPublicKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = await crypto.subtle.exportKey("pkcs8", extractableIdentityPrivateKey);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: te.encode(requestId) },
    key, plaintext,
  );
  return b64encode(te.encode(JSON.stringify({
    version: 1, senderPublicKey: sender.publicKey, iv: b64encode(iv), ciphertext: b64encode(ciphertext),
  })));
}

export async function decryptLinkedIdentity(
  encrypted: string,
  recipient: LinkEphemeralKeys,
  requestId: string,
): Promise<CryptoKey> {
  const payload = JSON.parse(new TextDecoder().decode(b64decode(encrypted))) as {
    version: number; senderPublicKey: string; iv: string; ciphertext: string;
  };
  if (payload.version !== 1) throw new Error("Unsupported link transfer version");
  const iv = b64decode(payload.iv);
  if (iv.length !== 12) throw new Error("Invalid link transfer nonce");
  const key = await transferKey(recipient.privateKey, payload.senderPublicKey, requestId, payload.senderPublicKey, recipient.publicKey);
  const pkcs8 = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource, additionalData: te.encode(requestId) },
    key, b64decode(payload.ciphertext) as BufferSource,
  );
  return crypto.subtle.importKey(
    "pkcs8", pkcs8, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"],
  );
}
