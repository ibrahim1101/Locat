import { MusicEqualizer } from "./media/MusicEqualizer";
import { useState } from "react";
import { NativeServerSetup } from "./NativeServerSetup";
import { LocatMark, LocatWordmark } from "./LocatBrand";

export function NativeOfflineHome() {
  const [remote, setRemote] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  function choose(next: File | undefined) {
    if (!next) return;
    if (url) URL.revokeObjectURL(url);
    setFile(next);
    setUrl(URL.createObjectURL(next));
  }
  if (remote) return <main className="h-dvh p-4"><button type="button" onClick={() => setRemote(false)} className="mb-3 underline">Back to Local Mode</button><iframe title="Locat Remote client" src={`${import.meta.env.BASE_URL}remote-client/index.html`} sandbox="allow-scripts allow-same-origin" allow="display-capture; autoplay" className="h-[85vh] w-full rounded-xl border" /></main>;
  if (connecting) return <main className="min-h-dvh bg-background p-5 text-foreground">
    <button type="button" onClick={() => setConnecting(false)} className="mb-4 text-sm underline">Back to Local Mode</button>
    <NativeServerSetup />
  </main>;
  return <main className="locat-mesh min-h-dvh p-6 text-foreground" data-testid="native-offline-home">
    <div className="mx-auto max-w-lg space-y-5">
      <header className="flex items-center gap-3"><LocatMark className="h-12 w-12" /><div><LocatWordmark /><p className="text-sm text-secondary">Local Mode — no server required</p></div></header>
      <section className="rounded-2xl border bg-card p-5">
        <h1 className="text-xl font-semibold">Welcome to Locat</h1>
        <p className="mt-2 text-sm text-secondary">Play supported media from your device. Connect a server to use messaging, shared libraries, and sync.</p>
        <button type="button" onClick={() => setConnecting(true)} className="locat-metal-button mt-4 w-full rounded-xl p-3 font-semibold">Connect to Server</button>
      </section>
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-semibold">Local media player</h2>
        <p className="my-2 text-xs text-secondary">Supported formats depend on this device’s codecs. Local Music includes the shared 5/10/15/31-band EQ.</p>
        <input aria-label="Choose local media" type="file" accept="audio/*,video/*,.mkv,.mov,.flac" onChange={e => choose(e.target.files?.[0])} className="w-full text-sm" />
        {file && url && <div className="mt-3">
          <p className="mb-2 truncate text-sm">{file.name}</p>
          {(file.type.startsWith("audio/") || /\.(mp3|flac|alac|wav|m4a|ogg|opus|aac)$/i.test(file.name)) ? <MusicEqualizer key={url} src={url} onEnded={() => {}} /> : <video controls playsInline src={url} className="w-full" />}
          <button type="button" className="mt-2 text-sm underline" onClick={() => { URL.revokeObjectURL(url); setUrl(""); setFile(null); }}>Close</button>
        </div>}
      </section>
      <section className="rounded-2xl border bg-card p-5">
        <button type="button" className="mb-4 rounded-lg border px-4 py-2 text-sm" onClick={() => setRemote(true)}>Open Remote prototype</button><h2 className="font-semibold">Server features</h2>
        <p className="mt-2 text-sm text-secondary">Messages · Cinema library · Music library · Device sync</p>
        <button type="button" className="mt-3 rounded-lg border px-4 py-2 text-sm" onClick={() => setConnecting(true)}>Connect to unlock</button>
      </section>
    </div>
  </main>;
}
