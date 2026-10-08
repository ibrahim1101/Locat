import { describe, expect, it } from "vitest";
import { deriveDirectKey, encryptPayload, decryptPayload, generateIdentity } from "./crypto";
import {
  generateQuickSignInKey, parseQuickSignInKey, quickSignInVerifier,
  wrapQuickSignInIdentity, unwrapQuickSignInIdentity,
} from "./quickSignIn";

describe("Quick Sign-In Key cryptography", () => {
  it("generates unique 256-bit secrets and stable server verifiers", async () => {
    const first = generateQuickSignInKey();
    const second = generateQuickSignInKey();
    expect(first).toMatch(/^LQ1-(?:[A-F0-9]{8}-){7}[A-F0-9]{8}$/);
    expect(parseQuickSignInKey(first)).toHaveLength(32);
    expect(second).not.toBe(first);
    const verifier = await quickSignInVerifier(first);
    expect(verifier).toMatch(/^[0-9a-f]{64}$/);
    expect(verifier).toBe(await quickSignInVerifier(first.toLowerCase().replace(/-/g, "")));
    expect(verifier).not.toContain(first.slice(4, 12));
  });

  it("rejects malformed or low-entropy user-supplied codes", () => {
    for (const input of ["1234", "LQ1-1234", "", "LQ1-" + "Z".repeat(64), "LQ1-" + "A".repeat(63)]) {
      expect(() => parseQuickSignInKey(input)).toThrow("Invalid");
    }
  });

  it("restores the same encrypted messaging identity without exporting its restored private key", async () => {
    const original = await generateIdentity();
    const peer = await generateIdentity();
    const code = generateQuickSignInKey();
    const encrypted = await wrapQuickSignInIdentity(original, code);
    expect(encrypted).not.toContain(code);
    const restored = await unwrapQuickSignInIdentity(encrypted, code);
    expect(restored.extractable).toBe(false);
    const direct = await deriveDirectKey(restored, peer.publicKeyB64, 1, 2);
    const recipient = await deriveDirectKey(peer.privateKey, original.publicKeyB64, 1, 2);
    const message = { type: "text" as const, text: "recovered securely" };
    expect(await decryptPayload(recipient, await encryptPayload(direct, message))).toEqual(message);
    await expect(unwrapQuickSignInIdentity(encrypted, generateQuickSignInKey())).rejects.toThrow();
  });

  it("uses independent random salts and nonces for separate backups", async () => {
    const identity = await generateIdentity();
    const code = generateQuickSignInKey();
    const a = await wrapQuickSignInIdentity(identity, code);
    const b = await wrapQuickSignInIdentity(identity, code);
    expect(a).not.toBe(b);
  });

  it("rejects modified ciphertext", async () => {
    const identity = await generateIdentity();
    const code = generateQuickSignInKey();
    const blob = await wrapQuickSignInIdentity(identity, code);
    const payload = JSON.parse(atob(blob));
    payload.ciphertext = btoa("tampered ciphertext");
    const modified = btoa(JSON.stringify(payload));
    await expect(unwrapQuickSignInIdentity(modified, code)).rejects.toThrow();
  });
});
