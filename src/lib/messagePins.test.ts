import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { messageControlSchema } from "@contracts/messagePayload";
import { visiblePins } from "./messagePins";
import { applyMessageControl, getMessages, importMessages, storeMessage, wipeAll } from "./localdb";
import { encodeArchive, decodeArchive } from "./archive";
import { encryptPayload, decryptPayload } from "./crypto";
import type { LocalMessage } from "./localdb";
const ref = "4f01d9dd-7c0a-4d31-a787-ecc2081e527e";
const message: LocalMessage = { mid: 10, conversationId: 10, senderId: 1, senderName: "Alice", outgoing: true,
  createdAt: 1000, payload: { type: "text", text: "original", messageRef: ref } };
const pin = { type: "control" as const, version: 1 as const, action: "pin" as const,
  target: ref, targetSenderId: 1, pinned: true };
beforeEach(async () => { await wipeAll(1); await wipeAll(2); });
describe("encrypted shared pins", () => {
  it("uses the encrypted bounded contract and rejects actor claims", async () => {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    const sealed = await encryptPayload(key, pin);
    expect(sealed).not.toContain(ref); expect(await decryptPayload(key, sealed)).toEqual(pin);
    expect(messageControlSchema.safeParse({ ...pin, actorId: 8 }).success).toBe(false);
    expect(messageControlSchema.safeParse({ ...pin, pinned: "yes" }).success).toBe(false);
  });
  it("persists controls before their target and resolves cross-member changes by relay order", async () => {
    await applyMessageControl(1, 10, 2, pin, 20, 2000);
    await storeMessage(1, message);
    expect((await getMessages(1, 10))[0].pin).toEqual({ pinned: true, actorId: 2, mid: 20 });
    await applyMessageControl(1, 10, 3, { ...pin, pinned: false }, 22, 2100);
    await applyMessageControl(1, 10, 2, pin, 20, 2000);
    expect((await getMessages(1, 10))[0].pin).toEqual({ pinned: false, actorId: 3, mid: 22 });
  });
  it("does not cross account/conversation/author boundaries or reveal hidden/deleted pins", async () => {
    await storeMessage(1, message);
    await storeMessage(1, { ...message, mid: 11, senderId: 4 });
    await storeMessage(2, message);
    await applyMessageControl(1, 10, 2, pin, 20, 2000);
    const rows = await getMessages(1, 10);
    expect(visiblePins(rows, 10).map(m => m.mid)).toEqual([10]);
    expect(visiblePins(rows, 11)).toEqual([]);
    expect(rows.find(m => m.mid === 11)?.pin).toBeUndefined();
    expect((await getMessages(2, 10))[0].pin).toBeUndefined();
    expect(visiblePins([{ ...rows[0], hidden: true }], 10)).toEqual([]);
    expect(visiblePins([{ ...rows[0], deleted: true }], 10)).toEqual([]);
  });
  it("preserves newer unpin state through backup/restore and ignores older replay", async () => {
    const account = { userId: 1, username: "alice", origin: "https://locat.example" };
    const rows = await decodeArchive(await encodeArchive(account,
      [{ ...message, pin: { pinned: false, actorId: 3, mid: 25 } }], "backup-password-long"), account, "backup-password-long");
    await importMessages(1, rows);
    await applyMessageControl(1, 10, 2, pin, 20, 2000);
    expect((await getMessages(1, 10))[0].pin).toEqual({ pinned: false, actorId: 3, mid: 25 });
  });
});
