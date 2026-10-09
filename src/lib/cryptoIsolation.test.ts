import { describe, expect, it } from "vitest";
import {
  generateIdentity,
  deriveDirectKey,
  encryptPayload,
  decryptPayload,
  generateGroupKey,
} from "./crypto";

/**
 * Security regression checks kept independent of the original crypto tests.
 * They protect properties that must survive Locat 2.0 UI/module changes.
 */
describe("Locat 2.0 cryptographic isolation regressions", () => {
  it("does not allow a third device to decrypt a peer-to-peer message", async () => {
    const alice = await generateIdentity();
    const bob = await generateIdentity();
    const mallory = await generateIdentity();
    const aliceToBob = await deriveDirectKey(alice.privateKey, bob.publicKeyB64, 1, 2);
    const bobFromAlice = await deriveDirectKey(bob.privateKey, alice.publicKeyB64, 2, 1);
    const malloryFromAlice = await deriveDirectKey(mallory.privateKey, alice.publicKeyB64, 3, 1);
    const payload = { type: "text" as const, text: "confidential peer message" };
    const sealed = await encryptPayload(aliceToBob, payload);
    expect(await decryptPayload(bobFromAlice, sealed)).toEqual(payload);
    await expect(decryptPayload(malloryFromAlice, sealed)).rejects.toThrow();
  });

  it("rejects ciphertext tampering and nonce substitution", async () => {
    const key = await generateGroupKey();
    const sealed = JSON.parse(await encryptPayload(key, { type: "text", text: "integrity" }));
    const flip = (s: string) => (s[0] === "A" ? "B" : "A") + s.slice(1);
    await expect(decryptPayload(key, JSON.stringify({ ...sealed, data: flip(sealed.data) }))).rejects.toThrow();
    await expect(decryptPayload(key, JSON.stringify({ ...sealed, iv: flip(sealed.iv) }))).rejects.toThrow();
  });

  it("uses fresh authenticated encryption nonces for repeated plaintext", async () => {
    const key = await generateGroupKey();
    const payload = { type: "text" as const, text: "same message" };
    const first = JSON.parse(await encryptPayload(key, payload));
    const second = JSON.parse(await encryptPayload(key, payload));
    expect(first.iv).not.toBe(second.iv);
    expect(first.data).not.toBe(second.data);
    expect(await decryptPayload(key, JSON.stringify(first))).toEqual(payload);
    expect(await decryptPayload(key, JSON.stringify(second))).toEqual(payload);
  });
});
