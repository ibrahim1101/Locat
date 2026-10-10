import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Film, Music2, ArrowLeft, FolderOpen, Server } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { MusicEqualizer } from "@/components/media/MusicEqualizer";

export default function MediaLocal({ kind }: { kind: "cinema" | "music" }) {
  const music = kind === "music";
  const [files, setFiles] = useState<File[]>([]);
  const [selected, setSelected] = useState(0);
  const file = files[selected] ?? null;

  function choose(next: File[]) {
    if (!next.length) return;
    setFiles(next);
    setSelected(0);
  }
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    queueMicrotask(() => setUrl(objectUrl));
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  const Icon = music ? Music2 : Film;
  return <AppShell active={kind}>
    <main className="locat-mesh flex-1 overflow-y-auto px-4 py-8 text-foreground">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-secondary"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
        <header className="flex items-center gap-4">
          <span className="rounded-2xl border border-primary/40 bg-primary/10 p-4 ember-text"><Icon className="h-7 w-7" /></span>
          <div><p className="obsidian-kicker">Locat Media Hub · Early access</p><h1 className="text-3xl font-semibold">{music ? "Music" : "Cinema"}</h1></div>
        </header>
        <section className="rounded-2xl border border-border bg-card/80 p-5">
          <h2 className="flex items-center gap-2 font-semibold"><FolderOpen className="h-4 w-4 ember-text" /> Open local {music ? "audio tracks" : "videos"}</h2>
          <p className="my-3 text-sm text-secondary">Playback uses this device's browser codecs. Full library streaming and advanced {music ? "EQ/DSP" : "transcoding"} are not connected yet.</p>
          <input type="file" multiple accept={music ? "audio/*,.flac,.alac,.wav" : "video/*,.mkv,.mov,.mp4"} onChange={e => { choose(Array.from(e.target.files ?? [])); e.target.value = ""; }} aria-label="Select local media" className="w-full text-sm" />
          {url && file && <div className="mt-5 space-y-3">
            <p className="truncate text-sm">{file.name}</p>
            {music ? <MusicEqualizer src={url} onEnded={() => setSelected(i => Math.min(i + 1, files.length - 1))} /> : <video key={url} src={url} controls playsInline className="max-h-[65vh] w-full rounded-xl bg-black" />}
            <div className="flex flex-wrap items-center gap-3 text-sm"><button type="button" disabled={selected === 0} className="rounded-lg border px-3 py-2 disabled:opacity-40" onClick={() => setSelected(i => Math.max(0, i - 1))}>Previous</button><span className="text-secondary">{selected + 1} / {files.length}</span><button type="button" disabled={selected >= files.length - 1} className="rounded-lg border px-3 py-2 disabled:opacity-40" onClick={() => setSelected(i => Math.min(files.length - 1, i + 1))}>Next</button><button type="button" className="text-secondary underline" onClick={() => { setFiles([]); setUrl(""); }}>Close media</button></div>{files.length > 1 && <ol aria-label="Local playback queue" className="max-h-48 space-y-1 overflow-y-auto">{files.map((track, index) => <li key={index}><button type="button" aria-current={selected === index ? "true" : undefined} onClick={() => setSelected(index)} className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm ${selected === index ? "bg-primary/15 ember-text" : "text-secondary hover:bg-accent"}`}>{index + 1}. {track.name}</button></li>)}</ol>}
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
