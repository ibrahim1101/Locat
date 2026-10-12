import { describe, expect, it } from "vitest";
import { forwardPayload, forwardDestinations } from "./messageForwarding";
import { encryptPayload, decryptPayload } from "./crypto";
import type { ConversationSummary } from "@contracts/types";
const ref = "4f01d9dd-7c0a-4d31-a787-ecc2081e527e";
const member = (id: number) => ({ id, username: `user${id}`, displayName: `User ${id}`, lcCode: null, bio: null, publicKey: "public" });
const chat = (id: number): ConversationSummary => ({ id, type: "direct", name: null, createdAt: new Date(),
  members: [member(1), member(id + 1)], wrappedKey: null, wrappedBy: null });
describe("explicit forwarding copies", () => {
  it("copies validated content and drops original message/reply context", () => {
    expect(forwardPayload({ type: "text", text: "copy", messageRef: ref, replyTo: { target: ref, senderId: 2 } }))
      .toEqual({ type: "text", text: "copy", forwarded: true });
    expect(forwardPayload({ type: "location", latitude: 1, longitude: 2, accuracyMeters: 3, capturedAt: 4 }))
      .toEqual({ type: "location", latitude: 1, longitude: 2, accuracyMeters: 3, capturedAt: 4, forwarded: true });
    expect(() => forwardPayload({ type: "file", name: "a", mime: "text/plain", size: 1, dataB64: "bad" })).toThrow();
  });
  it("includes only current owned destinations and excludes hidden, blocked, archived or stale-key chats", () => {
    const chats = [chat(1), chat(2), chat(3), { ...chat(4), archived: true }, { ...chat(5), rotationRequired: true },
      { ...chat(6), members: [member(99)] }, { ...chat(7), type: "group" as const }];
    expect(forwardDestinations(chats, 1, new Set([2]), new Set([4])).map(conv => conv.id)).toEqual([1, 7]);
  });
  it("seals the forwarded copy under the destination key with a fresh reference", async () => {
    const sourceKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    const destinationKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    const copy = { ...forwardPayload({ type: "text", text: "private copy", messageRef: ref }), messageRef: crypto.randomUUID() };
    expect(copy.messageRef).not.toBe(ref);
    const sealed = await encryptPayload(destinationKey, copy);
    expect(sealed).not.toContain("private copy");
    expect(await decryptPayload(destinationKey, sealed)).toEqual(copy);
    await expect(decryptPayload(sourceKey, sealed)).rejects.toThrow();
  });
});
