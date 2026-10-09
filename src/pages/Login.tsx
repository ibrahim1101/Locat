import { useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { registrationPasswordError, PASSWORD_MAX_CODE_UNITS } from "@contracts/password";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/state/auth";
import { LocatMark, LocatWordmark } from "@/components/LocatBrand";

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
    <div className="locat-auth-shell flex min-h-dvh items-center justify-center bg-background px-4 pt-safe pb-safe">
      <div className="relative z-10 w-full max-w-sm">{children}</div>
    </div>
  );
}

function Brand() {
  return (
    <div className="mb-5 text-center">
      <div className="locat-icon-shell mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[26px] border border-primary/20"><LocatMark className="h-14 w-14 text-foreground" /></div>
      <h1><LocatWordmark className="text-3xl" /></h1>

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
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
        const policyError = registrationPasswordError(password, username);
        if (policyError) throw new Error(policyError);
        if (confirmation !== password) throw new Error("Passwords do not match.");
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
      <div className="rounded-[22px] border border-border/60 bg-card/65 p-5 shadow-super sm:p-7">
        <div className="mb-5"><h2 className="text-xl font-semibold tracking-tight">{mode === "login" ? "Welcome back" : "Create your private space"}</h2><p className="mt-1 text-sm text-muted-foreground">{mode === "login" ? "Sign in to continue your conversations." : "Your identity and messages stay protected."}</p></div>
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
              className="h-12 rounded-xl border-input bg-background/70"
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
            <div className="relative"><Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 rounded-xl border-input bg-background/70 pr-12"
              required
              maxLength={PASSWORD_MAX_CODE_UNITS}
              aria-describedby={mode === "register" ? "password-help" : undefined}
            /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)} className="obsidian-interactive absolute inset-y-0 right-1 flex w-10 items-center justify-center rounded-lg text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
            {mode === "register" && (
              <p id="password-help" className="text-xs text-secondary">
                Use at least 8 characters. Avoid your username,
                common passwords and repeats. Spaces and password managers are welcome.
              </p>
            )}
          </div>

          {mode === "register" && (
            <div className="space-y-2">
              <Label htmlFor="password-confirm">Confirm password</Label>
              <Input id="password-confirm" type="password" autoComplete="new-password"
                value={confirmation} onChange={e => setConfirmation(e.target.value)} required
                maxLength={PASSWORD_MAX_CODE_UNITS} className="h-11 border-input bg-background" />
            </div>
          )}

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

          <Button
            type="submit"
            disabled={busy}
            className="locat-metal-button h-12 w-full rounded-xl font-semibold active:scale-[0.98]"
          >
            {busy ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <div <div className="mt-5 border-t border-border/60 pt-4 text-center"><button type="button" className="min-h-11 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}>{mode === "login" ? "New to Locat? Create account" : "Already have an account? Sign in"}</button></div>
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
      <div className="smoked-glass rounded-[22px] p-6 shadow-super">
        <div className="mb-3 flex items-center gap-2 text-primary"><LockKeyhole className="h-5 w-5" aria-hidden="true" /><p className="text-xs font-semibold text-primary">Restore encrypted identity</p></div>
        <h2 className="mb-2 text-xl font-semibold">Welcome to your new device</h2>
        <p className="mb-5 text-sm text-secondary">
          Hi {user} — this device doesn't have your encryption keys yet. Enter your password
          to unlock the backup and restore your identity here.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <Label htmlFor="restore-password">Account password</Label>
          <Input
            id="restore-password"
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
