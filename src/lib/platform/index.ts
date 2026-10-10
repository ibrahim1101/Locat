// Platform adapter layer for Locat 2.0.
//
// Locat ships as a React/Vite PWA, a Capacitor Android app, and (ahead) a
// Tauri 2 desktop app for Windows, Linux and macOS. The shared UI must stay
// framework-independent, so every call that touches a native capability
// (notifications, file dialogs, secure storage, system tray, deep links,
// signed updates) goes through this module.
//
// The adapter picks the correct implementation at runtime by inspecting the
// current environment. Features that aren't available return `null` or
// `false` so the UI can degrade honestly instead of pretending to work.
//
// This file deliberately keeps the surface small; concrete adapters live in
// `./browser`, `./capacitor` and `./tauri`. Only the active runtime is
// imported so unused platforms do not add weight to other targets.

export type PlatformKind = "browser" | "web-installed" | "capacitor-android" | "tauri-desktop";

export type PlatformAdapter = {
  readonly kind: PlatformKind;
  /** Human-readable label for diagnostics and documentation. */
  readonly label: string;
  /**
   * Capability map. Each boolean reflects whether the adapter can honestly
   * fulfil the capability on this device *right now*. UI must branch on
   * these rather than on {@link kind}.
   */
  readonly capabilities: PlatformCapabilities;
  /** Save a blob to disk, returning the user-visible location when known. */
  saveBlob(blob: Blob, filename: string): Promise<SaveResult>;
  /** Open an external URL in the default browser / associated app. */
  openExternal(url: string): Promise<void>;
  /** Show a native-looking notification; falls back to Notification API. */
  showNotification(input: PlatformNotification): Promise<void>;
  /**
   * Read / write a secret in the OS secure store if available; otherwise
   * returns `null` on read and throws {@link UnsupportedCapability} on write.
   */
  readSecret(key: string): Promise<string | null>;
  writeSecret(key: string, value: string): Promise<void>;
  deleteSecret(key: string): Promise<void>;
};

export type PlatformCapabilities = {
  nativeNotifications: boolean;
  nativeFileSave: boolean;
  nativeOpenExternal: boolean;
  nativeSecureStorage: boolean;
  systemTray: boolean;
  deepLinks: boolean;
  signedUpdates: boolean;
};

export type SaveResult = {
  destination: "selected-folder" | "downloads" | "user-chosen" | "unknown";
  path?: string;
};

export type PlatformNotification = {
  title: string;
  body?: string;
  tag?: string;
  category?: string;
  deepLink?: string;
};

export class UnsupportedCapability extends Error {
  readonly capability: keyof PlatformCapabilities;
  constructor(capability: keyof PlatformCapabilities) {
    super(`Capability '${capability}' is not available on this platform.`);
    this.capability = capability;
  }
}

type GlobalMarkers = {
  __TAURI_INTERNALS__?: unknown;
  __TAURI__?: unknown;
  Capacitor?: { isNativePlatform?: () => boolean };
};

/** Pure detector so tests can poke the environment directly. */
export function detectPlatform(globals: GlobalMarkers = globalThis as unknown as GlobalMarkers): PlatformKind {
  if (globals.__TAURI_INTERNALS__ || globals.__TAURI__) return "tauri-desktop";
  if (globals.Capacitor?.isNativePlatform?.()) return "capacitor-android";
  if (typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches) {
    return "web-installed";
  }
  return "browser";
}

let active: PlatformAdapter | null = null;

/** Lazily resolve the right adapter for the current runtime. */
export async function getPlatform(): Promise<PlatformAdapter> {
  if (active) return active;
  const kind = detectPlatform();
  switch (kind) {
    case "tauri-desktop": {
      const mod = await import("./tauri");
      active = mod.tauriAdapter;
      return active;
    }
    case "capacitor-android": {
      const mod = await import("./capacitor");
      active = mod.capacitorAdapter;
      return active;
    }
    default: {
      const mod = await import("./browser");
      active = mod.browserAdapter(kind);
      return active;
    }
  }
}

/**
 * Testing helper. Set a stub adapter so UI tests do not spin up the real
 * platform modules. Resetting with `null` goes back to live detection.
 */
export function __setPlatformForTests(adapter: PlatformAdapter | null): void {
  active = adapter;
}
