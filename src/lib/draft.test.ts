import { describe, expect, it } from "vitest";
import { clearDraft, draftStorageKey, loadDraft, saveDraft } from "./draft";

function memoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    get size() {
      return store.size;
    },
  };
}

describe("message composer drafts", () => {
  it("namespaces storage keys per conversation", () => {
    expect(draftStorageKey(42)).toBe("locat-draft:42");
    expect(draftStorageKey(1)).not.toBe(draftStorageKey(2));
  });

  it("round-trips a draft through storage", () => {
    const storage = memoryStorage();
    saveDraft(5, "hello", storage);
    expect(loadDraft(5, storage)).toBe("hello");
  });

  it("returns an empty string when nothing is stored", () => {
    const storage = memoryStorage();
    expect(loadDraft(99, storage)).toBe("");
  });

  it("removes the entry when saving an empty draft", () => {
    const storage = memoryStorage();
    saveDraft(7, "typing…", storage);
    saveDraft(7, "", storage);
    expect(loadDraft(7, storage)).toBe("");
    expect(storage.size).toBe(0);
  });

  it("drops drafts via clearDraft after send", () => {
    const storage = memoryStorage();
    saveDraft(3, "pending send", storage);
    clearDraft(3, storage);
    expect(storage.size).toBe(0);
  });

  it("caps very long drafts without throwing", () => {
    const storage = memoryStorage();
    const long = "x".repeat(10_000);
    saveDraft(1, long, storage);
    const restored = loadDraft(1, storage);
    expect(restored.length).toBeLessThanOrEqual(4096);
    expect(restored.startsWith("xxxx")).toBe(true);
  });

  it("swallows storage errors instead of breaking the composer", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadDraft(1, broken)).toBe("");
    expect(() => saveDraft(1, "ok", broken)).not.toThrow();
    expect(() => clearDraft(1, broken)).not.toThrow();
  });

  it("tolerates environments without storage", () => {
    expect(loadDraft(1, undefined)).toBe("");
    expect(() => saveDraft(1, "ok", undefined)).not.toThrow();
    expect(() => clearDraft(1, undefined)).not.toThrow();
  });
});
