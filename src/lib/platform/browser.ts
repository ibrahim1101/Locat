// Browser / installed PWA adapter. Uses only Web Platform APIs. Secure
// storage falls back to localStorage; callers must not treat this as OS
// keychain-grade protection. Native Capacitor / Tauri adapters are picked
// up automatically when the runtime exposes their globals.

import { downloadBlob } from "@/lib/download";
import type {
  PlatformAdapter,
  PlatformCapabilities,
  PlatformKind,
  PlatformNotification,
  SaveResult,
} from "./index";
import { UnsupportedCapability } from "./index";

function capabilities(kind: PlatformKind): PlatformCapabilities {
  const notificationsOk = typeof Notification !== "undefined" && Notification.permission === "granted";
  return {
    nativeNotifications: notificationsOk,
    nativeFileSave: false, // Browser 'save as' is best-effort via <a download>.
    nativeOpenExternal: typeof window !== "undefined" && typeof window.open === "function",
    nativeSecureStorage: false,
    systemTray: false,
    deepLinks: kind === "web-installed",
    signedUpdates: kind === "web-installed", // Service worker + manifest updates.
  };
}

const SECRET_PREFIX = "locat-platform-secret:";

export function browserAdapter(kind: PlatformKind): PlatformAdapter {
  return {
    kind,
    label: kind === "web-installed" ? "Installed PWA (browser-managed)" : "Browser (web)",
    capabilities: capabilities(kind),
    async saveBlob(blob: Blob, filename: string): Promise<SaveResult> {
      const destination = await downloadBlob(blob, filename);
      return { destination: destination === "selected-folder" ? "selected-folder" : "downloads" };
    },
    async openExternal(url: string): Promise<void> {
      // Opening with noopener prevents the opened page from reaching back into
      // the Locat window. We intentionally do not await window focus.
      window.open(url, "_blank", "noopener,noreferrer");
    },
    async showNotification(input: PlatformNotification): Promise<void> {
      if (typeof Notification === "undefined" || Notification.permission !== "granted") {
        throw new UnsupportedCapability("nativeNotifications");
      }
      new Notification(input.title, {
        body: input.body,
        tag: input.tag,
      });
    },
    async readSecret(key: string): Promise<string | null> {
      try {
        return localStorage.getItem(SECRET_PREFIX + key);
      } catch {
        return null;
      }
    },
    async writeSecret(key: string, value: string): Promise<void> {
      try {
        localStorage.setItem(SECRET_PREFIX + key, value);
      } catch {
        throw new UnsupportedCapability("nativeSecureStorage");
      }
    },
    async deleteSecret(key: string): Promise<void> {
      try {
        localStorage.removeItem(SECRET_PREFIX + key);
      } catch {
        // Non-fatal; absence of a secret is the goal.
      }
    },
  };
}
