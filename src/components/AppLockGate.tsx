import { useCallback, useEffect, useRef, useState } from "react";
import { Lock, Fingerprint, X } from "lucide-react";
import {
  currentState,
  isBiometricAvailable,
  markLocked,
  markUnlocked,
  recordActivity,
  shouldAutoLock,
  verifyBiometric,
  verifyPasscode,
} from "@/lib/appLock";
import { LocatMark, LocatWordmark } from "@/components/LocatBrand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Blocks the entire UI with a passcode / biometric prompt whenever the
 * device-local app lock is configured and currently locked. Rendered inside
 * {@link AuthProvider} so the gate sits in front of every signed-in screen
 * without altering the server auth state (the cookie session, identity keys
 * and local history are left alone).
 */
export function AppLockGate({ children }: { children: React.ReactNode }) {
  // Re-read config / unlocked flag whenever anything about the lock changes:
  // StorageDialog can set a passcode, remove it, or flip the auto-lock knob
  // while the user is signed in.
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick((n) => n + 1), []);
  const state = currentState();

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === "locat-app-lock-v1" || event.key === null) bump();
    };
    const onLocalChange = () => bump();
    window.addEventListener("storage", onStorage);
    window.addEventListener("locat-app-lock-change", onLocalChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("locat-app-lock-change", onLocalChange);
    };
  }, [bump]);

  // Lock-on-background: when the tab or Android WebView is hidden we flip the
  // session flag so returning to the app re-prompts for the passcode. We keep
  // the gate open while visible to avoid locking mid-task.
  useEffect(() => {
    if (!state.configured || !state.config?.lockOnBackground) return;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        markLocked();
        bump();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onVisibility);
    };
  }, [state.configured, state.config?.lockOnBackground, bump]);

  // Auto-lock inactivity timer. Each user action resets the activity marker;
  // a 15 second poll checks whether the configured window has elapsed.
  useEffect(() => {
    if (!state.configured || !state.unlocked) return;
    const activity = () => recordActivity();
    const check = () => {
      if (shouldAutoLock(Date.now())) {
        markLocked();
        bump();
      }
    };
    const events: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "wheel",
      "touchstart",
      "focus",
    ];
    for (const name of events) window.addEventListener(name, activity, { passive: true });
    const timer = window.setInterval(check, 15_000);
    // Record activity on mount so an immediately-expired marker does not
    // auto-lock the user before they even see a screen.
    activity();
    return () => {
      for (const name of events) window.removeEventListener(name, activity);
      window.clearInterval(timer);
    };
  }, [state.configured, state.unlocked, state.config?.autoLockOption, bump]);
  // The tick dependency forces React to re-read currentState() after unlocks.
  void tick;

  if (!state.configured || state.unlocked) return <>{children}</>;
  return <AppLockPrompt onUnlocked={bump} />;
}

export const APP_LOCK_CHANGE_EVENT = "locat-app-lock-change";
export function notifyAppLockChange() {
  window.dispatchEvent(new CustomEvent(APP_LOCK_CHANGE_EVENT));
}

function AppLockPrompt({ onUnlocked }: { onUnlocked: () => void }) {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [biometricReady, setBiometricReady] = useState(false);
  const passcodeRef = useRef<HTMLInputElement>(null);
  const config = currentState().config;

  useEffect(() => {
    passcodeRef.current?.focus();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!config?.biometricCredentialId) return;
      const available = await isBiometricAvailable();
      if (!cancelled) setBiometricReady(available);
    })();
    return () => {
      cancelled = true;
    };
  }, [config?.biometricCredentialId]);

  const attemptBiometric = useCallback(async () => {
    setError("");
    setBusy(true);
    try {
      const ok = await verifyBiometric();
      if (!ok) {
        setError("Biometric check failed. Enter your passcode to continue.");
        return;
      }
      markUnlocked();
      onUnlocked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Biometric unlock is unavailable.");
    } finally {
      setBusy(false);
    }
  }, [onUnlocked]);

  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setError("");
      setBusy(true);
      try {
        const ok = await verifyPasscode(passcode);
        if (!ok) {
          setError("Passcode is incorrect.");
          return;
        }
        setPasscode("");
        markUnlocked();
        onUnlocked();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not verify the passcode.");
      } finally {
        setBusy(false);
      }
    },
    [passcode, onUnlocked],
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-lock-title"
      data-testid="app-lock-gate"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background p-6 text-foreground"
    >
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-border/60 bg-card/95 p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <LocatMark className="h-10 w-10" />
          <div className="min-w-0 flex-1">
            <h1 id="app-lock-title" className="text-base font-semibold tracking-tight">
              <LocatWordmark className="text-lg" /> is locked
            </h1>
            <p className="text-xs text-secondary">
              Enter your device passcode to continue. Locat keeps your session
              signed in but hides messages until you unlock.
            </p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-3" data-testid="app-lock-form">
          <div className="space-y-2">
            <Label htmlFor="app-lock-passcode">Device passcode</Label>
            <Input
              ref={passcodeRef}
              id="app-lock-passcode"
              type="password"
              inputMode="text"
              autoComplete="current-password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              minLength={6}
              disabled={busy}
              required
              data-testid="app-lock-passcode"
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={busy || passcode.length < 6}
            data-testid="app-lock-submit"
          >
            <Lock className="mr-2 h-4 w-4" />
            {busy ? "Checking…" : "Unlock"}
          </Button>
        </form>
        {biometricReady && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={() => void attemptBiometric()}
            data-testid="app-lock-biometric"
          >
            <Fingerprint className="mr-2 h-4 w-4" />
            Use biometrics
          </Button>
        )}
        {error && (
          <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
            <X className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </p>
        )}
        <p className="text-[11px] text-secondary">
          Can't remember the passcode? Sign out from another device, then
          reinstall and sign in to restore your encrypted history from the
          server backup.
        </p>
      </div>
    </div>
  );
}
