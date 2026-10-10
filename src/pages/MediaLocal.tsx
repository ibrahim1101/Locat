import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Film, Music2, ArrowLeft, FolderOpen, Server } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { MusicEqualizer } from "@/components/media/MusicEqualizer";
import { CinemaHlsPlayer } from "@/components/media/CinemaHlsPlayer";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/state/auth";

export default function MediaLocal({ kind }: { kind: "cinema" | "music" }) {
  const music = kind === "music";
  const { state } = useAuth();
  const libraries = trpc.media.libraries.useQuery(undefined, { enabled: state.status === "ready", retry: false });
  const hostedItems = trpc.media.items.useQuery(undefined, { enabled: state.status === "ready", retry: false });
  const [files, setFiles] = useState<File[]>([]);
  const [selected, setSelected] = useState(0);
  const [hostedSelection, setHostedSelection] = useState<{ id: string; libraryId: number; name: string } | null>(null);
  const inspection = trpc.media.probe.useQuery({ libraryId: hostedSelection?.libraryId ?? 0, id: hostedSelection?.id ?? "" }, { enabled: !music && state.status === "ready" && hostedSelection !== null, retry: false });
  const [playbackError, setPlaybackError] = useState("");
  const [forceDirect, setForceDirect] = useState(false);
  const [cinemaQuality, setCinemaQuality] = useState<"1080p" | "4k">("4k");
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
          <p className="my-3 text-sm text-secondary">Playback uses this device's browser codecs. Host streaming is available below; {music ? "native audio enhancements" : "automatic transcoding"} remain in development.</p>
          <input type="file" multiple accept={music ? "audio/*,.flac,.alac,.wav" : "video/*,.mkv,.mov,.mp4"} onChange={e => { choose(Array.from(e.target.files ?? [])); e.target.value = ""; }} aria-label="Select local media" className="w-full text-sm" />
          {url && file && <div className="mt-5 space-y-3">
            <p className="truncate text-sm">{file.name}</p>
            {music ? <MusicEqualizer src={url} onEnded={() => setSelected(i => Math.min(i + 1, files.length - 1))} /> : <video key={url} src={url} controls playsInline className="max-h-[65vh] w-full rounded-xl bg-black" />}
            <div className="flex flex-wrap items-center gap-3 text-sm"><button type="button" disabled={selected === 0} className="rounded-lg border px-3 py-2 disabled:opacity-40" onClick={() => setSelected(i => Math.max(0, i - 1))}>Previous</button><span className="text-secondary">{selected + 1} / {files.length}</span><button type="button" disabled={selected >= files.length - 1} className="rounded-lg border px-3 py-2 disabled:opacity-40" onClick={() => setSelected(i => Math.min(files.length - 1, i + 1))}>Next</button><button type="button" className="text-secondary underline" onClick={() => { setFiles([]); setUrl(""); }}>Close media</button></div>{files.length > 1 && <ol aria-label="Local playback queue" className="max-h-48 space-y-1 overflow-y-auto">{files.map((track, index) => <li key={index}><button type="button" aria-current={selected === index ? "true" : undefined} onClick={() => setSelected(index)} className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm ${selected === index ? "bg-primary/15 ember-text" : "text-secondary hover:bg-accent"}`}>{index + 1}. {track.name}</button></li>)}</ol>}
          </div>}
        </section>
        <section className="rounded-2xl border border-border bg-card/60 p-5">
          <h2 className="flex items-center gap-2 font-semibold"><Server className="h-4 w-4 ember-text" /> Server library integration</h2>
          {state.status !== "ready" ? <p className="mt-2 text-sm text-secondary">Connect and sign in to a Locat host to browse its authorized media folders. Local playback works without a server.</p> : <div className="mt-3 space-y-3 text-sm"><p className="text-secondary">{libraries.data?.length ?? 0} configured libraries · {hostedItems.data?.filter(item => item.kind === kind).length ?? 0} indexed {music ? "tracks" : "videos"}</p>{libraries.isError || hostedItems.isError ? <p role="alert" className="text-destructive">Media index unavailable. Check your server connection and media root configuration.</p> : null}{hostedSelection && <div className="space-y-2 rounded-xl border border-primary/30 p-3"><p className="truncate font-medium">{hostedSelection.name}</p>{!music && !forceDirect && inspection.data?.strategy === "transcode" ? <div className="space-y-2"><label className="flex items-center gap-2 text-xs text-secondary">Transcode quality <select aria-label="Cinema transcoding quality" value={cinemaQuality} onChange={e => setCinemaQuality(e.target.value as "1080p" | "4k")} className="rounded border border-border bg-card px-2 py-1 text-foreground"><option value="4k">4K (best quality, more GPU and storage)</option><option value="1080p">1080p (faster, smaller)</option></select></label><CinemaHlsPlayer key={`${hostedSelection.libraryId}-${hostedSelection.id}-${cinemaQuality}`} durationSeconds={inspection.data.durationSeconds ?? undefined} url={`/api/media/hls?library=${hostedSelection.libraryId}&id=${encodeURIComponent(hostedSelection.id)}&quality=${cinemaQuality}`} /></div> : music ? <audio key={`${hostedSelection.libraryId}-${hostedSelection.id}`} src={`/api/media/stream?library=${hostedSelection.libraryId}&id=${encodeURIComponent(hostedSelection.id)}`} controls className="w-full" /> : <video key={`${hostedSelection.libraryId}-${hostedSelection.id}`} src={`/api/media/stream?library=${hostedSelection.libraryId}&id=${encodeURIComponent(hostedSelection.id)}${!forceDirect && (inspection.data?.strategy === "remux" || inspection.data?.strategy === "transcode") ? `&mode=${inspection.data.strategy}` : ""}`} controls playsInline onError={() => setPlaybackError("Playback failed. Check codec compatibility, FFmpeg, or your host connection.")} onPlaying={() => setPlaybackError("")} className="max-h-[55vh] w-full rounded-xl bg-black" />}{playbackError && <div role="alert" className="space-y-2 rounded-lg border border-destructive/50 p-3 text-sm"><p>{playbackError}</p>{!music && (inspection.data?.strategy === "remux" || inspection.data?.strategy === "transcode") && !forceDirect && <button type="button" className="rounded-lg border px-3 py-1" onClick={() => { setPlaybackError(""); setForceDirect(true); }}>Try direct playback</button>}</div>}{!music && inspection.data && <p className="text-xs text-secondary">Video: {inspection.data.videoCodec ?? "unknown"} · Audio: {inspection.data.audioCodec ?? "none"} · Recommended: {inspection.data.strategy}. {inspection.data.reason}</p>}{!music && inspection.isError && <p className="text-xs text-secondary">FFprobe unavailable; trying direct playback.</p>}<p className="text-xs text-secondary">Direct playback requires a browser-supported codec and a signed-in session on this host.</p></div>}<ul className="max-h-64 space-y-1 overflow-y-auto">{hostedItems.data?.filter(item => item.kind === kind).map((item, index) => <li key={`${item.library}-${item.id}-${index}`}><button type="button" onClick={() => { setPlaybackError(""); setForceDirect(false); setHostedSelection({ id: item.id, libraryId: item.libraryId, name: item.name }); }} className="w-full rounded-lg border border-border/60 px-3 py-2 text-left hover:border-primary/50"><span className="block truncate">{item.name}</span><span className="text-xs text-secondary">{item.library} · {(item.sizeBytes / 1048576).toFixed(1)} MB · Play</span></button></li>)}</ul><p className="text-xs text-secondary">Direct streaming supports browser-compatible media; FFmpeg remuxing and experimental segmented HLS transcoding are available for eligible videos. Hardware encoding is optional.</p></div>}
        </section>
      </div>
    </main>
  </AppShell>;
}
