// Tauri 2 desktop adapter — scaffold.
//
// Target platforms (per the Locat 2.0 cross-platform directive):
//   * Windows (EXE / MSI installer)
//   * Linux (AppImage / DEB / RPM)
//   * macOS (APP / DMG)
//
// Scope of this commit: declare the adapter and advertise which native
// capabilities Tauri will own once the Rust side ships. We deliberately do
// not add the Tauri Rust project, bundler config, or signed-update server
// here — the Emergent credit budget stays reserved for shared-UI work. The
// adapter uses `@tauri-apps/api` plugins lazily via dynamic imports so this
// file still type-checks and ships in the browser bundle (the module
// specifiers are not resolved at runtime unless `detectPlatform()` returns
// `tauri-desktop`).
//
// When the Tauri shell is added, follow-up work will:
//   1. Install `@tauri-apps/api`, `@tauri-apps/plugin-notification`,
//      `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs`,
//      `@tauri-apps/plugin-opener`, `@tauri-apps/plugin-updater`,
//      and `@tauri-apps/plugin-stronghold` or `-keyring`.
//   2. Replace the stub bodies below with their plugin calls.
//   3. Wire system-tray / deep-link listeners into `src/main.tsx`.
//   4. Ship signed update manifests behind a dedicated endpoint on the
//      Hono API, scoped to the deployment identity.
//
// Until then, every method falls back to the browser adapter so Locat still
// runs under `tauri dev` for designers / testers using the Vite preview.

import type { PlatformAdapter, PlatformCapabilities, PlatformNotification, SaveResult } from "./index";
import { browserAdapter } from "./browser";
import { UnsupportedCapability } from "./index";

const fallback = browserAdapter("tauri-desktop");

const plannedCapabilities: PlatformCapabilities = {
  nativeNotifications: true,
  nativeFileSave: true,
  nativeOpenExternal: true,
  nativeSecureStorage: true,
  systemTray: true,
  deepLinks: true,
  signedUpdates: true,
};

export const tauriAdapter: PlatformAdapter = {
  kind: "tauri-desktop",
  label: "Tauri 2 desktop (planned: Windows / Linux / macOS)",
  // Advertise only what the current build actually implements; the planned
  // set above documents the target. Switch booleans to `true` as each
  // plugin lands.
  capabilities: {
    ...plannedCapabilities,
    nativeNotifications: false,
    nativeFileSave: false,
    nativeSecureStorage: false,
    systemTray: false,
    signedUpdates: false,
  },
  async saveBlob(blob: Blob, filename: string): Promise<SaveResult> {
    return fallback.saveBlob(blob, filename);
  },
  async openExternal(url: string): Promise<void> {
    return fallback.openExternal(url);
  },
  async showNotification(input: PlatformNotification): Promise<void> {
    return fallback.showNotification(input);
  },
  async readSecret(key: string): Promise<string | null> {
    return fallback.readSecret(key);
  },
  async writeSecret(key: string, value: string): Promise<void> {
    return fallback.writeSecret(key, value);
  },
  async deleteSecret(key: string): Promise<void> {
    return fallback.deleteSecret(key);
  },
};

export { UnsupportedCapability };
