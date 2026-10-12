import { DeviceMediaLibrary } from "./DeviceMediaLibrary";
import { useEffect, useRef, useState } from "react";
import { nextMusicIndex, type RepeatMode } from "@/lib/musicQueue";
import { MusicEqualizer } from "./MusicEqualizer";
import { LocalCinemaPlayer } from "./LocalCinemaPlayer";
export function LocalMediaQueue({ kind }: { kind: "cinema" | "music" }) {
  const [files, setFiles] = useState<File[]>([]), [index, setIndex] = useState(0), [url, setUrl] = useState("");
  const [repeat, setRepeat] = useState<RepeatMode>("off"), [autoplay, setAutoplay] = useState(false);
  const activeUrl = useRef("");
  const [feedback, setFeedback] = useState("");
  useEffect(() => () => { if (activeUrl.current) URL.revokeObjectURL(activeUrl.current); }, []);
  const open = (rows: File[], next: number, play = false) => {
    if (activeUrl.current) URL.revokeObjectURL(activeUrl.current);
    activeUrl.current = rows[next] ? URL.createObjectURL(rows[next]) : "";
    setFiles(rows); setIndex(next); setUrl(activeUrl.current); setAutoplay(play);
  };
  const music = kind === "music", file = files[index];
  return <section className="rounded-2xl border bg-card p-5" aria-label="Local media player"><h2 className="font-semibold">{music ? "Local Music" : "Local Cinema"}</h2><p className="my-2 text-xs text-secondary">Choose up to 256 files from this device. Files are not uploaded. Formats depend on its codecs; Music includes 5/10/15/31-band EQ.</p>
    <DeviceMediaLibrary kind={kind} />
    <input aria-label={music ? "Choose local music" : "Choose local movie"} type="file" multiple accept={music ? "audio/*,.flac,.alac,.opus" : "video/*,.mkv,.mov"} onChange={event => { const selected = [...(event.target.files ?? [])]; if (!selected.length) return; setFeedback(selected.length > 256 ? "Loaded the first 256 files; choose a smaller selection to include the rest." : ""); open(selected.slice(0, 256), 0); event.target.value = ""; }} className="w-full text-sm" />
    {feedback && <p role="status" className="mt-2 text-xs text-secondary">{feedback}</p>}
    {file && url && <div className="mt-4 space-y-3"><p className="truncate text-sm" data-testid="local-now-playing">{file.name}</p>{music ? <MusicEqualizer key={url} src={url} autoplay={autoplay} repeatOne={repeat === "one"} onEnded={() => { const next = nextMusicIndex(index, files.length, repeat, false); if (next !== null) open(files, next, true); }} /> : <LocalCinemaPlayer key={url} file={file} src={url} onEnded={() => {}} />}
      <div className="flex flex-wrap items-center gap-2"><button type="button" disabled={index === 0} onClick={() => open(files, index - 1)} className="min-h-11 rounded-xl border px-3 text-sm disabled:opacity-40">Previous</button><span className="text-xs text-secondary">{index + 1} / {files.length}</span><button type="button" disabled={index >= files.length - 1} onClick={() => open(files, index + 1)} className="min-h-11 rounded-xl border px-3 text-sm disabled:opacity-40">Next</button>{music && <label className="text-sm">Repeat <select aria-label="Local Music repeat" value={repeat} onChange={event => setRepeat(event.target.value as RepeatMode)} className="min-h-11 rounded-xl border bg-background px-2"><option value="off">Off</option><option value="one">One track</option><option value="all">Whole queue</option></select></label>}<button type="button" onClick={() => open([], 0)} className="min-h-11 px-3 text-sm underline">Close media</button></div>
      <ol aria-label="Local playback queue" className="max-h-56 space-y-1 overflow-y-auto">{files.map((row, position) => <li key={position}><button type="button" aria-current={position === index ? "true" : undefined} onClick={() => open(files, position)} className="min-h-11 w-full truncate rounded-lg border px-3 text-left text-sm">{position + 1}. {row.name}</button></li>)}</ol>
    </div>}
  </section>;
}
