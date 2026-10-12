import { describe, expect, it } from "vitest";
import { createEphemeralMediaKeyPair, exportEphemeralMediaPublicKey, deriveMediaSessionKey, mediaKeyFingerprint, deriveVerifiedMediaSessionKey } from "./mediaTransferKeyExchange";
import { encryptMediaChunk, decryptMediaChunk } from "./mediaTransferCrypto";

describe("ephemeral media session key agreement", () => {
  it("derives matching keys on both peers for one authenticated context", async () => {
    const a = await createEphemeralMediaKeyPair();
    const b = await createEphemeralMediaKeyPair();
    const [aPublic, bPublic] = await Promise.all([
      exportEphemeralMediaPublicKey(a.publicKey), exportEphemeralMediaPublicKey(b.publicKey),
    ]);
    const aKey = await deriveMediaSessionKey(a.privateKey, bPublic, "transfer-1", 101, 102);
    const bKey = await deriveMediaSessionKey(b.privateKey, aPublic, "transfer-1", 101, 102);
    const payload = new Uint8Array([5, 6, 7]).buffer;
    const chunk = await encryptMediaChunk(aKey, "transfer-1", 0, payload);
    expect(new Uint8Array(await decryptMediaChunk(bKey, "transfer-1", chunk))).toEqual(new Uint8Array(payload));
    const wrongContextKey = await deriveMediaSessionKey(b.privateKey, aPublic, "transfer-2", 101, 102);
    await expect(decryptMediaChunk(wrongContextKey, "transfer-1", chunk)).rejects.toThrow();
  });
  it("fails closed for an untrusted peer key", async () => {
    const a = await createEphemeralMediaKeyPair();
    const b = await createEphemeralMediaKeyPair();
    const c = await createEphemeralMediaKeyPair();
    const bPublic = await exportEphemeralMediaPublicKey(b.publicKey);
    const trusted = await mediaKeyFingerprint(await exportEphemeralMediaPublicKey(c.publicKey));
    await expect(deriveVerifiedMediaSessionKey(a.privateKey, bPublic, trusted, "transfer-1", 101, 102)).rejects.toThrow("Untrusted");
    const verified = await deriveVerifiedMediaSessionKey(a.privateKey, bPublic, await mediaKeyFingerprint(bPublic), "transfer-1", 101, 102);
    expect(verified.algorithm.name).toBe("AES-GCM");
  });
  it("rejects invalid session contexts", async () => {
    const a = await createEphemeralMediaKeyPair();
    const b = await createEphemeralMediaKeyPair();
    const peer = await exportEphemeralMediaPublicKey(b.publicKey);
    await expect(deriveMediaSessionKey(a.privateKey, peer, "", 101, 102)).rejects.toThrow();
    await expect(deriveMediaSessionKey(a.privateKey, peer, "id", 101, 101)).rejects.toThrow();
  });
});
