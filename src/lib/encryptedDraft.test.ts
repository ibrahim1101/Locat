import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { draftScope, loadEncryptedDraft, saveEncryptedDraft } from "./encryptedDraft";
import { generateIdentity } from "./crypto";
import { kvGet, kvSet, wipeAll } from "./localdb";
const server = "https://locat.example";
beforeEach(async () => { await wipeAll(1); await wipeAll(2); });
const storage = (conv: number) => `encrypted-draft:v1:${draftScope(server, 1)}:${conv}`;
describe("persistent encrypted device drafts", () => {
  it("persists ciphertext and restores with the same identity after navigation", async () => {
    const identity = await generateIdentity();
    await saveEncryptedDraft(identity, server, 1, 5, "private unsent draft 🐈");
    const raw = await kvGet(1, storage(5));
    expect(JSON.stringify(raw)).not.toContain("private unsent");
    expect(await loadEncryptedDraft(identity, server, 1, 5)).toBe("private unsent draft 🐈");
    expect(await loadEncryptedDraft(identity, "https://other.example", 1, 5)).toBe("");
    expect(await loadEncryptedDraft(identity, server, 2, 5)).toBe("");
    expect(await loadEncryptedDraft(identity, server, 1, 6)).toBe("");
    await expect(loadEncryptedDraft(await generateIdentity(), server, 1, 5)).rejects.toThrow();
  });
  it("authenticates conversation context and rejects modified ciphertext", async () => {
    const identity = await generateIdentity();
    await saveEncryptedDraft(identity, server, 1, 5, "secret");
    const raw = await kvGet<Record<string, unknown>>(1, storage(5));
    await kvSet(1, storage(6), raw!);
    await expect(loadEncryptedDraft(identity, server, 1, 6)).rejects.toThrow();
    await kvSet(1, storage(5), { ...raw, data: "AAAA" });
    await expect(loadEncryptedDraft(identity, server, 1, 5)).rejects.toThrow();
  });
  it("serializes edits and deletion so stale writes cannot restore a sent draft", async () => {
    const identity = await generateIdentity();
    await Promise.all([saveEncryptedDraft(identity, server, 1, 5, "first"),
      saveEncryptedDraft(identity, server, 1, 5, "latest"), saveEncryptedDraft(identity, server, 1, 5, "")]);
    expect(await loadEncryptedDraft(identity, server, 1, 5)).toBe("");
    expect(await kvGet(1, storage(5))).toBeUndefined();
    await saveEncryptedDraft(identity, server, 1, 5, "x".repeat(10_000));
    expect((await loadEncryptedDraft(identity, server, 1, 5)).length).toBe(4096);
    await wipeAll(1);
    expect(await loadEncryptedDraft(identity, server, 1, 5)).toBe("");
  });
  it("normalizes equivalent origins and rejects invalid identifiers and schemes", () => {
    expect(draftScope("https://locat.example/", 1)).toBe(draftScope(server, 1));
    for (const url of ["file:///tmp", "javascript:foo", "https://user:pass@example.test"]) expect(() => draftScope(url, 1)).toThrow();
    expect(() => draftScope(server, 0)).toThrow();
  });
});
