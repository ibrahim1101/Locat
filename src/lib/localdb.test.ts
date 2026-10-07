import "fake-indexeddb/auto";
import { openDB } from "idb";
import { beforeEach, describe, expect, it } from "vitest";
import { applyMessageControl, applyReadReceipt, messageReference, allMessages, cacheConversations, cachedConversations, savePending, pendingMessages, completePending, deleteLocalMessage, importMessages, kvGet, kvSet, migrateLegacyHistory, storeMessage, wipeAll } from "./localdb";
import type { LocalMessage } from "./localdb";
import { hiddenConversationIds, setConversationHidden, setMessageHidden, getMessages, latestMessagePerConversation } from "./localdb";

const message: LocalMessage = { mid: 7, conversationId: 10, senderId: 1,
  senderName: "Alice", outgoing: true, payload: { type: "text", text: "hello" }, createdAt: 1000 };
beforeEach(async () => { await wipeAll(1); await wipeAll(2); });

describe("account-local history", () => {
  it("hides messages without deleting content and preserves choices through edits and imports", async () => {
    await storeMessage(1, message);
    await setMessageHidden(1, message.mid, true);
    expect((await getMessages(1, 10))[0].hidden).toBe(true);
    expect((await latestMessagePerConversation(1)).has(10)).toBe(false);
    expect((await allMessages(1))[0].payload).toEqual(message.payload);
    expect((await allMessages(1))[0].hidden).toBeUndefined();
    await applyMessageControl(1, 10, 1, { type: "control", version: 1, action: "edit", target: "legacy:7", text: "changed" }, 20, 2000);
    await importMessages(1, [message]);
    expect((await getMessages(1, 10))[0]).toMatchObject({ hidden: true, payload: { text: "changed" } });
    await storeMessage(2, message);
    expect((await getMessages(2, 10))[0].hidden).toBeUndefined();
    await setMessageHidden(1, 7, false);
    expect((await getMessages(1, 10))[0].hidden).toBeUndefined();
    expect((await latestMessagePerConversation(1)).get(10)?.payload).toMatchObject({ text: "changed" });
  });
  it("preserves hidden chats across deliveries and imports without sharing account settings", async () => {
    await setConversationHidden(1, 10, true);
    await setConversationHidden(1, 11, true);
    await storeMessage(1, message);
    await importMessages(1, [{ ...message, mid: 8 }]);
    expect((await hiddenConversationIds(1)).sort()).toEqual([10, 11]);
    expect(await hiddenConversationIds(2)).toEqual([]);
    await setConversationHidden(1, 10, false);
    expect(await hiddenConversationIds(1)).toEqual([11]);
    expect(await allMessages(1)).toHaveLength(2);
    await expect(setConversationHidden(1, -1, true)).rejects.toThrow("Invalid conversation");
  });
  it("keeps accounts separate, including unread state", async () => {
    await storeMessage(1, message);
    await kvSet(1, "lastRead", { "10": 7 });
    expect(await allMessages(2)).toEqual([]);
    expect(await kvGet(2, "lastRead")).toBeUndefined();
    await storeMessage(2, { ...message, outgoing: false });
    expect((await allMessages(2))[0].outgoing).toBe(false);
    expect((await allMessages(1))[0].outgoing).toBe(true);
  });
  it("deduplicates simultaneous delivery and import merges", async () => {
    const inserts = await Promise.all([storeMessage(1, message), storeMessage(1, message)]);
    expect(inserts.filter(Boolean)).toHaveLength(1);
    expect(await importMessages(1, [message, { ...message, mid: 8 }])).toBe(1);
    expect(await allMessages(1)).toHaveLength(2);
  });
  it("migrates only verified conversations without altering the legacy archive", async () => {
    const legacy = await openDB("relaychat", 1, { upgrade(db) {
      db.createObjectStore("messages", { keyPath: "mid" });
    } });
    await legacy.put("messages", message);
    await legacy.put("messages", { ...message, mid: 8, conversationId: 99 });
    await migrateLegacyHistory(2, [10]);
    expect(await allMessages(2)).toEqual([expect.objectContaining({ ...message, outgoing: false })]);
    expect(await legacy.count("messages")).toBe(2);
    await migrateLegacyHistory(2, [10, 99]);
    expect(await allMessages(2)).toHaveLength(1);
    legacy.close();
  });
});


