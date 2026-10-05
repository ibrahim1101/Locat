import "fake-indexeddb/auto";
import { openDB } from "idb";
import { beforeEach, describe, expect, it } from "vitest";
import { allMessages, importMessages, kvGet, kvSet, migrateLegacyHistory, storeMessage, wipeAll } from "./localdb";
import type { LocalMessage } from "./localdb";

const message: LocalMessage = { mid: 7, conversationId: 10, senderId: 1,
  senderName: "Alice", outgoing: true, payload: { type: "text", text: "hello" }, createdAt: 1000 };
beforeEach(async () => { await wipeAll(1); await wipeAll(2); });

describe("account-local history", () => {
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
