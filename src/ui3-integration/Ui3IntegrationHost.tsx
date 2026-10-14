import { Link } from "react-router";
import { useUi3LiveSnapshot } from "./useUi3LiveSnapshot";

/**
 * Authenticated, opt-in integration diagnostic. NOT the imported UI 3.0 app.
 * Existing providers and route behavior stay authoritative.
 */
export default function Ui3IntegrationHost() {
  const snapshot = useUi3LiveSnapshot();
  if (!snapshot.readyForAuthenticatedShell || !snapshot.user) {
    return <main className="min-h-screen p-6" role="status">
      <h1 className="text-xl font-semibold">Locat UI 3.0 integration</h1>
      <p>Identity-key unlock and authentication are required.</p>
      <Link to="/messages" className="underline">Return to Locat</Link>
    </main>;
  }
  return <main className="min-h-screen locat-mesh p-6 md:p-10">
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="obsidian-panel rounded-2xl p-6">
        <p className="obsidian-kicker">UI 3.0 · Live integration checkpoint</p>
        <h1 className="mt-2 text-3xl font-semibold">Welcome, {snapshot.user.displayName}</h1>
        <p className="mt-2 text-secondary">Authenticated through the existing Locat identity and session providers.</p>
        <p className="mt-2" role="status">Server: {snapshot.connected ? "Connected" : "Offline"}</p>
        <p className="mt-2 text-sm text-secondary">This is the live integration host, not the final UI 3.0 screens. Preview fixtures are not loaded.</p>
        <Link to="/messages" className="mt-4 inline-block rounded-xl border border-border px-4 py-2 hover:bg-accent">Back to existing Locat</Link>
      </header>
      <section aria-label="Module integration status" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {snapshot.modules.map((module) => <div key={module.id} className="obsidian-panel rounded-xl p-4">
          <div className="font-semibold">{module.id}</div>
          <div className="text-sm text-secondary">{module.availability}</div>
          {module.reason && <p className="mt-1 text-xs text-secondary">{module.reason}</p>}
        </div>)}
      </section>
    </div>
  </main>;
}
