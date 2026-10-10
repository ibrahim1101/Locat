import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

export function CinemaHlsPlayer({ url }: { url: string }) {
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
    const onPlaying = () => { setError(""); setStatus("Playing"); };
    const onWaiting = () => setStatus("Buffering…");
    video.addEventListener("playing", onPlaying);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("progress", update);
    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: false, maxBufferLength: 20, backBufferLength: 30 });
      hls.on(Hls.Events.MANIFEST_PARSED, () => { if (!cancelled) { setStatus("Ready"); void video.play().catch(() => setStatus("Press Play to begin")); } });
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
      video.pause();
      video.removeAttribute("src");
      video.load();
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("progress", update);
    };
  }, [url]);
  return <div className="space-y-2">
    <video ref={videoRef} controls playsInline preload="metadata" className="max-h-[55vh] w-full rounded-xl bg-black" />
    <div className="flex items-center justify-between text-xs text-secondary">
      <span aria-live="polite">{status}</span><span>Buffered: {buffered}%</span>
    </div>
    {error && <p role="alert" className="rounded-lg border border-destructive/50 p-2 text-sm text-destructive">{error}</p>}
  </div>;
}
