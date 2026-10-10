import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Film, Music2, ArrowLeft, FolderOpen, Server } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";

export default function MediaLocal({ kind }: { kind: "cinema" | "music" }) {
  const music = kind === "music";
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  function choose(next?: File) {
    if (!next) return;
    setFile(next);
    setUrl(URL.createObjectURL(next));
  }
  const Icon = music ? Music2 : Film;
  return <AppShell active="dashboard">
    <main className="locat-mesh flex-1 overflow-y-auto px-4 py-8 text-foreground">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-secondary"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
        <header className="flex items-center gap-4">
          <span className="rounded-2xl border border-primary/40 bg-primary/10 p-4 ember-text"><Icon className="h-7 w-7" /></span>
          <div><p className="obsidian-kicker">Locat Media Hub · Early access</p><h1 className="text-3xl font-semibold">{music ? "Music" : "Cinema"}</h1></div>
        </header>
        <section className="rounded-2xl border border-border bg-card/80 p-5">
          <h2 className="flex items-center gap-2 font-semibold"><FolderOpen className="h-4 w-4 ember-text" /> Open a local {music ? "audio" : "video"} file</h2>
          <p className="my-3 text-sm text-secondary">Playback uses this device's browser codecs. Full library streaming and advanced {music ? "EQ/DSP" : "transcoding"} are not connected yet.</p>
          <input type="file" accept={music ? "audio/*,.flac,.alac,.wav" : "video/*,.mkv,.mov,.mp4"} onChange={e => { choose(e.target.files?.[0]); e.target.value = ""; }} aria-label="Select local media" className="w-full text-sm" />
          {url && file && <div className="mt-5 space-y-3">
            <p className="truncate text-sm">{file.name}</p>
            {music ? <audio key={url} src={url} controls className="w-full" /> : <video key={url} src={url} controls playsInline className="max-h-[65vh] w-full rounded-xl bg-black" />}
            <button type="button" className="text-sm text-secondary underline" onClick={() => { setFile(null); setUrl(""); }}>Close media</button>
          </div>}
        </section>
        <section className="rounded-2xl border border-border bg-card/60 p-5">
          <h2 className="flex items-center gap-2 font-semibold"><Server className="h-4 w-4 ember-text" /> Server library integration</h2>
          <p className="mt-2 text-sm text-secondary">The Emergent Media Hub services are being adapted to Locat authentication and its Obsidian Ember interface. No separate blue-themed application is required.</p>
        </section>
      </div>
    </main>
  </AppShell>;
}
