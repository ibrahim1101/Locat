import { describe, expect, it, beforeEach } from "vitest";
import { DEFAULT_PREFS, savePrefs } from "./notificationPrefs";
import { shouldShowForegroundToast, updateAppBadge } from "./foregroundNotify";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

// Point the prefs loader at an in-memory store for deterministic decisions.
beforeEach(() => {
  const store = memoryStorage();
  Object.defineProperty(globalThis, "localStorage", { value: store, configurable: true });
  Object.defineProperty(globalThis, "window", {
    value: { dispatchEvent: () => true },
    configurable: true,
  });
});

describe("foreground toast decision", () => {
  it("shows a message toast for a different conversation while visible", () => {
    savePrefs(DEFAULT_PREFS);
    expect(
      shouldShowForegroundToast(
        { category: "messages", conversationId: 5 },
        { activeConversationId: 9, documentVisible: true },
      ),
    ).toBe(true);
  });

  it("suppresses the toast for the conversation the user is reading", () => {
    savePrefs(DEFAULT_PREFS);
    expect(
      shouldShowForegroundToast(
        { category: "messages", conversationId: 5 },
        { activeConversationId: 5, documentVisible: true },
      ),
    ).toBe(false);
  });

  it("suppresses toasts when the tab is hidden (push channel owns that case)", () => {
    savePrefs(DEFAULT_PREFS);
    expect(
      shouldShowForegroundToast(
        { category: "messages", conversationId: 5 },
        { activeConversationId: 9, documentVisible: false },
      ),
    ).toBe(false);
  });

  it("respects the foreground-alerts master toggle", () => {
    savePrefs({ ...DEFAULT_PREFS, foregroundAlerts: false });
    expect(
      shouldShowForegroundToast(
        { category: "messages", conversationId: 5 },
        { activeConversationId: 9, documentVisible: true },
      ),
    ).toBe(false);
  });

  it("respects per-conversation mute", () => {
    savePrefs({ ...DEFAULT_PREFS, mutedConversationIds: [5] });
    expect(
      shouldShowForegroundToast(
        { category: "messages", conversationId: 5 },
        { activeConversationId: 9, documentVisible: true },
      ),
    ).toBe(false);
  });

  it("respects category toggles for sentinel alerts", () => {
    savePrefs({
      ...DEFAULT_PREFS,
      categories: { ...DEFAULT_PREFS.categories, sentinel: false },
    });
    expect(
      shouldShowForegroundToast(
        { category: "sentinel" },
        { activeConversationId: null, documentVisible: true },
      ),
    ).toBe(false);
    savePrefs(DEFAULT_PREFS);
    expect(
      shouldShowForegroundToast(
        { category: "sentinel" },
        { activeConversationId: null, documentVisible: true },
      ),
    ).toBe(true);
  });

  it("respects quiet hours", () => {
    const now = new Date();
    now.setHours(2, 30, 0, 0);
    savePrefs({
      ...DEFAULT_PREFS,
      quietHours: { enabled: true, startHour: 22, endHour: 7 },
    });
    expect(
      shouldShowForegroundToast(
        { category: "messages", conversationId: 5 },
        { activeConversationId: 9, documentVisible: true, now },
      ),
    ).toBe(false);
  });
});

describe("app badge", () => {
  it("sets and clears the badge when the API exists", async () => {
    const calls: number[] = [];
    const nav = {
      setAppBadge: async (n?: number) => {
        calls.push(n ?? -1);
      },
      clearAppBadge: async () => {
        calls.push(-2);
      },
    } as unknown as Navigator;
    updateAppBadge(3, nav);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calls).toEqual([3]);
    updateAppBadge(0, nav);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calls).toEqual([3, -2]);
  });

  it("is a no-op when the Badging API is unavailable", () => {
    expect(() => updateAppBadge(3, {} as Navigator)).not.toThrow();
    expect(() => updateAppBadge(3, undefined)).not.toThrow();
  });
});
