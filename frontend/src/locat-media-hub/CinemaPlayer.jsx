import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Film, Gauge, Signal } from "lucide-react";
import { api, formatBytes, formatBps, formatDuration } from "./api";
import { PathChip } from "./chips";
import { Button } from "@/components/ui/button";

function webClientCapabilities() {
  const el = typeof document !== "undefined" ? document.createElement("video") : null;
  const canPlay = (mime) => (el ? el.canPlayType(mime) : "");
  // Baseline: every modern browser plays H.264 + AAC in MP4 and Opus/VP9 in WebM.
  // Some headless/chromium builds return empty strings for licensed codecs, so we
  // start from a known-good set and layer on anything else the browser advertises.
  const containers = new Set(["mp4", "mov", "m4v", "webm"]);
  const video_codecs = new Set(["h264", "vp9"]);
  const audio_codecs = new Set(["aac", "mp3", "opus", "vorbis"]);
  if (canPlay('video/mp4; codecs="hev1.1.6.L93.B0"') || canPlay('video/mp4; codecs="hvc1.1.6.L93.B0"')) video_codecs.add("hevc");
  if (canPlay('video/mp4; codecs="av01.0.05M.08"')) video_codecs.add("av1");
  if (canPlay('audio/flac')) audio_codecs.add("flac");
  if (canPlay('audio/mp4; codecs="ac-3"')) audio_codecs.add("ac3");
  return {
    containers: Array.from(containers),
    video_codecs: Array.from(video_codecs),
    audio_codecs: Array.from(audio_codecs),
    hdr: [],
    max_video_height: 2160,
    subtitle_codecs: ["webvtt"],
  };
}

function KV({ k, v, testid }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/[0.04]" data-testid={testid}>
      <span className="text-zinc-500 text-[11px] uppercase tracking-wider">{k}</span>
      <span className="text-zinc-100 font-mono text-xs">{v ?? "—"}</span>
    </div>
  );
}

