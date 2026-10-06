import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, newSessionToken } from "../../api/crypto";
import {
  generateIdentity, deriveDirectKey, encryptPayload, decryptPayload,
  wrapPrivateKeyForBackup, unwrapPrivateKeyBackup,
  generateGroupKey, wrapGroupKey, unwrapGroupKey,
} from "./crypto";

describe("Locat encryption", () => {
  it("restores an identity and decrypts a direct message on the peer", async () => {
    const alice = await generateIdentity();
    const bob = await generateIdentity();
    const backup = await wrapPrivateKeyForBackup(alice, "a-long-test-password");
    const restored = await unwrapPrivateKeyBackup(backup.encryptedPrivateKey, backup.keySalt, "a-long-test-password");
    expect(restored.extractable).toBe(false);
    const sending = await deriveDirectKey(restored, bob.publicKeyB64, 1, 2);
    const receiving = await deriveDirectKey(bob.privateKey, alice.publicKeyB64, 2, 1);
    const envelope = await encryptPayload(sending, { type: "text", text: "hello Locat" });
    expect(await decryptPayload(receiving, envelope)).toEqual({ type: "text", text: "hello Locat" });
    await expect(unwrapPrivateKeyBackup(backup.encryptedPrivateKey, backup.keySalt, "wrong-password")).rejects.toThrow();
  });

  it("wraps a group key for a recipient and rejects tampered messages", async () => {
    const alice = await generateIdentity();
    const bob = await generateIdentity();
    const group = await generateGroupKey();
    const wrapped = await wrapGroupKey(group, alice.privateKey, bob.publicKeyB64);
    const received = await unwrapGroupKey(wrapped, bob.privateKey, alice.publicKeyB64);
    const envelope = await encryptPayload(group, { type: "text", text: "group hello" });
    expect(await decryptPayload(received, envelope)).toEqual({ type: "text", text: "group hello" });
    const altered = JSON.parse(envelope);
    altered.data = (altered.data[0] === "A" ? "B" : "A") + altered.data.slice(1);
    await expect(decryptPayload(received, JSON.stringify(altered))).rejects.toThrow();
  });

  it("rejects future envelope versions instead of acknowledging unreadable data", async () => {
    const key = await generateGroupKey();
    const envelope = JSON.parse(await encryptPayload(key, { type: "text", text: "hello" }));
    await expect(decryptPayload(key, JSON.stringify({ ...envelope, v: 2 }))).rejects.toThrow("Unsupported");
    await expect(decryptPayload(key, "null")).rejects.toThrow("malformed");
    await expect(decryptPayload(key, JSON.stringify({ ...envelope, iv: "AA==" }))).rejects.toThrow("nonce");
  });

  it("rejects authenticated but malformed payloads before durable delivery ACK", async () => {
    const key = await generateGroupKey();
    const seal = async (payload: unknown) => {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key,
        new TextEncoder().encode(JSON.stringify(payload)));
      return JSON.stringify({ v: 1, iv: Buffer.from(iv).toString("base64"), data: Buffer.from(data).toString("base64") });
    };
    for (const payload of [null, { type: "text", text: 42 }, { type: "delete", target: 1 },
      { type: "image", mime: "image/png", name: "a", dataB64: "!invalid!" },
      { type: "image", mime: "image/svg+xml", name: "a", dataB64: "AA==" },
      { type: "image", mime: "image/png", name: "a", dataB64: "A" },
      { type: "text", text: "a".repeat(1_000_001) },
      { type: "text", text: "hello", hiddenControl: "delete" }]) {
      await expect(decryptPayload(key, await seal(payload))).rejects.toThrow();
    }
    const image = { type: "image", mime: "image/png", name: "a", dataB64: "AA==" };
    expect(await decryptPayload(key, await seal(image))).toEqual(image);
  });

  it("verifies password hashes and generates unique session tokens", async () => {
    const hash = await hashPassword("test-password");
    expect(await verifyPassword("test-password", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
    expect(newSessionToken()).not.toBe(newSessionToken());
  });
});
