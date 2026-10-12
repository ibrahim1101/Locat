import { useEffect, useRef, useState } from "react";
import { PLAYBACK_PROGRESS_KEY, parsePlaybackProgress, playbackFileId, resumePosition, updatePlaybackProgress } from "@/lib/playbackProgress";
export function LocalCinemaPlayer({ file, src, onEnded }: { file: File; src: string; onEnded: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const idRef = useRef("");
  const lastWrite = useRef(0);
  const [rate, setRate] = useState(1), [fit, setFit] = useState<"contain" | "cover">("contain");
  const [subtitle, setSubtitle] = useState("");
  const subtitleUrl = useRef("");
  const subtitleLease = useRef(0);
  useEffect(() => () => { subtitleLease.current++; if (subtitleUrl.current) URL.revokeObjectURL(subtitleUrl.current); }, []);
  const [notice, setNotice] = useState("");
  const save = (video: HTMLVideoElement): boolean => {
    if (!idRef.current) return true;
    try {
      const rows = parsePlaybackProgress(localStorage.getItem(PLAYBACK_PROGRESS_KEY));
      localStorage.setItem(PLAYBACK_PROGRESS_KEY, JSON.stringify(updatePlaybackProgress(rows, idRef.current, video.currentTime, video.duration)));
      return true;
    } catch { return false; }
  };
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false, restored = false;
    const restore = () => {
      if (restored || !idRef.current || video.readyState < 1) return;
      restored = true;
      try {
        const checkpoint = parsePlaybackProgress(localStorage.getItem(PLAYBACK_PROGRESS_KEY)).find(row => row.id === idRef.current);
        const position = resumePosition(checkpoint, video.duration);
        if (position > 0) { video.currentTime = position; setNotice("Resumed your saved position on this device."); }
      } catch { setNotice("Saved progress unavailable; playback still works."); }
    };
    video.addEventListener("loadedmetadata", restore);
    void playbackFileId(file).then(id => { if (!cancelled) { idRef.current = id; restore(); } }).catch(() => { if (!cancelled) setNotice("Saved progress unavailable; playback still works."); });
    return () => { cancelled = true; video.removeEventListener("loadedmetadata", restore); save(video); };
  }, [file]);
  const checkpoint = (video: HTMLVideoElement) => { if (!save(video)) setNotice("Playback continues; device storage prevented saving progress."); };
  return <div className="space-y-2"><video ref={videoRef} controls playsInline src={src} onPause={event => checkpoint(event.currentTarget)} onTimeUpdate={event => { if (Date.now() - lastWrite.current >= 5000) { lastWrite.current = Date.now(); checkpoint(event.currentTarget); } }} onEnded={event => { checkpoint(event.currentTarget); onEnded(); }} onError={() => setNotice("This movie could not play. Check this device’s codec support.")} className="aspect-video max-h-[60dvh] w-full rounded-xl bg-black" style={{ objectFit: fit }}>{subtitle && <track key={subtitle} src={subtitle} kind="subtitles" srcLang="en" label="Local subtitles" default />}</video><div className="flex flex-wrap items-center gap-3"><label>Playback speed <select aria-label="Cinema playback speed" value={rate} onChange={event => { const next = Number(event.target.value); setRate(next); if (videoRef.current) videoRef.current.playbackRate = next; }} className="min-h-11 rounded-xl border bg-background px-2">{[.5, .75, 1, 1.25, 1.5, 2].map(value => <option key={value} value={value}>{value}×</option>)}</select></label><label>Video fit <select aria-label="Cinema video fit" value={fit} onChange={event => setFit(event.target.value as "contain" | "cover")} className="min-h-11 rounded-xl border bg-background px-2"><option value="contain">Fit</option><option value="cover">Fill</option></select></label><button type="button" disabled={!document.fullscreenEnabled} onClick={() => { void videoRef.current?.requestFullscreen().catch(() => setNotice("Fullscreen unavailable.")); }} className="min-h-11 rounded-xl border px-3 disabled:opacity-40">Fullscreen</button><button type="button" disabled={!document.pictureInPictureEnabled} onClick={() => { void videoRef.current?.requestPictureInPicture().catch(() => setNotice("Picture-in-picture unavailable.")); }} className="min-h-11 rounded-xl border px-3 disabled:opacity-40">Picture in picture</button><label className="text-sm">Local WebVTT subtitles<input aria-label="Local WebVTT subtitles" type="file" accept=".vtt,text/vtt" onChange={async event => { const selected = event.target.files?.[0]; if (!selected) return; const lease = ++subtitleLease.current; try { if (selected.size > 2_000_000) throw new Error("Choose subtitles smaller than 2 MB."); const text = await selected.text(); if (subtitleLease.current !== lease) return; if (!text.replace(/^\uFEFF/, "").startsWith("WEBVTT")) throw new Error("Choose a WebVTT (.vtt) subtitle file."); if (subtitleUrl.current) URL.revokeObjectURL(subtitleUrl.current); subtitleUrl.current = URL.createObjectURL(new Blob([text], { type: "text/vtt" })); setSubtitle(subtitleUrl.current); setNotice("Local subtitles loaded; use the player caption control to toggle."); } catch (error) { if (subtitleLease.current === lease) setNotice(error instanceof Error ? error.message : "Subtitles unavailable."); } }} /></label>{subtitle && <button type="button" onClick={() => { subtitleLease.current++; URL.revokeObjectURL(subtitleUrl.current); subtitleUrl.current = ""; setSubtitle(""); }} className="min-h-11 rounded-xl border px-3">Remove subtitles</button>}</div>{notice && <p role="status" className="text-xs text-secondary">{notice}</p>}<button type="button" className="min-h-11 rounded-xl border px-3 text-sm" onClick={() => { const video = videoRef.current; if (video) { video.currentTime = 0; checkpoint(video); setNotice("Started from the beginning."); } }}>Start from beginning</button><p className="text-xs text-secondary">Progress stays on this device. Reselect the same unchanged file to resume. Unknown durations cannot be saved.</p></div>;
}
