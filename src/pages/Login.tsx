import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/state/auth";

function LocatMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <circle cx="7" cy="16" r="3.5" stroke="hsl(187 100% 50%)" strokeWidth="2" />
      <circle cx="25" cy="16" r="3.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M11 16h10"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="2 3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function errorText(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Something went wrong";
}

export default function Login() {
  const { state, login, register, restoreKeys, resetIdentity } = useAuth();

  if (state.status === "needsKeyRestore") {
    return <KeyRestore user={state.user.displayName} onRestore={restoreKeys} onReset={resetIdentity} />;
  }
  return <AuthForm onLogin={login} onRegister={register} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 pt-safe pb-safe">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}

function Brand() {
  return (
    <div className="mb-8">
      <LocatMark className="mb-4 h-9 w-9 text-foreground" />
      <h1 className="text-xl font-semibold tracking-tight">Locat</h1>
      <p className="micro-label mt-2">end-to-end encrypted · stored on your devices</p>
    </div>
  );
}

function AuthForm({
  onLogin,
  onRegister,
}: {
  onLogin: (u: string, p: string) => Promise<void>;
  onRegister: (u: string, d: string, p: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") {
        await onLogin(username.trim(), password);
      } else {
        await onRegister(username.trim(), displayName.trim() || username.trim(), password);
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <Brand />
      <div className="surface-2 rounded-lg border p-6 shadow-super">
        <div className="mb-6 grid grid-cols-2 gap-1 rounded-md border bg-background p-1">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={`h-11 rounded-[4px] text-sm font-medium transition-colors ${
                mode === m ? "surface-3 text-foreground" : "text-secondary hover:text-foreground"
              }`}
            >
              {m === "login" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username" className="micro-label">
              Username
            </Label>
            <Input
              id="username"
              autoComplete="username"
              autoCapitalize="none"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-11 border-input bg-background"
              required
              minLength={3}
            />
          </div>
          {mode === "register" && (
            <div className="space-y-2">
              <Label htmlFor="displayName" className="micro-label">
                Display name
              </Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="h-11 border-input bg-background"
                placeholder="How others see you"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="password" className="micro-label">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 border-input bg-background"
              required
              minLength={8}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            type="submit"
            disabled={busy}
            className="h-11 w-full bg-primary font-semibold text-primary-foreground hover:bg-primary/90 active:scale-[0.98]"
          >
            {busy ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <p className="micro-label mt-5 normal-case tracking-normal">
          Your messages are encrypted on this device before they ever touch the relay.
        </p>
      </div>
    </Shell>
  );
}

function KeyRestore({
  user,
  onRestore,
  onReset,
}: {
  user: string;
  onRestore: (password: string) => Promise<void>;
  onReset: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onRestore(password);
    } catch {
      setError("Could not unlock your keys — wrong password?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <Brand />
      <div className="surface-2 rounded-lg border p-6 shadow-super">
        <p className="micro-label mb-2">New device detected</p>
        <p className="mb-5 text-sm text-secondary">
          Hi {user} — this device doesn't have your encryption keys yet. Enter your password
          to unlock the backup and restore your identity here.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <Input
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 border-input bg-background"
            required
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            type="submit"
            disabled={busy}
            className="h-11 w-full bg-primary font-semibold text-primary-foreground hover:bg-primary/90 active:scale-[0.98]"
          >
            {busy ? "Unlocking…" : "Unlock keys"}
          </Button>
        </form>

        <div className="mt-5 border-t pt-4">
          {confirmReset ? (
            <div className="space-y-3">
              <p className="text-sm text-destructive">
                This generates a brand-new identity. Other people will see a new key for you, and
                messages still queued for the old key can never be decrypted. Continue?
              </p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  disabled={busy || password.length < 8}
                  className="h-11 flex-1"
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await onReset(password);
                    } catch (err) {
                      setError(errorText(err));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Yes, new identity
                </Button>
                <Button variant="ghost" className="h-11 flex-1" onClick={() => setConfirmReset(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="micro-label normal-case tracking-normal underline decoration-border underline-offset-4 hover:text-foreground"
            >
              Forgot the password? Start with a fresh identity
            </button>
          )}
        </div>
      </div>
    </Shell>
  );
}
