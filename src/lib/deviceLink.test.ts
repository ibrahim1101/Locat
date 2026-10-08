import { describe, expect, it } from "vitest";
import { generateIdentity, deriveDirectKey, encryptPayload, decryptPayload } from "./crypto";
import { newLinkEphemeralKeys, encryptLinkedIdentity, decryptLinkedIdentity, linkSafetyCode } from "./deviceLink";

describe("Link Device encrypted identity transfer", () => {
  it("transfers an identity only to the intended recipient", async () => {
    const identity = await generateIdentity();
    const peer = await generateIdentity();
    const sender = await newLinkEphemeralKeys();
    const recipient = await newLinkEphemeralKeys();
    const stranger = await newLinkEphemeralKeys();
    const requestId = crypto.randomUUID();
    const encrypted = await encryptLinkedIdentity(identity.privateKey, sender, recipient.publicKey, requestId);
    const restored = await decryptLinkedIdentity(encrypted, recipient, requestId);
    expect(restored.extractable).toBe(false);
    const outgoing = await deriveDirectKey(restored, peer.publicKeyB64, 1, 2);
    const incoming = await deriveDirectKey(peer.privateKey, identity.publicKeyB64, 1, 2);
    const payload = { type: "text" as const, text: "linked device" };
    expect(await decryptPayload(incoming, await encryptPayload(outgoing, payload))).toEqual(payload);
    await expect(decryptLinkedIdentity(encrypted, stranger, requestId)).rejects.toThrow();
    await expect(decryptLinkedIdentity(encrypted, recipient, crypto.randomUUID())).rejects.toThrow();
  });

  it("rejects modified ciphertext and unsupported protocol versions", async () => {
    const identity = await generateIdentity();
    const sender = await newLinkEphemeralKeys();
    const recipient = await newLinkEphemeralKeys();
    const requestId = crypto.randomUUID();
    const encrypted = await encryptLinkedIdentity(identity.privateKey, sender, recipient.publicKey, requestId);
    const data = JSON.parse(atob(encrypted));
    data.ciphertext = btoa("invalid ciphertext");
    await expect(decryptLinkedIdentity(btoa(JSON.stringify(data)), recipient, requestId)).rejects.toThrow();
    data.version = 2;
    await expect(decryptLinkedIdentity(btoa(JSON.stringify(data)), recipient, requestId)).rejects.toThrow("Unsupported");
  });
});

describe("Link Device safety comparison", () => {
  it("matches across devices and changes if the request or either key changes", async () => {
    const sender = await newLinkEphemeralKeys();
    const recipient = await newLinkEphemeralKeys();
    const stranger = await newLinkEphemeralKeys();
    const request = crypto.randomUUID();
    const code = await linkSafetyCode(request, sender.publicKey, recipient.publicKey);
    expect(code).toMatch(/^[A-F0-9]{5}-[A-F0-9]{5}$/);
    expect(code).toBe(await linkSafetyCode(request, sender.publicKey, recipient.publicKey));
    expect(code).not.toBe(await linkSafetyCode(crypto.randomUUID(), sender.publicKey, recipient.publicKey));
    expect(code).not.toBe(await linkSafetyCode(request, stranger.publicKey, recipient.publicKey));
    expect(code).not.toBe(await linkSafetyCode(request, sender.publicKey, stranger.publicKey));
  });
});
