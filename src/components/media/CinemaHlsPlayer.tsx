import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

export function CinemaHlsPlayer({ url, durationSeconds, startSeconds = 0, autoplay = true, onPositionChange }: { url: string; durationSeconds?: number; startSeconds?: number; autoplay?: boolean; onPositionChange?: (position: number, playing: boolean) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Preparing transcoded playback…");
  const [buffered, setBuffered] = useState(0);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let hls: Hls | null = null;
    let cancelled = false;
    const update = () => {
      if (!video.duration || !Number.isFinite(video.duration)) { setBuffered(0); return; }
      const end = video.buffered.length ? video.buffered.end(video.buffered.length - 1) : 0;
      setBuffered(Math.min(100, Math.round(end / video.duration * 100)));
    };
    const report = () => onPositionChange?.(startSeconds + video.currentTime, !video.paused);
    const onPlaying = () => { setError(""); setStatus("Playing"); report(); };
    const onPause = () => { setStatus("Paused"); report(); };
    const onWaiting = () => setStatus("Buffering…");
    video.addEventListener("playing", onPlaying);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", report);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("progress", update);
    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: false, maxBufferLength: 20, backBufferLength: 30 });
      hls.on(Hls.Events.MANIFEST_PARSED, () => { if (!cancelled) { setStatus("Ready"); if (autoplay) void video.play().catch(() => setStatus("Press Play to begin")); else setStatus("Paused at restored position"); } });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal || cancelled) return;
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          setStatus("Recovering decoder…");
          hls?.recoverMediaError();
        } else {
          setError("HLS playback failed: " + data.details);
          setStatus("Playback error");
          hls?.stopLoad();
        }
      });
      hls.loadSource(url);
      hls.attachMedia(video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
    } else {
      // Schedule unsupported-browser feedback outside the synchronous effect body.
      queueMicrotask(() => { if (!cancelled) setError("This browser does not support HLS playback or Media Source Extensions."); });
    }
    return () => {
      cancelled = true;
      hls?.destroy();
      // Release server-side FFmpeg and temporary HLS segments on player exit/quality change.
      const releaseUrl = new URL(url, window.location.origin);
      releaseUrl.searchParams.set("action", "release");
      void fetch(releaseUrl, { method: "POST", credentials: "same-origin", keepalive: true }).catch(() => {});
      video.removeAttribute("src");
      video.load();
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", report);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("progress", update);
    };
  }, [url, startSeconds, autoplay, onPositionChange]);
  const formatTime = (seconds: number) => { const n = Math.floor(seconds); return `${Math.floor(n / 3600)}:${String(Math.floor(n / 60) % 60).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`; };
  return <div className="space-y-2">
    <video ref={videoRef} controls playsInline preload="metadata" className="max-h-[55vh] w-full rounded-xl bg-black" />
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-secondary">
      <span aria-live="polite">{status}</span><span>{durationSeconds && durationSeconds > 0 ? `Position: ${formatTime(startSeconds)} + stream time · Source duration: ${formatTime(durationSeconds)} · ` : ""}Buffered: {buffered}%</span>
    </div>
    {error && <p role="alert" className="rounded-lg border border-destructive/50 p-2 text-sm text-destructive">{error}</p>}
  </div>;
}
