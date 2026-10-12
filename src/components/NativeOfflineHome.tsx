import { useEffect, useRef, useState } from "react";
import { MusicEqualizer } from "./media/MusicEqualizer";
import { LocatMark, LocatWordmark } from "./LocatBrand";
import { AppLockSection } from "./chat/AppLockSection";
import { MODULES } from "@/modules/registry";
import { detectPlatform } from "@/lib/platform";

type LocalSection = "cinema" | "music" | "performance" | "protection";
const localSections = new Set(["cinema", "music", "performance"]);
/** Deliberately independent of server accounts, local chat archives and RPC providers. */
export function NativeOfflineHome({ onExit }: { onExit: () => void }) {
  const [section, setSection] = useState<LocalSection | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const activeUrl = useRef("");
  useEffect(() => () => { if (activeUrl.current) URL.revokeObjectURL(activeUrl.current); }, []);
  const choose = (next: File | null) => {
    if (activeUrl.current) URL.revokeObjectURL(activeUrl.current);
    activeUrl.current = next ? URL.createObjectURL(next) : "";
    setFile(next); setUrl(activeUrl.current);
  };
  const select = (next: LocalSection) => { choose(null); setSection(next); };
  return <main className="locat-mesh min-h-dvh p-4 pb-24 text-foreground sm:p-6 sm:pb-24" data-testid="native-offline-home">
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><LocatMark className="h-12 w-12" /><div><LocatWordmark /><h1 className="text-sm text-secondary">Non-server mode</h1></div></div><button type="button" onClick={onExit} className="min-h-11 rounded-xl border px-3 text-sm">Back to login</button></header>
      <p className="text-sm text-secondary">Play files from this device without a server account. Server accounts, messages, encrypted stores and shared libraries stay locked.</p>
      <section aria-label="Local tools" className="grid gap-3 sm:grid-cols-3">
        {MODULES.filter(module => localSections.has(module.id)).map(module => <button key={module.id} type="button" onClick={() => select(module.id as LocalSection)} aria-pressed={section === module.id} className="min-h-24 rounded-2xl border bg-card p-4 text-left hover:border-primary"><module.icon className="mb-2 h-5 w-5 ember-text" /><span className="block font-semibold">{module.id === "performance" ? "Device diagnostics" : `Local ${module.name}`}</span><span className="text-xs text-secondary">No server required</span></button>)}
      </section>
      {(section === "cinema" || section === "music") && <section className="rounded-2xl border bg-card p-5" aria-label="Local media player">
        <h2 className="font-semibold">{section === "music" ? "Local Music" : "Local Cinema"}</h2>
        <p className="my-2 text-xs text-secondary">Choose a file from this device. Formats depend on its codecs. Music includes the shared 5/10/15/31-band EQ.</p>
        <input key={section} aria-label={section === "music" ? "Choose local music" : "Choose local movie"} type="file" accept={section === "music" ? "audio/*,.flac,.alac,.opus" : "video/*,.mkv,.mov"} onChange={event => choose(event.target.files?.[0] ?? null)} className="w-full text-sm" />
        {file && url && <div className="mt-3"><p className="mb-2 truncate text-sm">{file.name}</p>{section === "music" ? <MusicEqualizer key={url} src={url} onEnded={() => {}} /> : <video controls playsInline src={url} className="max-h-[60dvh] w-full rounded-xl bg-black" />}<button type="button" className="mt-2 min-h-11 text-sm underline" onClick={() => choose(null)}>Close media</button></div>}
      </section>}
      {section === "performance" && <section className="rounded-2xl border bg-card p-5"><h2 className="font-semibold">Device diagnostics</h2><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><div><dt>Runtime</dt><dd>{detectPlatform()}</dd></div><div><dt>Reported logical processors</dt><dd>{navigator.hardwareConcurrency ?? "Unavailable"}</dd></div><div><dt>Secure context</dt><dd>{window.isSecureContext ? "Yes" : "No"}</dd></div><div><dt>Media Source Extensions</dt><dd>{typeof MediaSource !== "undefined" ? "API available" : "Unavailable"}</dd></div></dl><p className="mt-3 text-xs text-secondary">API availability is not a measured playback or GPU benchmark.</p></section>}
      <section className="rounded-2xl border bg-card p-5"><h2 className="font-semibold">Device protection</h2><p className="my-2 text-xs text-secondary">Optional: require a passphrase stored as a salted hash on this device to open Locat, including non-server mode. It is separate from your server password and does not encrypt your original movies or music.</p><button type="button" onClick={() => select("protection")} className="min-h-11 rounded-xl border px-3 text-sm">Set or manage device passphrase</button>{section === "protection" && <div className="mt-4"><AppLockSection /></div>}</section>
      <section aria-label="Account and server sections"><h2 className="mb-3 font-semibold">Account and server sections</h2><div className="grid gap-3 sm:grid-cols-3">{MODULES.filter(module => module.id !== "dashboard" && !localSections.has(module.id)).map(module => <div key={module.id} aria-disabled="true" data-testid={`local-disabled-${module.id}`} className="rounded-2xl border bg-card/50 p-4 opacity-60"><module.icon className="mb-2 h-5 w-5" /><h3 className="font-semibold">{module.name}</h3><p className="text-xs text-secondary">{module.status === "planned" ? "Not implemented yet" : module.id === "remote" ? "Separate approved remote host required" : "Server-account sign-in required"}</p></div>)}</div></section>
    </div>
  </main>;
}