describe("durable outbox", () => {
  it("keeps the original encrypted retry envelope scoped to the account", async () => {
    const pending = { clientMessageId: "stable-id", conversationId: 10, senderId: 1,
      senderName: "Alice", payload: message.payload, envelope: "same-ciphertext", createdAt: 1000 };
    await savePending(1, pending);
    expect(await pendingMessages(1)).toEqual([pending]);
    expect(await pendingMessages(2)).toEqual([]);
    await completePending(1, pending.clientMessageId, message);
    expect(await pendingMessages(1)).toEqual([]);
    expect(await allMessages(1)).toHaveLength(1);
  });
  it("handles a server echo arriving before send confirmation", async () => {
    await savePending(1, { clientMessageId: "echo", conversationId: 10, senderId: 1,
      senderName: "Alice", payload: message.payload, envelope: "ciphertext", createdAt: 1000 });
    await storeMessage(1, message);
    await completePending(1, "echo", message);
    expect(await allMessages(1)).toHaveLength(1);
    expect(await pendingMessages(1)).toEqual([]);
    await deleteLocalMessage(1, message.mid);
    expect(await allMessages(1)).toEqual([]);
  });
});


describe("archived memberships",()=>{
  it("retains local conversation metadata when membership ends",async()=>{
    const conversation={id:10,type:"group" as const,name:"Saved group",createdAt:new Date(1000),members:[],wrappedKey:null,wrappedBy:null};
    await cacheConversations(1,[conversation]);
    await cacheConversations(1,[]);
    expect(await cachedConversations(1)).toEqual([{...conversation,archived:true}]);
    expect(await cachedConversations(2)).toEqual([]);
    await cacheConversations(1,[conversation]);
    expect((await cachedConversations(1))[0].archived).toBe(false);
  });
});


describe("encrypted message controls", () => {
  it("projects authenticated member read receipts only onto my matching message", async () => {
    await storeMessage(1, message);
    const target = messageReference(message);
    await applyReadReceipt(1, 10, 2, target);
    await applyReadReceipt(1, 10, 2, target);
    expect((await allMessages(1))[0].readBy).toEqual([2]);
    await applyReadReceipt(1, 10, 3, "legacy:999");
    expect((await allMessages(1))[0].readBy).toEqual([2]);
  });
  it("requires original authorship and conversation scope", async () => {
    await storeMessage(1, message);
    const target = messageReference(message);
    await applyMessageControl(1, 10, 2, { type: "control", version: 1, action: "delete", target }, 20, 2000);
    await applyMessageControl(1, 11, 1, { type: "control", version: 1, action: "delete", target }, 21, 2000);
    expect((await allMessages(1))[0].payload).toEqual(message.payload);
    await applyMessageControl(1, 10, 1, { type: "control", version: 1, action: "edit", target, text: "changed" }, 22, 2000);
    expect((await allMessages(1))[0]).toMatchObject({ payload: { text: "changed" }, editedAt: 2000 });
    expect(await allMessages(2)).toEqual([]);
  });
  it("orders early edits and prevents deletion resurrection through replay/import", async () => {
    const target = messageReference(message);
    await applyMessageControl(1, 10, 1, { type: "control", version: 1, action: "edit", target, text: "latest" }, 22, 2000);
    await applyMessageControl(1, 10, 1, { type: "control", version: 1, action: "edit", target, text: "older" }, 21, 1900);
    await storeMessage(1, message);
    expect((await allMessages(1))[0].payload).toMatchObject({ text: "latest" });
    await applyMessageControl(1, 10, 1, { type: "control", version: 1, action: "delete", target }, 23, 2100);
    await applyMessageControl(1, 10, 1, { type: "control", version: 1, action: "edit", target, text: "resurrect" }, 24, 2200);
    expect((await allMessages(1))[0]).toMatchObject({ deleted: true, payload: { text: "Message deleted" } });
    await deleteLocalMessage(1, message.mid);
    await importMessages(1, [message]);
    expect((await allMessages(1))[0].deleted).toBe(true);
  });
  it("retires pending controls atomically and projects a later original", async () => {
    const control = { type: "control" as const, version: 1 as const, action: "delete" as const, target: messageReference(message) };
    await savePending(1, { clientMessageId: "control-retry", conversationId: 10, senderId: 1, senderName: "Alice", payload: { type: "text", text: "" }, control, envelope: "encrypted", createdAt: 1000 });
    await applyMessageControl(1, 10, 1, control, 20, 2000, "control-retry");
    await completePending(1, "original", message);
    expect(await pendingMessages(1)).toEqual([]);
    expect((await allMessages(1))[0].deleted).toBe(true);
  });
});
