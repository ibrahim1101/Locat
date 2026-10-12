import { describe, expect, it } from "vitest";
import { replyPreview } from "./messageReplies";
import { messagePayloadSchema } from "@contracts/messagePayload";
import { encryptPayload, decryptPayload } from "./crypto";
import { encodeArchive, decodeArchive } from "./archive";
import type { LocalMessage } from "./localdb";
const ref = "4f01d9dd-7c0a-4d31-a787-ecc2081e527e";
const reply = { target: ref, senderId: 1 };
const original: LocalMessage = { mid: 10, conversationId: 10, senderId: 1, senderName: "Alice",
  outgoing: false, createdAt: 1000, payload: { type: "text", text: "original", messageRef: ref } };
describe("encrypted reply references", () => {
  it("resolves the author within the current conversation and tracks the current edited text", () => {
    expect(replyPreview(reply, [original], 10)).toEqual({ label: "Alice", text: "original", mid: 10 });
    expect(replyPreview(reply, [{ ...original, payload: { ...original.payload, type: "text", text: "edited" } }], 10).text).toBe("edited");
    expect(replyPreview(reply, [original], 11).mid).toBeUndefined();
    expect(replyPreview({ ...reply, senderId: 2 }, [original], 10).mid).toBeUndefined();
  });
  it("never exposes hidden/deleted originals and supports a missing or legacy target", () => {
    expect(replyPreview(reply, [{ ...original, hidden: true }], 10).text).toBe("");
    expect(replyPreview(reply, [{ ...original, deleted: true }], 10)).toEqual({ label: "Message deleted", text: "", mid: undefined });
    expect(replyPreview(reply, [], 10).mid).toBeUndefined();
    expect(replyPreview({ target: "legacy:10", senderId: 1 }, [{ ...original, payload: { type: "text", text: "legacy" } }], 10).mid).toBe(10);
  });
  it("validates bounded references and encrypts them without retaining a quoted original", async () => {
    const payload = { type: "text" as const, text: "answer", replyTo: reply };
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    const sealed = await encryptPayload(key, payload);
    expect(sealed).not.toContain(ref); expect(sealed).not.toContain("answer");
    expect(await decryptPayload(key, sealed)).toEqual(payload);
    expect(messagePayloadSchema.safeParse({ ...payload, replyTo: { ...reply, quote: "original" } }).success).toBe(false);
    expect(messagePayloadSchema.safeParse({ ...payload, replyTo: { ...reply, senderId: 0 } }).success).toBe(false);
    expect(messagePayloadSchema.safeParse({ ...payload, replyTo: { ...reply, target: "invalid" } }).success).toBe(false);
  });
  it("retains references through encrypted backup restoration", async () => {
    const account = { userId: 1, username: "alice", origin: "https://locat.example" };
    const row = { ...original, mid: 11, payload: { type: "text" as const, text: "answer", replyTo: reply } };
    const recovered = await decodeArchive(await encodeArchive(account, [row], "backup-password-long"), account, "backup-password-long");
    expect(recovered[0].payload.replyTo).toEqual(reply);
  });
});
