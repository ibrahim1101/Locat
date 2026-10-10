import { describe, expect, it, beforeEach } from "vitest";
import {
  DEFAULT_PREFS,
  NOTIFICATION_CATEGORIES,
  inQuietHours,
  isConversationMuted,
  loadPrefs,
  savePrefs,
  shouldNotify,
  toggleMutedConversation,
  updatePrefs,
} from "./notificationPrefs";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    get size() {
      return map.size;
    },
  };
}

describe("notification preferences persistence", () => {
  let storage: ReturnType<typeof memoryStorage>;
  beforeEach(() => {
    storage = memoryStorage();
  });

  it("returns default preferences when no entry is stored", () => {
    expect(loadPrefs(storage)).toEqual(DEFAULT_PREFS);
  });

  it("round-trips updated preferences", () => {
    const patched = updatePrefs({ foregroundAlerts: false }, storage);
    expect(patched.foregroundAlerts).toBe(false);
    expect(loadPrefs(storage).foregroundAlerts).toBe(false);
  });

  it("merges partial category overrides with defaults", () => {
    updatePrefs({ categories: { ...DEFAULT_PREFS.categories, sentinel: false } }, storage);
    const loaded = loadPrefs(storage);
    expect(loaded.categories.sentinel).toBe(false);
    expect(loaded.categories.messages).toBe(true);
    expect(NOTIFICATION_CATEGORIES.map((c) => c.id)).toEqual([
      "messages",
      "sentinel",
      "sessions",
      "transfers",
      "system",
    ]);
  });

  it("clamps quiet hours to legal 24h slots", () => {
    const next = updatePrefs({ quietHours: { enabled: true, startHour: 36, endHour: -4 } }, storage);
    expect(next.quietHours.startHour).toBe(23);
    expect(next.quietHours.endHour).toBe(0);
  });

  it("ignores corrupt stored payloads and returns defaults", () => {
    storage.setItem("locat-notification-prefs-v1", "{not-json");
    expect(loadPrefs(storage)).toEqual(DEFAULT_PREFS);
  });

  it("tolerates environments without storage", () => {
    expect(loadPrefs(undefined)).toEqual(DEFAULT_PREFS);
    expect(() => savePrefs(DEFAULT_PREFS, undefined)).not.toThrow();
  });
});

describe("muted conversations", () => {
  let storage: ReturnType<typeof memoryStorage>;
  beforeEach(() => {
    storage = memoryStorage();
  });

  it("adds and removes conversation ids on toggle", () => {
    const added = toggleMutedConversation(42, storage);
    expect(isConversationMuted(42, added)).toBe(true);
    const removed = toggleMutedConversation(42, storage);
    expect(isConversationMuted(42, removed)).toBe(false);
  });

  it("keeps the muted list sorted and unique", () => {
    toggleMutedConversation(3, storage);
    toggleMutedConversation(1, storage);
    const prefs = toggleMutedConversation(2, storage);
    expect(prefs.mutedConversationIds).toEqual([1, 2, 3]);
    const noop = toggleMutedConversation(2, storage); // remove 2
    expect(noop.mutedConversationIds).toEqual([1, 3]);
  });
});

describe("quiet hours", () => {
  it("is off when not enabled", () => {
    expect(inQuietHours(new Date(2026, 0, 1, 2, 0), { enabled: false, startHour: 22, endHour: 7 })).toBe(false);
  });

  it("respects same-day windows", () => {
    const quiet = { enabled: true, startHour: 13, endHour: 15 };
    expect(inQuietHours(new Date(2026, 0, 1, 12, 59), quiet)).toBe(false);
    expect(inQuietHours(new Date(2026, 0, 1, 13, 0), quiet)).toBe(true);
    expect(inQuietHours(new Date(2026, 0, 1, 14, 59), quiet)).toBe(true);
    expect(inQuietHours(new Date(2026, 0, 1, 15, 0), quiet)).toBe(false);
  });

  it("respects overnight windows", () => {
    const quiet = { enabled: true, startHour: 22, endHour: 7 };
    expect(inQuietHours(new Date(2026, 0, 1, 21, 59), quiet)).toBe(false);
    expect(inQuietHours(new Date(2026, 0, 1, 22, 0), quiet)).toBe(true);
    expect(inQuietHours(new Date(2026, 0, 1, 3, 0), quiet)).toBe(true);
    expect(inQuietHours(new Date(2026, 0, 1, 7, 0), quiet)).toBe(false);
  });

  it("treats a zero-length window as off", () => {
    const quiet = { enabled: true, startHour: 10, endHour: 10 };
    expect(inQuietHours(new Date(2026, 0, 1, 10, 30), quiet)).toBe(false);
  });
});

describe("shouldNotify", () => {
  it("blocks a category when the user disables it", () => {
    const prefs = { ...DEFAULT_PREFS, categories: { ...DEFAULT_PREFS.categories, messages: false } };
    expect(shouldNotify({ category: "messages", conversationId: 1 }, prefs)).toBe(false);
    expect(shouldNotify({ category: "sentinel" }, prefs)).toBe(true);
  });

  it("blocks a muted conversation even when the category is on", () => {
    const prefs = { ...DEFAULT_PREFS, mutedConversationIds: [7] };
    expect(shouldNotify({ category: "messages", conversationId: 7 }, prefs)).toBe(false);
    expect(shouldNotify({ category: "messages", conversationId: 8 }, prefs)).toBe(true);
  });

  it("blocks everything during quiet hours", () => {
    const prefs = { ...DEFAULT_PREFS, quietHours: { enabled: true, startHour: 10, endHour: 12 } };
    expect(shouldNotify({ category: "messages", conversationId: 1 }, prefs, new Date(2026, 0, 1, 11, 0))).toBe(false);
    expect(shouldNotify({ category: "messages", conversationId: 1 }, prefs, new Date(2026, 0, 1, 13, 0))).toBe(true);
  });

  it("passes system and sentinel events outside quiet hours when enabled", () => {
    expect(shouldNotify({ category: "sentinel" }, DEFAULT_PREFS)).toBe(true);
    expect(shouldNotify({ category: "system" }, DEFAULT_PREFS)).toBe(true);
  });
});
