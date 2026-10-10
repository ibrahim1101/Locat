import { useCallback, useEffect, useState } from "react";
import { Fingerprint, Lock, LockOpen, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AUTO_LOCK_OPTIONS,
  AppLockError,
  type AutoLockOptionId,
  changePasscode,
  currentState,
  hasBiometricSupport,
  isBiometricAvailable,
  markLocked,
  registerBiometric,
  removeBiometric,
  removeLock,
  setPasscode as savePasscode,
  updatePolicy,
} from "@/lib/appLock";
import { notifyAppLockChange } from "@/components/AppLockGate";
import type { SessionUser } from "@/state/auth";

type Mode = "idle" | "set" | "change" | "remove" | "biometric";

/**
 * Honest device-storage protection UI. The old implementation was a single
 * "Protect device storage" button that only called
 * `navigator.storage.persist()` — leaving every spec requirement
 * (passcode, biometric, auto-lock, lock-on-background) unmet. This component
 * covers each of those, keeps the browser-storage request as a separate
 * action, and never claims a feature is active when it isn't (status is
 * derived from {@link currentState}, biometric availability from the
 * browser, and persistent-storage status from `navigator.storage.persisted`).
 */
export function AppLockSection({ user }: { user: SessionUser }) {
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => {
    setTick((n) => n + 1);
    notifyAppLockChange();
  }, []);
  const state = currentState();
  const [mode, setMode] = useState<Mode>("idle");
  const [passcode, setPasscode] = useState("");
  const [confirm, setConfirm] = useState("");
  const [currentPasscode, setCurrentPasscode] = useState("");
  const [autoLock, setAutoLock] = useState<AutoLockOptionId>(state.config?.autoLockOption ?? "5m");
  const [lockOnBackground, setLockOnBackground] = useState(state.config?.lockOnBackground ?? true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [persistent, setPersistent] = useState<"unknown" | "granted" | "not-granted">("unknown");
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  // Re-sync local form state whenever the underlying config changes.
  useEffect(() => {
    const next = currentState().config;
    setAutoLock(next?.autoLockOption ?? "5m");
    setLockOnBackground(next?.lockOnBackground ?? true);
  }, [tick]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const granted = await navigator.storage?.persisted?.();
        if (!cancelled) setPersistent(granted ? "granted" : "not-granted");
      } catch {
        if (!cancelled) setPersistent("not-granted");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!hasBiometricSupport()) {
        if (!cancelled) setBiometricAvailable(false);
        return;
      }
      const ok = await isBiometricAvailable();
      if (!cancelled) setBiometricAvailable(ok);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function reset() {
    setPasscode("");
    setConfirm("");
    setCurrentPasscode("");
    setMode("idle");
    setBusy(false);
    setError("");
  }

  async function perform(action: () => Promise<string>) {
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      const message = await action();
      reset();
      bump();
      setFeedback(message);
    } catch (err) {
      if (err instanceof AppLockError) setError(err.message);
      else setError(err instanceof Error ? err.message : "Could not update the app lock.");
    } finally {
      setBusy(false);
    }
  }

  const configured = state.configured;
  const autoLockLabel = AUTO_LOCK_OPTIONS.find((o) => o.id === (state.config?.autoLockOption ?? "5m"))?.label ?? "After 5 minutes";

  return (
    <section
      className="emergent-locat-surface space-y-3 rounded-xl p-4"
      data-testid="app-lock-section"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">Device app lock</p>
          <p className="text-xs text-secondary">
            Require a passcode or biometric to open Locat on this device. Your
            server session, encryption keys and local history are untouched;
            only the UI is gated.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ${configured ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}
          data-testid="app-lock-status"
        >
          {configured ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
          {configured ? "On" : "Off"}
        </span>
      </div>

      {configured && (
        <ul className="list-inside list-disc space-y-1 pl-1 text-xs text-secondary" data-testid="app-lock-summary">
          <li>Auto-lock: {autoLockLabel}</li>
          <li>Lock on background: {state.config?.lockOnBackground ? "On" : "Off"}</li>
          <li>Biometric unlock: {state.config?.biometricCredentialId ? "Registered on this device" : "Not registered"}</li>
        </ul>
      )}

      {mode === "idle" && (
        <div className="flex flex-wrap gap-2">
          {!configured && (
            <Button type="button" onClick={() => setMode("set")} data-testid="app-lock-set">
              <Lock className="mr-2 h-4 w-4" /> Set passcode
            </Button>
          )}
          {configured && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setMode("change")}
                data-testid="app-lock-change"
              >
                Change passcode
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setMode("remove")}
                data-testid="app-lock-remove"
              >
                Remove lock
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  markLocked();
                  bump();
                  setFeedback("Device app lock engaged. Enter your passcode to continue.");
                }}
                data-testid="app-lock-now"
              >
                <LockOpen className="mr-2 h-4 w-4" /> Lock now
              </Button>
            </>
          )}
        </div>
      )}

      {configured && mode === "idle" && (
        <div className="space-y-3 border-t border-border/50 pt-3">
          <label className="flex items-center justify-between gap-2 text-sm">
            Auto-lock
            <select
              aria-label="Auto-lock timing"
              data-testid="app-lock-autolock"
              className="emergent-locat-control min-h-11 rounded-xl p-2"
              value={autoLock}
              onChange={(e) => {
                const next = e.target.value as AutoLockOptionId;
                setAutoLock(next);
                updatePolicy({ autoLockOption: next });
                bump();
              }}
            >
              {AUTO_LOCK_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center justify-between gap-2 text-sm">
            Lock when I switch apps
            <input
              type="checkbox"
              data-testid="app-lock-background"
              checked={lockOnBackground}
              onChange={(e) => {
                setLockOnBackground(e.target.checked);
                updatePolicy({ lockOnBackground: e.target.checked });
                bump();
              }}
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 flex-1 text-sm">Biometric unlock</p>
            {state.config?.biometricCredentialId ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                data-testid="app-lock-biometric-remove"
                onClick={() =>
                  void perform(async () => {
                    removeBiometric();
                    return "Biometric unlock removed on this device.";
                  })
                }
              >
                Remove biometrics
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || !biometricAvailable}
                data-testid="app-lock-biometric-register"
                onClick={() =>
                  void perform(async () => {
                    await registerBiometric(user.id, user.username);
                    return "Biometric unlock registered. Your passcode still works as a backup.";
                  })
                }
              >
                <Fingerprint className="mr-2 h-4 w-4" />
                Register biometrics
              </Button>
            )}
          </div>
          {!biometricAvailable && !state.config?.biometricCredentialId && (
            <p className="text-xs text-secondary">
              Biometrics require a platform authenticator (fingerprint, Face ID,
              Windows Hello) and a trusted HTTPS origin. The Locat Android app
              or an HTTPS browser session on a device with biometrics is
              required.
            </p>
          )}
        </div>
      )}

      {mode === "set" && (
        <form
          className="space-y-3"
          data-testid="app-lock-set-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (passcode !== confirm) {
              setError("Passcodes do not match.");
              return;
            }
            void perform(async () => {
              await savePasscode(passcode, { autoLockOption: autoLock, lockOnBackground });
              return "Device app lock enabled. Locat will prompt on next launch.";
            });
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="app-lock-new">New passcode (6+ characters)</Label>
            <Input
              id="app-lock-new"
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              disabled={busy}
              required
              data-testid="app-lock-new"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="app-lock-confirm">Confirm passcode</Label>
            <Input
              id="app-lock-confirm"
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={busy}
              required
              data-testid="app-lock-confirm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy || passcode.length < 6}>
              {busy ? "Saving…" : "Enable lock"}
            </Button>
            <Button type="button" variant="outline" onClick={reset} disabled={busy}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {mode === "change" && (
        <form
          className="space-y-3"
          data-testid="app-lock-change-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (passcode !== confirm) {
              setError("New passcodes do not match.");
              return;
            }
            void perform(async () => {
              await changePasscode(currentPasscode, passcode);
              return "Passcode updated on this device.";
            });
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="app-lock-current">Current passcode</Label>
            <Input
              id="app-lock-current"
              type="password"
              autoComplete="current-password"
              value={currentPasscode}
              onChange={(e) => setCurrentPasscode(e.target.value)}
              disabled={busy}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="app-lock-new">New passcode</Label>
            <Input
              id="app-lock-new"
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              disabled={busy}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="app-lock-confirm">Confirm new passcode</Label>
            <Input
              id="app-lock-confirm"
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={busy}
              required
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy || passcode.length < 6 || currentPasscode.length === 0}>
              {busy ? "Updating…" : "Change passcode"}
            </Button>
            <Button type="button" variant="outline" onClick={reset} disabled={busy}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {mode === "remove" && (
        <form
          className="space-y-3"
          data-testid="app-lock-remove-form"
          onSubmit={(event) => {
            event.preventDefault();
            void perform(async () => {
              await removeLock(currentPasscode);
              return "App lock removed on this device.";
            });
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="app-lock-remove-current">Confirm with current passcode</Label>
            <Input
              id="app-lock-remove-current"
              type="password"
              autoComplete="current-password"
              value={currentPasscode}
              onChange={(e) => setCurrentPasscode(e.target.value)}
              disabled={busy}
              required
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy || currentPasscode.length === 0}>
              {busy ? "Removing…" : "Remove lock"}
            </Button>
            <Button type="button" variant="outline" onClick={reset} disabled={busy}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <div className="space-y-2 border-t border-border/50 pt-3">
        <p className="font-medium text-sm">Persistent browser storage</p>
        <p className="text-xs text-secondary">
          Ask your browser to keep Locat's encrypted history even when storage
          is low. This is independent from the device app lock above.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px]"
            data-testid="persistent-status"
          >
            {persistent === "granted" ? "Persistent storage enabled" : persistent === "not-granted" ? "May be cleared by the browser" : "Checking…"}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || persistent === "granted"}
            data-testid="persistent-request"
            onClick={() =>
              void (async () => {
                setFeedback("");
                setError("");
                try {
                  const allowed = await navigator.storage?.persist?.();
                  setPersistent(allowed ? "granted" : "not-granted");
                  setFeedback(
                    allowed
                      ? "Persistent storage enabled. Keep backups as well."
                      : "Your browser did not grant persistent storage. Keep regular backups.",
                  );
                } catch {
                  setError("Could not request persistent storage in this browser.");
                }
              })()
            }
          >
            Request persistent storage
          </Button>
        </div>
      </div>

      {feedback && (
        <p role="status" className="text-sm" data-testid="app-lock-feedback">
          {feedback}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive" data-testid="app-lock-error">
          {error}
        </p>
      )}
    </section>
  );
}
