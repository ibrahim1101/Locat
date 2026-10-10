import { describe, expect, it, beforeEach } from "vitest";
import {
  AUTO_LOCK_OPTIONS,
  AppLockError,
  autoLockOptionById,
  changePasscode,
  currentState,
  isConfigured,
  markLocked,
  markUnlocked,
  readConfig,
  recordActivity,
  removeLock,
  setPasscode,
  shouldAutoLock,
  updatePolicy,
  verifyPasscode,
} from "./appLock";

function memoryStorage() {
  const store = new Map<string, string>();
  const api = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  };
  return Object.assign(api, { get size() { return store.size; } });
}

describe("app lock passcode", () => {
  let storage: ReturnType<typeof memoryStorage>;
  let session: ReturnType<typeof memoryStorage>;
  beforeEach(() => {
    storage = memoryStorage();
    session = memoryStorage();
  });

  it("starts without a configured lock", () => {
    expect(isConfigured(storage)).toBe(false);
    expect(currentState(storage, session)).toEqual({ configured: false, unlocked: true, config: null });
  });

  it("sets a passcode and verifies the exact match", async () => {
    const config = await setPasscode("correct-horse-battery", {}, storage);
    expect(config.salt).toBeTruthy();
    expect(config.hash).toBeTruthy();
    expect(config.autoLockOption).toBe("5m");
    expect(config.lockOnBackground).toBe(true);
    expect(await verifyPasscode("correct-horse-battery", storage)).toBe(true);
    expect(await verifyPasscode("wrong-password", storage)).toBe(false);
  });

  it("rejects passcodes shorter than six characters", async () => {
    await expect(setPasscode("abc", {}, storage)).rejects.toBeInstanceOf(AppLockError);
  });

  it("rejects passcodes longer than the maximum", async () => {
    await expect(setPasscode("x".repeat(200), {}, storage)).rejects.toBeInstanceOf(AppLockError);
  });

  it("rotates the salt and hash on each setPasscode", async () => {
    const a = await setPasscode("passcode-one-ok", {}, storage);
    const b = await setPasscode("passcode-two-ok", {}, storage);
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });

  it("changes the passcode only when the current one verifies", async () => {
    await setPasscode("original-passcode", {}, storage);
    await expect(changePasscode("nope-nope", "new-one-ok-6", storage)).rejects.toBeInstanceOf(AppLockError);
    const updated = await changePasscode("original-passcode", "new-one-ok-6", storage);
    expect(updated.autoLockOption).toBe("5m");
    expect(await verifyPasscode("new-one-ok-6", storage)).toBe(true);
    expect(await verifyPasscode("original-passcode", storage)).toBe(false);
  });

  it("removes the lock after verifying the current passcode", async () => {
    await setPasscode("to-be-removed", {}, storage);
    markUnlocked(session);
    await expect(removeLock("wrong-value", storage, session)).rejects.toBeInstanceOf(AppLockError);
    await removeLock("to-be-removed", storage, session);
    expect(isConfigured(storage)).toBe(false);
    expect(session.size).toBe(0);
  });

  it("preserves the saved policy when changing the passcode", async () => {
    await setPasscode("start-passcode", { autoLockOption: "1m", lockOnBackground: false }, storage);
    const changed = await changePasscode("start-passcode", "second-passcode", storage);
    expect(changed.autoLockOption).toBe("1m");
    expect(changed.lockOnBackground).toBe(false);
  });

  it("updates auto-lock and lock-on-background without re-hashing", async () => {
    const config = await setPasscode("current-passcode", { autoLockOption: "1m", lockOnBackground: true }, storage);
    const updated = updatePolicy({ autoLockOption: "15m", lockOnBackground: false }, storage);
    expect(updated?.autoLockOption).toBe("15m");
    expect(updated?.lockOnBackground).toBe(false);
    expect(updated?.hash).toBe(config.hash); // untouched
  });

  it("ignores updatePolicy when no lock is configured", () => {
    expect(updatePolicy({ autoLockOption: "1m" }, storage)).toBeNull();
    expect(readConfig(storage)).toBeNull();
  });
});

describe("app lock session state", () => {
  let storage: ReturnType<typeof memoryStorage>;
  let session: ReturnType<typeof memoryStorage>;
  beforeEach(() => {
    storage = memoryStorage();
    session = memoryStorage();
  });

  it("does not auto-lock when no passcode is configured", () => {
    expect(shouldAutoLock(Date.now(), storage, session)).toBe(false);
  });

  it("locks immediately when no activity has been recorded", async () => {
    await setPasscode("needs-unlock", { autoLockOption: "1m" }, storage);
    markUnlocked(session);
    session.removeItem("locat-app-lock-last-activity");
    expect(shouldAutoLock(Date.now(), storage, session)).toBe(true);
  });

  it("stays unlocked while the user is active within the window", async () => {
    await setPasscode("stay-unlocked", { autoLockOption: "1m" }, storage);
    const start = Date.now();
    markUnlocked(session);
    session.setItem("locat-app-lock-last-activity", String(start));
    expect(shouldAutoLock(start + 30_000, storage, session)).toBe(false);
    expect(shouldAutoLock(start + 61_000, storage, session)).toBe(true);
  });

  it("never auto-locks when the user picks 'never'", async () => {
    await setPasscode("manual-only", { autoLockOption: "never" }, storage);
    markUnlocked(session);
    session.setItem("locat-app-lock-last-activity", "0");
    expect(shouldAutoLock(Date.now(), storage, session)).toBe(false);
  });

  it("records activity only while unlocked", async () => {
    await setPasscode("record-activity", {}, storage);
    recordActivity(session);
    expect(session.getItem("locat-app-lock-last-activity")).toBeNull();
    markUnlocked(session);
    const first = Number.parseInt(session.getItem("locat-app-lock-last-activity")!, 10);
    recordActivity(session);
    const second = Number.parseInt(session.getItem("locat-app-lock-last-activity")!, 10);
    expect(second).toBeGreaterThanOrEqual(first);
  });

  it("markLocked clears unlock + activity flags", async () => {
    await setPasscode("clear-flags", {}, storage);
    markUnlocked(session);
    markLocked(session);
    expect(session.getItem("locat-app-lock-unlocked")).toBeNull();
    expect(session.getItem("locat-app-lock-last-activity")).toBeNull();
  });
});

describe("auto-lock options", () => {
  it("exposes the UI selector values", () => {
    expect(AUTO_LOCK_OPTIONS.map((option) => option.id)).toEqual([
      "immediate", "30s", "1m", "5m", "15m", "1h", "never",
    ]);
    expect(autoLockOptionById("1m").ms).toBe(60_000);
    // Unknown ids fall back to the 5-minute default rather than crashing.
    expect(autoLockOptionById("something" as never).id).toBe("5m");
  });
});
