import { invoke } from "@tauri-apps/api/core";
import type { PlatformAdapter, PlatformNotification, SaveResult } from "./index";
import { browserAdapter } from "./browser";
import { UnsupportedCapability } from "./index";

const fallback = browserAdapter("tauri-desktop");
export const tauriAdapter: PlatformAdapter = {
  kind: "tauri-desktop",
  label: "Locat desktop · Windows / Linux / macOS",
  capabilities: {
    nativeNotifications: true, nativeFileSave: true, nativeOpenExternal: true,
    nativeSecureStorage: false, systemTray: false, deepLinks: false, signedUpdates: false,
  },
  async saveBlob(blob: Blob, filename: string): Promise<SaveResult> {
    if (blob.size > 128 * 1024 * 1024) throw new Error("Desktop save supports attachments up to 128 MiB.");
    const path = await invoke<string | null>("save_attachment", { filename, data: Array.from(new Uint8Array(await blob.arrayBuffer())) });
    if (!path) throw new Error("Save cancelled; no file was saved.");
    return { destination: "user-chosen", path };
  },
  async openExternal(url: string) {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error("Only HTTPS external links are allowed.");
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(parsed.href);
  },
  async showNotification(input: PlatformNotification) {
    const notifications = await import("@tauri-apps/plugin-notification");
    let granted = await notifications.isPermissionGranted();
    if (!granted) granted = await notifications.requestPermission() === "granted";
    if (!granted) throw new UnsupportedCapability("nativeNotifications");
    notifications.sendNotification({ title: input.title, body: input.body });
  },
  readSecret: fallback.readSecret,
  writeSecret: fallback.writeSecret,
  deleteSecret: fallback.deleteSecret,
};
