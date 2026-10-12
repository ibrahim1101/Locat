import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { messageControlSchema } from "@contracts/messagePayload";
import { reactionSummary } from "./messageReactions";
import { storeMessage, applyMessageControl, getMessages, importMessages, wipeAll, savePending, pendingMessages } from "./localdb";
import { encodeArchive, decodeArchive } from "./archive";
import { encryptPayload, decryptPayload } from "./crypto";
import type { LocalMessage } from "./localdb";
const target = "4f01d9dd-7c0a-4d31-a787-ecc2081e527e";
const message: LocalMessage = { mid: 10, conversationId: 10, senderId: 1, senderName: "Alice", outgoing: true,
  createdAt: 1000, payload: { type: "text", text: "hello", messageRef: target } };
const react = { type: "control" as const, version: 1 as const, action: "reaction" as const,
  target, targetSenderId: 1, emoji: "👍" as const };
beforeEach(async () => { await wipeAll(1); await wipeAll(2); });
describe("encrypted reactions", () => {
  it("encrypts the bounded contract and rejects spoofed actor fields or arbitrary text", async () => {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    const sealed = await encryptPayload(key, react);
    expect(sealed).not.toContain(target); expect(sealed).not.toContain("👍");
    expect(await decryptPayload(key, sealed)).toEqual(react);
    expect(messageControlSchema.safeParse({ ...react, actorId: 99 }).success).toBe(false);
    expect(messageControlSchema.safeParse({ ...react, emoji: "script" }).success).toBe(false);
    expect(messageControlSchema.safeParse({ ...react, targetSenderId: 0 }).success).toBe(false);
  });
  it("updates only the authenticated actor and ignores older/repeated changes", async () => {
    await storeMessage(1, message);
    await applyMessageControl(1, 10, 2, react, 20, 2000);
    await applyMessageControl(1, 10, 3, { ...react, emoji: "❤️" }, 21, 2000);
    await applyMessageControl(1, 10, 2, { ...react, emoji: null }, 23, 2200);
    await applyMessageControl(1, 10, 2, react, 20, 2000);
    await applyMessageControl(1, 10, 2, react, 23, 2200);
    const row = (await getMessages(1, 10))[0];
    expect(row.reactions).toEqual({ "2": { emoji: null, mid: 23 }, "3": { emoji: "❤️", mid: 21 } });
    expect(reactionSummary(row.reactions, 3)).toEqual([{ emoji: "❤️", count: 1, mine: true }]);
    expect(row.payload).toEqual(message.payload);
  });
  it("applies reactions arriving before their target and scopes account/conversation/author", async () => {
    await applyMessageControl(1, 10, 2, react, 20, 2000);
    await storeMessage(1, message);
    await storeMessage(1, { ...message, mid: 11, conversationId: 11 });
    await storeMessage(1, { ...message, mid: 12, senderId: 4 });
    await storeMessage(2, message);
    expect((await getMessages(1, 10)).find(m => m.mid === 10)?.reactions?.["2"].emoji).toBe("👍");
    expect((await getMessages(1, 10)).find(m => m.mid === 12)?.reactions).toBeUndefined();
    expect((await getMessages(1, 11))[0].reactions).toBeUndefined();
    expect((await getMessages(2, 10))[0].reactions).toBeUndefined();
  });
  it("retires pending events atomically and does not bypass author-only deletion", async () => {
    await storeMessage(1, message);
    await savePending(1, { clientMessageId: "pending-reaction", conversationId: 10, senderId: 2,
      senderName: "Bob", payload: { type: "text", text: "" }, control: react, envelope: "opaque", createdAt: 2000 });
    await applyMessageControl(1, 10, 2, react, 20, 2000, "pending-reaction");
    expect(await pendingMessages(1)).toHaveLength(0);
    await applyMessageControl(1, 10, 2, { type: "control", version: 1, action: "delete", target }, 21, 2200);
    expect((await getMessages(1, 10))[0].deleted).toBeUndefined();
    await applyMessageControl(1, 10, 1, { type: "control", version: 1, action: "delete", target }, 22, 2400);
    await applyMessageControl(1, 10, 2, { ...react, emoji: "😂" }, 23, 2600);
    expect((await getMessages(1, 10))[0].deleted).toBe(true);
  });
  it("retains removal order in encrypted backup/restore and rejects stale events after restore", async () => {
    const account = { userId: 1, username: "alice", origin: "https://locat.example" };
    const original = { ...message, reactions: { "2": { emoji: null, mid: 25 } } };
    const rows = await decodeArchive(await encodeArchive(account, [original], "backup-password-long"), account, "backup-password-long");
    await importMessages(1, rows);
    await applyMessageControl(1, 10, 2, react, 20, 2000);
    expect((await getMessages(1, 10))[0].reactions?.["2"]).toEqual({ emoji: null, mid: 25 });
  });
});
