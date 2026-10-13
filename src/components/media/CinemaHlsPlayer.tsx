import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

export function CinemaHlsPlayer({ url, durationSeconds, startSeconds = 0, autoplay = true, onPositionChange }: { url: string; durationSeconds?: number; startSeconds?: number; autoplay?: boolean; onPositionChange?: (position: number, playing: boolean) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const positionCallback = useRef(onPositionChange);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Preparing transcoded playback…");
  const [buffered, setBuffered] = useState(0);
  const [bufferedAhead, setBufferedAhead] = useState(0);
  const is4k = new URL(url, "http://localhost").searchParams.get("quality") === "4k";
  useEffect(() => { positionCallback.current = onPositionChange; }, [onPositionChange]);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let hls: Hls | null = null;
    let cancelled = false;
    let manifestRetries = 0;
    let mediaRecoveryAttempts = 0;
    const MAX_MEDIA_RECOVERIES = 3;
    let waitingForBuffer = false;
    let initialPlaybackStarted = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let startupTimer: ReturnType<typeof setTimeout> | undefined;
    let userPaused = false;
    const update = () => {
      let ahead = 0;
      for (let i = 0; i < video.buffered.length; i++) {
        if (video.buffered.start(i) <= video.currentTime && video.buffered.end(i) >= video.currentTime) {
          ahead = Math.max(0, video.buffered.end(i) - video.currentTime);
          break;
        }
      }
      setBufferedAhead(Math.round(ahead));
      const total = durationSeconds && durationSeconds > 0 ? durationSeconds : video.duration;
      setBuffered(Number.isFinite(total) && total > 0 ? Math.min(100, Math.round(ahead / total * 100)) : 0);
      if (waitingForBuffer && ahead >= 12 && !cancelled && !userPaused) {
        if (startupTimer) clearTimeout(startupTimer);
        waitingForBuffer = false;
        initialPlaybackStarted = true;
        void video.play().catch(() => setStatus("Press Play to begin"));
      }
    };
    const report = () => positionCallback.current?.(startSeconds + video.currentTime, !video.paused);
    const onPlaying = () => { mediaRecoveryAttempts = 0; if (startupTimer) clearTimeout(startupTimer); initialPlaybackStarted = true; waitingForBuffer = false; setError(""); setStatus("Playing"); report(); };
    const onPause = () => { if (waitingForBuffer) { userPaused = true; waitingForBuffer = false; if (startupTimer) clearTimeout(startupTimer); } setStatus("Paused"); report(); };
    const onWaiting = () => setStatus("Buffering…");
    video.addEventListener("playing", onPlaying);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", report);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("progress", update);
    video.addEventListener("timeupdate", update);
    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: false, maxBufferLength: is4k ? 30 : 12, maxMaxBufferLength: is4k ? 60 : 24, backBufferLength: 15, maxBufferSize: is4k ? 120 * 1024 * 1024 : 40 * 1024 * 1024 });
      hls.on(Hls.Events.BUFFER_APPENDED, () => { if (!cancelled) update(); });
      hls.on(Hls.Events.MANIFEST_PARSED, () => { if (!cancelled) { setStatus("Ready"); if (autoplay && is4k && !initialPlaybackStarted) { waitingForBuffer = true; setStatus("Pre-buffering 4K (target 12 seconds)…"); update(); startupTimer = setTimeout(() => { if (!cancelled && waitingForBuffer && !userPaused) { waitingForBuffer = false; setStatus("Starting with available buffer…"); void video.play().catch(() => setStatus("Press Play to begin")); } }, 20000); } else if (autoplay) void video.play().catch(() => setStatus("Press Play to begin")); else setStatus("Paused at restored position"); } });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal || cancelled) return;
        if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR && manifestRetries < 3) {
          manifestRetries += 1;
          setStatus(`Preparing stream… retry ${manifestRetries}/3`);
          retryTimer = setTimeout(() => { if (!cancelled) hls?.loadSource(url); }, 2000);
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveryAttempts < MAX_MEDIA_RECOVERIES) {
          mediaRecoveryAttempts += 1;
          setStatus(`Recovering decoder… attempt ${mediaRecoveryAttempts}/${MAX_MEDIA_RECOVERIES}`);
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
      if (retryTimer) clearTimeout(retryTimer);
      if (startupTimer) clearTimeout(startupTimer);
      hls?.destroy();
      // Release server-side FFmpeg and temporary HLS segments on player exit/quality change.
      const releaseUrl = new URL(url, window.location.origin);
      releaseUrl.searchParams.set("action", "release");
      void fetch(releaseUrl, { method: "POST", credentials: "include", keepalive: true }).catch(() => {});
      video.removeAttribute("src");
      video.load();
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", report);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("progress", update);
      video.removeEventListener("timeupdate", update);
    };
  }, [url, startSeconds, autoplay, is4k, durationSeconds]);
  const formatTime = (seconds: number) => { const n = Math.floor(seconds); return `${Math.floor(n / 3600)}:${String(Math.floor(n / 60) % 60).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`; };
  return <div className="space-y-2">
    <video crossOrigin="anonymous" ref={videoRef} controls playsInline preload="metadata" className="max-h-[55vh] w-full rounded-xl bg-black" />
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-secondary">
      <span aria-live="polite">{status}</span><span>{durationSeconds && durationSeconds > 0 ? `Position: ${formatTime(startSeconds)} + stream time · Source duration: ${formatTime(durationSeconds)} · ` : ""}Buffered ahead: {bufferedAhead}s ({buffered}%)</span>
    </div>
    {error && <p role="alert" className="rounded-lg border border-destructive/50 p-2 text-sm text-destructive">{error}</p>}
  </div>;
}
