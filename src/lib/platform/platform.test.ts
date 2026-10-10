import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  __setPlatformForTests,
  detectPlatform,
  getPlatform,
  type PlatformAdapter,
} from "./index";

describe("platform detection", () => {
  afterEach(() => {
    __setPlatformForTests(null);
  });

  it("recognises Tauri runtime markers", () => {
    expect(detectPlatform({ __TAURI_INTERNALS__: {} })).toBe("tauri-desktop");
    expect(detectPlatform({ __TAURI__: {} })).toBe("tauri-desktop");
  });

  it("recognises Capacitor Android", () => {
    expect(detectPlatform({ Capacitor: { isNativePlatform: () => true } })).toBe("capacitor-android");
  });

  it("falls back to browser when no native markers are present", () => {
    expect(detectPlatform({})).toBe("browser");
    expect(detectPlatform({ Capacitor: { isNativePlatform: () => false } })).toBe("browser");
  });

  it("uses the installed-PWA label when standalone display-mode matches", () => {
    const savedMatch = typeof window === "undefined" ? undefined : window.matchMedia;
    if (typeof window === "undefined") return;
    (window as unknown as { matchMedia: typeof window.matchMedia }).matchMedia = (() => ({
      matches: true,
      media: "(display-mode: standalone)",
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
    })) as unknown as typeof window.matchMedia;
    try {
      expect(detectPlatform({})).toBe("web-installed");
    } finally {
      if (savedMatch) {
        (window as unknown as { matchMedia: typeof window.matchMedia }).matchMedia = savedMatch;
      }
    }
  });

  it("returns the stub adapter when tests set one", async () => {
    const stub: PlatformAdapter = {
      kind: "browser",
      label: "stub",
      capabilities: {
        nativeNotifications: false,
        nativeFileSave: false,
        nativeOpenExternal: false,
        nativeSecureStorage: false,
        systemTray: false,
        deepLinks: false,
        signedUpdates: false,
      },
      saveBlob: async () => ({ destination: "unknown" }),
      openExternal: async () => {},
      showNotification: async () => {},
      readSecret: async () => null,
      writeSecret: async () => {},
      deleteSecret: async () => {},
    };
    __setPlatformForTests(stub);
    expect(await getPlatform()).toBe(stub);
  });
});

describe("Tauri adapter capability honesty", () => {
  beforeEach(() => {
    __setPlatformForTests(null);
  });
  it("does not falsely advertise capabilities until plugins land", async () => {
    const { tauriAdapter } = await import("./tauri");
    // Only `nativeOpenExternal` and `deepLinks` are flipped on in this
    // scaffold. Everything else must remain false so UI falls back honestly.
    expect(tauriAdapter.capabilities.nativeNotifications).toBe(false);
    expect(tauriAdapter.capabilities.nativeFileSave).toBe(false);
    expect(tauriAdapter.capabilities.nativeSecureStorage).toBe(false);
    expect(tauriAdapter.capabilities.systemTray).toBe(false);
    expect(tauriAdapter.capabilities.signedUpdates).toBe(false);
    expect(tauriAdapter.capabilities.nativeOpenExternal).toBe(true);
    expect(tauriAdapter.capabilities.deepLinks).toBe(true);
    expect(tauriAdapter.kind).toBe("tauri-desktop");
  });
});

describe("Capacitor adapter wraps the browser adapter", () => {
  it("inherits the browser secret store until a secure plugin lands", async () => {
    const { capacitorAdapter } = await import("./capacitor");
    expect(capacitorAdapter.capabilities.nativeFileSave).toBe(true);
    expect(capacitorAdapter.capabilities.nativeSecureStorage).toBe(false);
  });
});