export default function CinemaPlayer() {
  const { id } = useParams();
  const nav = useNavigate();
  const [item, setItem] = useState(null);
  const [decision, setDecision] = useState(null);
  const [diag, setDiag] = useState(null);
  const [bufferedSeconds, setBufferedSeconds] = useState(0);
  const [playbackError, setPlaybackError] = useState(null);
  const videoRef = useRef(null);
  const sessionIdRef = useRef(null);

  useEffect(() => {
    (async () => {
      const it = await api.item(id);
      setItem(it);
      const caps = webClientCapabilities();
      const dec = await api.decision(id, caps);
      setDecision(dec);
    })().catch((e) => console.error(e));
  }, [id]);

  // Poll diagnostics every 1.5s while playing
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const d = await api.diagnostics(id, sessionIdRef.current || null);
        setDiag(d);
      } catch {}
      const v = videoRef.current;
      if (v && v.buffered.length) {
        setBufferedSeconds(Math.max(0, v.buffered.end(v.buffered.length - 1) - (v.currentTime || 0)));
      }
    }, 1500);
    return () => clearInterval(t);
  }, [id]);

  const streamUrl = useMemo(() => (item ? api.streamUrl(item.id) : null), [item]);

  // capture session id from the first stream request
  useEffect(() => {
    if (!streamUrl) return;
    fetch(streamUrl, { method: "HEAD" }).then((r) => {
      sessionIdRef.current = r.headers.get("x-locat-session-id");
    }).catch(() => {});
  }, [streamUrl]);

  if (!item) {
    return <div className="text-zinc-500">Loading…</div>;
  }
  const v = item.video_streams?.[0];
  const a = item.audio_streams?.[0];

  return (
    <div className="grid lg:grid-cols-[1.6fr,1fr] gap-8 items-start" data-testid="cinema-player">
      <div>
        <Button variant="ghost" size="sm" onClick={() => nav(-1)}
                data-testid="player-back"
                className="text-zinc-400 hover:text-white hover:bg-white/5 mb-4">
          <ArrowLeft size={14} /> Back
        </Button>
        <div className="rounded-xl overflow-hidden border border-white/[0.08] bg-black shadow-[0_8px_40px_rgba(0,0,0,0.6)]">
          <video
            ref={videoRef}
            data-testid="player-video"
            src={streamUrl}
            controls playsInline
            className="w-full aspect-video bg-black"
            onError={() => setPlaybackError(
              "Browser could not decode this stream natively. In the real Locat Windows / Android client the native adapter would remux or decode this file; the web dev preview is limited by the headless browser codec table."
            )}
            onTimeUpdate={(e) => {
              const t = e.currentTarget.currentTime;
              if (Math.floor(t) % 5 === 0) {
                api.saveProgress(item.id, t).catch(() => {});
              }
            }}
          />
        </div>
        <div className="mt-5 flex items-start justify-between gap-5">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-500">
              {item.media_type}
              {item.season_number ? ` · S${String(item.season_number).padStart(2, "0")}E${String(item.episode_number).padStart(2, "0")}` : ""}
            </div>
            <h1 className="font-display text-3xl font-bold text-white tracking-tight">
              {item.title}{item.year ? <span className="text-zinc-500 ml-3 text-lg font-normal">({item.year})</span> : null}
            </h1>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {decision && <PathChip pathType={decision.path_type} size="lg" />}
              <span className="locat-chip text-zinc-300 border-white/15 bg-white/[0.03]">
                <Film size={11} /> {item.container}
              </span>
              <span className="locat-chip text-zinc-300 border-white/15 bg-white/[0.03]">
                {v ? `${v.codec} · ${v.width}×${v.height}` : "—"}
              </span>
              <span className="locat-chip text-zinc-300 border-white/15 bg-white/[0.03]">
                {a ? `${a.codec} · ${a.channels}ch` : "no audio"}
              </span>
            </div>
          </div>
        </div>
        {playbackError && (
          <div className="mt-4 text-xs font-mono text-amber-300 border border-amber-400/30 bg-amber-400/5 rounded-md px-3 py-2" data-testid="player-codec-note">
            {playbackError}
          </div>
        )}
        {decision?.reason && (
          <div className="mt-4 text-xs font-mono text-zinc-400 max-w-2xl leading-relaxed border-l-2 border-white/10 pl-3">
            {decision.reason}
            {decision.warnings?.length ? (
              <ul className="mt-2 text-amber-300/80 list-disc list-inside space-y-0.5">
                {decision.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            ) : null}
          </div>
        )}
      </div>

      <aside className="locat-glass rounded-xl p-5" data-testid="player-diagnostics">
        <div className="flex items-center gap-2 text-white font-display text-lg">
          <Gauge size={16} className="text-emerald-300" /> Playback diagnostics
        </div>
        <p className="text-xs text-zinc-500 mt-1 mb-3">
          Live stats from the Locat media server session. Numbers update every ~1.5s.
        </p>
        <div className="divide-y divide-white/[0.04]">
          <KV k="Resolution" v={diag?.resolution} testid="diag-resolution" />
          <KV k="Video codec" v={diag?.video_codec} testid="diag-vcodec" />
          <KV k="Audio codec" v={diag?.audio_codec} testid="diag-acodec" />
          <KV k="Source bitrate" v={formatBps(diag?.source_bitrate_bps)} testid="diag-src-bps" />
          <KV k="Network throughput" v={formatBps(diag?.estimated_network_bps)} testid="diag-net-bps" />
          <KV k="Buffered ahead" v={`${bufferedSeconds.toFixed(1)}s`} testid="diag-buffered" />
          <KV k="Stalls" v={diag?.stalls ?? 0} testid="diag-stalls" />
          <KV k="File size" v={formatBytes(item.size_bytes)} testid="diag-size" />
          <KV k="Duration" v={formatDuration(item.duration_seconds)} testid="diag-duration" />
          <KV k="Session" v={sessionIdRef.current ? sessionIdRef.current.slice(0, 8) + "…" : "—"} testid="diag-session" />
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs font-mono text-zinc-500">
          <Signal size={12} className="text-emerald-300" />
          Streaming via HTTP 206 Partial Content with server-side session tracking.
        </div>
      </aside>
    </div>
  );
}
