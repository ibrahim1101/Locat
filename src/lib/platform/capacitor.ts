// Capacitor Android adapter. Wraps the browser adapter and only overrides
// behaviours that benefit from the native WebView bridge. Concrete plugin
// wiring (Local Notifications, Secure Storage) is added in a follow-up
// commit when the Capacitor plugins are installed and gradle-synced; this
// adapter advertises those capabilities as `false` until that happens so
// callers continue to use the honest fallbacks.

import type { PlatformAdapter, PlatformCapabilities } from "./index";
import { browserAdapter } from "./browser";

const base = browserAdapter("capacitor-android");

const capabilities: PlatformCapabilities = {
  ...base.capabilities,
  // Capacitor's Notification API requires a plugin + runtime permission.
  // Expose it as unavailable until wired in a follow-up commit.
  nativeNotifications: base.capabilities.nativeNotifications,
  nativeFileSave: true, // Backed by the existing storagePreference folder bridge.
  nativeOpenExternal: true,
  nativeSecureStorage: false,
  systemTray: false,
  deepLinks: true,
  signedUpdates: true,
};

export const capacitorAdapter: PlatformAdapter = {
  ...base,
  kind: "capacitor-android",
  label: "Capacitor Android (WebView)",
  capabilities,
};
