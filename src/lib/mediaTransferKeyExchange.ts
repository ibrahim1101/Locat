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

/** SHA-256 digest to display/compare over an independent authenticated channel.
 * A fingerprint alone does not authenticate a peer: the trusted value must
 * be obtained out-of-band or signed by a previously pinned device identity. */
export async function mediaKeyFingerprint(publicKeyRaw: ArrayBuffer): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", publicKeyRaw));
  return Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
}
export async function verifyMediaPeerFingerprint(publicKeyRaw: ArrayBuffer, expectedFingerprint: string): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/.test(expectedFingerprint)) return false;
  const actual = await mediaKeyFingerprint(publicKeyRaw);
  let difference = 0;
  for (let i = 0; i < 64; i++) difference |= actual.charCodeAt(i) ^ expectedFingerprint.charCodeAt(i);
  return difference === 0;
}

/**
 * Fail-closed transfer key derivation. The expected fingerprint MUST come from
 * an independently authenticated device identity (e.g. a previously pinned
 * identity key or an out-of-band comparison), never from the signal itself.
 */
export async function deriveVerifiedMediaSessionKey(
  privateKey: CryptoKey,
  peerPublicKeyRaw: ArrayBuffer,
  expectedPeerFingerprint: string,
  transferId: string,
  initiatorDeviceId: number,
  receiverDeviceId: number,
): Promise<CryptoKey> {
  if (!(await verifyMediaPeerFingerprint(peerPublicKeyRaw, expectedPeerFingerprint))) {
    throw new Error("Untrusted media transfer peer key");
  }
  return deriveMediaSessionKey(privateKey, peerPublicKeyRaw, transferId, initiatorDeviceId, receiverDeviceId);
}
