import { useState } from "react";
import { setNativeServerUrl } from "@/lib/native";

export function NativeServerSetup() {
  const [server, setServer] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setChecking(true);
    setError("");
    try {
      const url = new URL(server.trim());
      if (url.protocol !== "https:") throw new Error("Locat Android requires an HTTPS server address.");
      const response = await fetch(`${url.origin}/api/health`, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error("That server did not pass the Locat health check.");
      const health = await response.json() as { app?: string; status?: string };
      if (health.app !== "Locat" || health.status !== "ok") throw new Error("That address is not a compatible Locat server.");
      setNativeServerUrl(url.origin);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach that Locat server.");
      setChecking(false);
    }
  }
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 text-foreground">
      <form onSubmit={save} className="surface-2 w-full max-w-sm space-y-4 rounded-lg border p-6">
        <div>
          <h1 className="text-xl font-semibold">Connect Locat</h1>
          <p className="mt-2 text-sm text-secondary">Enter the HTTPS address of your Locat server. You only need to do this once on this Android installation.</p>
        </div>
        <label className="block text-sm">
          Server address
          <input type="url" required autoCapitalize="none" autoCorrect="off"
            placeholder="https://your-locat-server.example"
            value={server} onChange={e => setServer(e.target.value)}
            className="mt-2 h-11 w-full rounded-md border bg-background px-3" />
        </label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <button type="submit" disabled={checking} className="h-11 w-full rounded-md bg-primary font-semibold text-primary-foreground disabled:opacity-60">{checking ? "Checking server…" : "Connect securely"}</button>
        <p className="text-xs text-secondary">Locat Android refuses plain HTTP. The server address stays on this device.</p>
      </form>
    </main>
  );
}
