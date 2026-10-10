import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const prefsPanel = readFileSync(fileURLToPath(new URL("../components/chat/NotificationPreferences.tsx", import.meta.url)), "utf8");
const dialog = readFileSync(fileURLToPath(new URL("../components/chat/StorageDialog.tsx", import.meta.url)), "utf8");
const chatWindow = readFileSync(fileURLToPath(new URL("../components/chat/ChatWindow.tsx", import.meta.url)), "utf8");

describe("notification preferences UI", () => {
  it("mounts the preferences panel inside the Settings & backups dialog", () => {
    expect(dialog).toContain('import { NotificationPreferences } from "./NotificationPreferences"');
    expect(dialog).toContain("<NotificationPreferences />");
  });

  it("exposes category toggles, quiet-hours and foreground alerts", () => {
    for (const id of [
      "notification-prefs",
      "notif-foreground",
      "notif-categories",
      "notif-quiet-hours",
      "notif-quiet-enabled",
      "notif-quiet-start",
      "notif-quiet-end",
      "muted-conversations-summary",
    ]) {
      expect(prefsPanel).toContain(`data-testid="${id}"`);
    }
    // Category testIDs are interpolated per-category; check the template.
    expect(prefsPanel).toContain('data-testid={`notif-category-${cat.id}`}');
    // Categories themselves are centralised in notificationPrefs.ts; the
    // panel imports NOTIFICATION_CATEGORIES rather than hard-coding them.
    expect(prefsPanel).toContain("NOTIFICATION_CATEGORIES");
  });

  it("documents that preferences stay on the device, not the server", () => {
    expect(prefsPanel).toContain("These settings stay on this device");
    expect(prefsPanel).toContain("The server never sees message");
  });
});

describe("per-conversation mute", () => {
  it("renders a mute toggle in the chat header toolbar", () => {
    expect(chatWindow).toContain('data-testid="conversation-mute-toggle"');
    expect(chatWindow).toContain("import { Bell, BellOff } from \"lucide-react\"");
    expect(chatWindow).toContain("toggleMutedConversation(conversation.id)");
    expect(chatWindow).toContain("isConversationMuted(conversation.id, loadPrefs())");
  });

  it("responds to PREFS_EVENT changes made from the Settings dialog", () => {
    expect(chatWindow).toContain('window.addEventListener(PREFS_EVENT, refresh)');
  });
});
