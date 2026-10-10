import { beforeEach, describe, expect, it } from "vitest";
import { clearAllDrafts, clearDraft, draftStorageKey, loadDraft, purgeLegacyDrafts, saveDraft } from "./draft";

beforeEach(() => clearAllDrafts());

describe("ephemeral message drafts", () => {
  it("isolates accounts and conversations", () => {
    expect(draftStorageKey(42, 7)).toBe("locat-draft:7:42");
    saveDraft(5, 7, "hello");
    expect(loadDraft(5, 7)).toBe("hello");
    expect(loadDraft(5, 8)).toBe("");
    expect(loadDraft(6, 7)).toBe("");
  });

  it("clears drafts on send and account transitions", () => {
    saveDraft(3, 7, "pending");
    clearDraft(3, 7);
    expect(loadDraft(3, 7)).toBe("");
    saveDraft(3, 7, "pending");
    clearAllDrafts();
    expect(loadDraft(3, 7)).toBe("");
  });

  it("limits draft length", () => {
    saveDraft(1, 7, "x".repeat(10000));
    expect(loadDraft(1, 7).length).toBe(4096);
  });

  it("purges legacy localStorage draft keys", () => {
    const entries = new Map([["locat-draft:1", "old"], ["other-setting", "keep"]]);
    const storage = {
      get length() { return entries.size; },
      key(i: number) { return [...entries.keys()][i] ?? null; },
      removeItem(k: string) { entries.delete(k); return; },
    };
    purgeLegacyDrafts(storage);
    expect(entries.has("locat-draft:1")).toBe(false);
    expect(entries.get("other-setting")).toBe("keep");
  });

  it("handles blocked legacy storage gracefully", () => {
    expect(() => purgeLegacyDrafts({
      get length() { throw new Error("blocked"); },
      key() { return null; },
      removeItem() { throw new Error("blocked"); },
    })).not.toThrow();
  });
});
