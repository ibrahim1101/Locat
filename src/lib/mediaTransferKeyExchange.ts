/**
 * Ephemeral ECDH + HKDF key derivation for a single media transfer.
 *
 * SECURITY: Public keys MUST be authenticated against the verified paired
 * device identity by the signaling layer. ECDH alone is vulnerable to MITM.
 * Never persist or transmit private keys or derived AES keys.
 */
const enc = new TextEncoder();
export async function createEphemeralMediaKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
}
export async function exportEphemeralMediaPublicKey(publicKey: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.exportKey("raw", publicKey);
}
export async function deriveMediaSessionKey(
  privateKey: CryptoKey, peerPublicKeyRaw: ArrayBuffer,
  transferId: string, initiatorDeviceId: number, receiverDeviceId: number,
): Promise<CryptoKey> {
  if (!transferId || transferId.length > 128) throw new Error("Invalid transfer ID");
  if (![initiatorDeviceId, receiverDeviceId].every(n => Number.isSafeInteger(n) && n > 0) || initiatorDeviceId === receiverDeviceId) throw new Error("Invalid device IDs");
  const peerPublicKey = await crypto.subtle.importKey("raw", peerPublicKeyRaw, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const secret = await crypto.subtle.deriveBits({ name: "ECDH", public: peerPublicKey }, privateKey, 256);
  const base = await crypto.subtle.importKey("raw", secret, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({
    name: "HKDF", hash: "SHA-256",
    salt: enc.encode("Locat media transfer v1"),
    info: enc.encode(JSON.stringify([transferId, initiatorDeviceId, receiverDeviceId])),
  }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
