import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { generateIdentity } from "./crypto";
import { draftScope } from "./encryptedDraft";
import { kvGet, kvSet, kvKeys, putBoundedKv, wipeAll } from "./localdb";
import { forgetScheduledCopy, listScheduledCopies, loadScheduledCopy, saveScheduledCopy, type ScheduledCopy } from "./scheduledDrafts";
const server = "https://locat.example";
const slot = (id: string) => `scheduled-copy:v1:${draftScope(server, 1)}:${id}`;
const make = (): ScheduledCopy => ({ directKeyContext: "a".repeat(64), clientMessageId: crypto.randomUUID(), conversationId: 9,
  deliverAt: "2026-10-13T10:00:00.000Z", envelope: '{"ciphertext":"original exact request"}',
  payload: { type: "text", text: "private recovery text 🐈" } });
beforeEach(async () => { await wipeAll(1); await wipeAll(2); });
describe("encrypted scheduled request recovery", () => {
  it("keeps the exact sealed request across reload while isolating server, account and identity", async () => {
    const identity = await generateIdentity(), copy = make();
    await saveScheduledCopy(identity, server, 1, copy);
    expect(JSON.stringify(await kvGet(1, slot(copy.clientMessageId)))).not.toContain("private recovery");
    expect(JSON.stringify(await kvGet(1, slot(copy.clientMessageId)))).not.toContain("original exact request");
    expect(await loadScheduledCopy(identity, server + "/", 1, copy.clientMessageId)).toEqual(copy);
    expect(await loadScheduledCopy(identity, "https://other.example", 1, copy.clientMessageId)).toBeUndefined();
    expect(await loadScheduledCopy(identity, server, 2, copy.clientMessageId)).toBeUndefined();
    await expect(loadScheduledCopy(await generateIdentity(), server, 1, copy.clientMessageId)).rejects.toThrow();
  });
  it("authenticates the slot, rejects tampering and reports unreadable copies without hiding healthy requests", async () => {
    const identity = await generateIdentity(), copy = make(), other = make();
    await saveScheduledCopy(identity, server, 1, copy);
    const record = await kvGet<Record<string, unknown>>(1, slot(copy.clientMessageId));
    await kvSet(1, slot(other.clientMessageId), record!);
    await expect(loadScheduledCopy(identity, server, 1, other.clientMessageId)).rejects.toThrow();
    expect(await listScheduledCopies(identity, server, 1)).toEqual({ copies: [copy], errors: 1 });
    await kvSet(1, slot(copy.clientMessageId), { ...record, data: "AAAA" });
    await expect(loadScheduledCopy(identity, server, 1, copy.clientMessageId)).rejects.toThrow();
    await forgetScheduledCopy(server, 1, copy.clientMessageId);
    expect(await loadScheduledCopy(identity, server, 1, copy.clientMessageId)).toBeUndefined();
  });
  it("atomically bounds simultaneous local writes without charging other namespaces or rejecting replacement", async () => {
    await kvSet(1, "unrelated", "x");
    const result = await Promise.allSettled(Array.from({ length: 4 }, (_, i) => putBoundedKv(1, `bound:${i}`, "bound:", { i }, 2)));
    expect(result.filter(r => r.status === "fulfilled")).toHaveLength(2);
    expect((await kvKeys(1)).filter(k => String(k).startsWith("bound:"))).toHaveLength(2);
    await putBoundedKv(1, "bound:0", "bound:", { replaced: true }, 2);
    expect(await kvGet(1, "bound:0")).toEqual({ replaced: true });
    await expect(putBoundedKv(1, "other:0", "bound:", {}, 2)).rejects.toThrow("namespace");
  });
  it("rejects attachment payloads and oversize text before persistence", async () => {
    const identity = await generateIdentity();
    await expect(saveScheduledCopy(identity, server, 1, { ...make(), payload: { type: "text", text: "x".repeat(4097) } })).rejects.toThrow();
    expect(await kvKeys(1)).toHaveLength(0);
  });
});
