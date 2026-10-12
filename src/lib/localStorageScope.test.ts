import "fake-indexeddb/auto";
import { openDB } from "idb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateIdentity } from "./crypto";
let native = true, origin = "https://a.example";
const userId = 701;
beforeEach(() => {
  native = true; origin = "https://a.example";
  vi.resetModules(); vi.stubGlobal("window", {});
  vi.doMock("./native", () => ({ isNativeShell: () => native, nativeServerUrl: () => origin }));
});
afterEach(() => { vi.doUnmock("./native"); vi.unstubAllGlobals(); vi.resetModules(); });
async function reload() { vi.resetModules(); return import("./localdb"); }
describe("native server and account device isolation", () => {
  it("isolates identity, device keys, history, privacy and durable outbox for overlapping account IDs", async () => {
    let db = await reload(); await db.wipeAll(userId);
    const keys = await generateIdentity();
    const message = { mid: 7, conversationId: 10, senderId: userId, senderName: "Alice", outgoing: true,
      payload: { type: "text" as const, text: "server A history" }, createdAt: 1000 };
    await db.saveIdentity(userId, keys); await db.saveDeviceKeys(userId, keys);
    await db.storeMessage(userId, message); await db.setConversationHidden(userId, 10, true);
    await db.savePending(userId, { clientMessageId: crypto.randomUUID(), conversationId: 10,
      senderId: userId, senderName: "Alice", payload: message.payload, envelope: "A ciphertext", createdAt: 1 });
    const scopeA = (await import("./localStorageScope")).offlineAccountStorageKey();
    origin = "https://b.example"; db = await reload(); await db.wipeAll(userId);
    expect((await import("./localStorageScope")).offlineAccountStorageKey()).not.toBe(scopeA);
    expect(await db.loadIdentity(userId)).toBeUndefined(); expect(await db.loadDeviceKeys(userId)).toBeUndefined();
    expect(await db.allMessages(userId)).toEqual([]); expect(await db.hiddenConversationIds(userId)).toEqual([]);
    expect(await db.pendingMessages(userId)).toEqual([]);
    await db.kvSet(userId, "lastRead", "server B");
    origin = "https://a.example/"; db = await reload();
    expect(await db.loadIdentity(userId)).toBeDefined(); expect(await db.loadDeviceKeys(userId)).toBeDefined();
    expect(await db.allMessages(userId)).toHaveLength(1); expect(await db.pendingMessages(userId)).toHaveLength(1);
    expect(await db.hiddenConversationIds(userId)).toEqual([10]); expect(await db.kvGet(userId, "lastRead")).toBeUndefined();
    expect(await db.allMessages(userId + 1)).toEqual([]);
    await db.wipeAll(userId);
  });
  it("rejects a hot server change so stale asynchronous work cannot access another host's storage", async () => {
    const db = await reload(); await db.kvSet(userId, "inflight", "A");
    origin = "https://b.example";
    await expect(db.kvGet(userId, "inflight")).rejects.toThrow("Restart Locat");
    await expect(db.kvSet(userId, "inflight", "stale A write")).rejects.toThrow("Restart Locat");
    origin = "http://b.example";
    await expect(db.kvGet(userId, "inflight")).rejects.toThrow("HTTPS");
  });
  it("preserves unscoped native archives without guessing ownership from numeric IDs", async () => {
    const old = await openDB(`locat-account-${userId}`, 2, { upgrade(d) { d.createObjectStore("identity"); d.createObjectStore("kv"); } });
    const keys = await generateIdentity(); await old.put("identity", keys, userId); await old.put("kv", "old private content", "sentinel");
    const legacy = await openDB("relaychat", 1, { upgrade(d) { d.createObjectStore("identity"); } });
    await legacy.put("identity", keys, userId);
    const db = await reload(); await db.wipeAll(userId);
    expect(await db.loadIdentity(userId)).toBeUndefined();
    expect(await db.kvGet(userId, "sentinel")).toBeUndefined();
    await db.migrateLegacyHistory(userId, [10]);
    expect(await old.get("kv", "sentinel")).toBe("old private content");
    expect(await old.get("identity", userId)).toBeDefined(); expect(await legacy.get("identity", userId)).toBeDefined();
    old.close(); legacy.close();
  });
  it("preserves browser database and offline-cache names because browser origins are already isolated", async () => {
    native = false;
    const scope = await import("./localStorageScope");
    expect(scope.localAccountDatabaseName(1)).toBe("locat-account-1");
    expect(scope.offlineAccountStorageKey()).toBe("locat-offline-account");
    expect(() => scope.localAccountDatabaseName(0)).toThrow("account");
  });
});
