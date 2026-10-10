import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Source-level guards for Phase 1 device-storage protection.
// The old implementation was a single "Protect device storage" button that
// only requested persistent browser storage. These tests pin the new
// behaviour: a real app lock with passcode, biometric and auto-lock, exposed
// honestly through the Settings dialog, and gating the signed-in UI through
// AppLockGate.
const section = readFileSync(fileURLToPath(new URL("../components/chat/AppLockSection.tsx", import.meta.url)), "utf8");
const dialog = readFileSync(fileURLToPath(new URL("../components/chat/StorageDialog.tsx", import.meta.url)), "utf8");
const gate = readFileSync(fileURLToPath(new URL("../components/AppLockGate.tsx", import.meta.url)), "utf8");
const main = readFileSync(fileURLToPath(new URL("../main.tsx", import.meta.url)), "utf8");

describe("device app lock surface", () => {
  it("replaces the broken 'Protect device storage' button in the Settings dialog", () => {
    // The dialog no longer renders the old button that only called
    // navigator.storage.persist().
    expect(dialog).not.toContain(">Protect device storage</Button>");
    // Persistent storage is still requestable, but now owned by
    // AppLockSection where its real behaviour (persisted vs volatile) is
    // reported honestly.
    expect(section).toContain('data-testid="persistent-status"');
    expect(section).toContain('data-testid="persistent-request"');
    // AppLockSection is mounted inside the dialog.
    expect(dialog).toContain('import { AppLockSection } from "./AppLockSection"');
    expect(dialog).toContain("<AppLockSection user={user} />");
  });

  it("exposes passcode, auto-lock, lock-on-background, biometric and lock-now controls", () => {
    for (const id of [
      "app-lock-section",
      "app-lock-status",
      "app-lock-set",
      "app-lock-change",
      "app-lock-remove",
      "app-lock-now",
      "app-lock-autolock",
      "app-lock-background",
      "app-lock-biometric-register",
      "app-lock-biometric-remove",
      "app-lock-set-form",
      "app-lock-change-form",
      "app-lock-remove-form",
    ]) {
      expect(section).toContain(`data-testid="${id}"`);
    }
  });

  it("surfaces explicit status instead of claiming security that may not be enabled", () => {
    // Status badge toggles On/Off based on currentState().
    expect(section).toContain("configured ? \"On\" : \"Off\"");
    // Biometric row admits when the platform authenticator is unavailable.
    expect(section).toContain("Biometrics require a platform authenticator");
    // Persistent storage shows the real browser answer, not a claim.
    expect(section).toContain('persistent === "granted" ? "Persistent storage enabled" : persistent === "not-granted" ? "May be cleared by the browser"');
  });
});

describe("app lock gate", () => {
  it("mounts between AuthProvider and App to block signed-in UI when locked", () => {
    expect(main).toContain('import { AppLockGate } from "./components/AppLockGate"');
    expect(main).toContain("<AuthProvider><AppLockGate><><App /><DownloadStatusHost /></></AppLockGate></AuthProvider>");
  });

  it("renders a modal dialog with passcode input and optional biometric button", () => {
    expect(gate).toContain('data-testid="app-lock-gate"');
    expect(gate).toContain('data-testid="app-lock-form"');
    expect(gate).toContain('data-testid="app-lock-passcode"');
    expect(gate).toContain('data-testid="app-lock-submit"');
    expect(gate).toContain('data-testid="app-lock-biometric"');
    expect(gate).toContain('role="dialog"');
    expect(gate).toContain('aria-modal="true"');
  });

  it("locks on background and runs an inactivity poll when configured", () => {
    expect(gate).toContain('document.addEventListener("visibilitychange", onVisibility)');
    expect(gate).toContain('window.addEventListener("pagehide", onVisibility)');
    expect(gate).toContain('window.setInterval(check, 15_000)');
    expect(gate).toContain("shouldAutoLock(Date.now())");
    expect(gate).toContain("recordActivity()");
  });

  it("recovers from storage events so the dialog toggles live when settings change", () => {
    expect(gate).toContain('event.key === "locat-app-lock-v1"');
    expect(gate).toContain('window.addEventListener("locat-app-lock-change", onLocalChange)');
  });
});
