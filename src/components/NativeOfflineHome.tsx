import { Link, useLocation } from "react-router";
import { LocalPhotoEditor } from "./media/LocalPhotoEditor";
import { LocalMediaQueue } from "./media/LocalMediaQueue";
import { LocatMark, LocatWordmark } from "./LocatBrand";
import { AppLockSection } from "./chat/AppLockSection";
import { MODULES } from "@/modules/registry";
import { detectPlatform } from "@/lib/platform";

type LocalSection = "cinema" | "music" | "performance" | "protection" | "photos";
const localSections = new Set(["cinema", "music", "performance", "photos"]);
/** Deliberately independent of server accounts, local chat archives and RPC providers. */
export function NativeOfflineHome({ onExit }: { onExit: () => void }) {
  const { pathname } = useLocation();
  const candidate = pathname.startsWith("/local/") ? pathname.slice(7) : "";
  const section = localSections.has(candidate) || candidate === "protection" ? candidate as LocalSection : null;
  return <main className="locat-mesh min-h-dvh p-4 pb-24 text-foreground sm:p-6 sm:pb-24" data-testid="native-offline-home">
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><LocatMark className="h-12 w-12" /><div><LocatWordmark /><h1 className="text-sm text-secondary">Non-server mode</h1></div></div><button type="button" onClick={onExit} className="min-h-11 rounded-xl border px-3 text-sm">Back to login</button></header>
      {section && <Link to="/local" className="inline-flex min-h-11 items-center rounded-xl border px-3 text-sm">Back to local sections</Link>}
      {!section && <><p className="text-sm text-secondary">Play files from this device without a server account. Server accounts, messages, encrypted stores and shared libraries stay locked.</p>
      <section aria-label="Local tools" className="grid gap-3 sm:grid-cols-3">
        {MODULES.filter(module => localSections.has(module.id)).map(module => <Link key={module.id} to={`/local/${module.id}`} className="min-h-24 rounded-2xl border bg-card p-4 text-left hover:border-primary"><module.icon className="mb-2 h-5 w-5 ember-text" /><span className="block font-semibold">{module.id === "performance" ? "Device diagnostics" : `Local ${module.name}`}</span><span className="text-xs text-secondary">No server required</span></Link>)}
      </section>
      </>}
      {(section === "cinema" || section === "music") && <LocalMediaQueue key={section} kind={section} />}
      {section === "photos" && <LocalPhotoEditor />}
      {section === "performance" && <section className="rounded-2xl border bg-card p-5"><h2 className="font-semibold">Device diagnostics</h2><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><div><dt>Runtime</dt><dd>{detectPlatform()}</dd></div><div><dt>Reported logical processors</dt><dd>{navigator.hardwareConcurrency ?? "Unavailable"}</dd></div><div><dt>Secure context</dt><dd>{window.isSecureContext ? "Yes" : "No"}</dd></div><div><dt>Media Source Extensions</dt><dd>{typeof MediaSource !== "undefined" ? "API available" : "Unavailable"}</dd></div></dl><p className="mt-3 text-xs text-secondary">API availability is not a measured playback or GPU benchmark.</p></section>}
      {(!section || section === "protection") && <section className="rounded-2xl border bg-card p-5"><h2 className="font-semibold">Device protection</h2><p className="my-2 text-xs text-secondary">Optional: require a passphrase stored as a salted hash on this device to open Locat, including non-server mode. It is separate from your server password and does not encrypt your original movies or music.</p><Link to="/local/protection" className="min-h-11 rounded-xl border px-3 text-sm">Set or manage device passphrase</Link>{section === "protection" && <div className="mt-4"><AppLockSection /></div>}</section>}
      {!section && <section aria-label="Account and server sections"><h2 className="mb-3 font-semibold">Account and server sections</h2><div className="grid gap-3 sm:grid-cols-3">{MODULES.filter(module => module.id !== "dashboard" && !localSections.has(module.id)).map(module => <div key={module.id} aria-disabled="true" data-testid={`local-disabled-${module.id}`} className="rounded-2xl border bg-card/50 p-4 opacity-60"><module.icon className="mb-2 h-5 w-5" /><h3 className="font-semibold">{module.name}</h3><p className="text-xs text-secondary">{module.status === "planned" ? "Not implemented yet" : module.id === "remote" ? "Separate approved remote host required" : "Server-account sign-in required"}</p></div>)}</div></section>}
    </div>
  </main>;
}
