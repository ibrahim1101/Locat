import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronUp, Film, Gauge, Info, Signal, SkipForward } from "lucide-react";
import { api, formatBytes, formatBps, formatDuration } from "./api";
import { PathChip } from "./chips";
import { Button } from "@/components/ui/button";

function webClientCapabilities() {
  const el = typeof document !== "undefined" ? document.createElement("video") : null;
  const canPlay = (mime) => (el ? el.canPlayType(mime) : "");
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
    hdr: [], max_video_height: 2160, subtitle_codecs: ["webvtt"],
  };
}

function KV({ k, v, warn, testid }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/[0.04]" data-testid={testid}>
      <span className="text-zinc-500 text-[11px] uppercase tracking-wider">{k}</span>
      <span className={`font-mono text-xs ${warn ? "text-amber-300" : "text-zinc-100"}`}>{v ?? "—"}</span>
    </div>
  );
}

export default function CinemaPlayer() {
  const { id } = useParams();
  const nav = useNavigate();
  const [item, setItem] = useState(null);
  const [decision, setDecision] = useState(null);
  const [diag, setDiag] = useState(null);
  const [info, setInfo] = useState(null);
  const [nextEp, setNextEp] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [bufferedSeconds, setBufferedSeconds] = useState(0);
  const [playbackError, setPlaybackError] = useState(null);
  const [useRemux, setUseRemux] = useState(false);
  const videoRef = useRef(null);
  const sessionIdRef = useRef(null);

  useEffect(() => {
    (async () => {
      setPlaybackError(null); setUseRemux(false); sessionIdRef.current = null;
      const [it, inf] = await Promise.all([api.item(id), api.itemInfo(id)]);
      setItem(it); setInfo(inf);
      const caps = webClientCapabilities();
      const dec = await api.decision(id, caps);
      setDecision(dec);
      // Auto-select remux when the server says direct_stream — don't make
      // the user guess.
      if (dec.path_type === "direct_stream") setUseRemux(true);
      if (it.media_type === "episode") {
        api.nextEpisode(id).then(setNextEp).catch(() => setNextEp(null));
      } else setNextEp(null);
    })().catch((e) => console.error(e));
  }, [id]);

  // Resume from saved position
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !item) return;
    const handler = () => {
      if (item.last_position_seconds && item.last_position_seconds > 2 && item.last_position_seconds < (item.duration_seconds || Infinity) - 5) {
        v.currentTime = item.last_position_seconds;
      }
    };
    v.addEventListener("loadedmetadata", handler);
    return () => v.removeEventListener("loadedmetadata", handler);
  }, [item, useRemux]);

  // Poll diagnostics + post client telemetry
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const d = await api.diagnostics(id, sessionIdRef.current || null);
        setDiag(d);
      } catch { /* noop */ }
      const v = videoRef.current;
      if (v && v.buffered.length) {
        const b = Math.max(0, v.buffered.end(v.buffered.length - 1) - (v.currentTime || 0));
        setBufferedSeconds(b);
        if (sessionIdRef.current) {
          const quality = typeof v.getVideoPlaybackQuality === "function" ? v.getVideoPlaybackQuality() : null;
          api.reportClientTelemetry({
            session_id: sessionIdRef.current,
            buffered_seconds: b,
            dropped_frames: quality ? quality.droppedVideoFrames : null,
          }).catch(() => {});
        }
      }
    }, 1500);
    return () => clearInterval(t);
  }, [id]);

  const streamUrl = useMemo(() => {
    if (!item) return null;
    return useRemux ? api.remuxUrl(item.id) : api.streamUrl(item.id);
  }, [item, useRemux]);

  // Capture session id via HEAD on the direct stream (remux is chunked, so
  // we just set the ref once a diagnostics poll returns one)
  useEffect(() => {
    if (!streamUrl || useRemux) return;
    fetch(streamUrl, { method: "HEAD" }).then((r) => {
      sessionIdRef.current = r.headers.get("x-locat-session-id");
    }).catch(() => {});
  }, [streamUrl, useRemux]);

  if (!item) return <div className="text-zinc-500">Loading…</div>;
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
        <div className="rounded-xl overflow-hidden border border-white/[0.08] bg-black shadow-[0_8px_40px_rgba(0,0,0,0.6)] relative">
          <video
            ref={videoRef}
            key={streamUrl}
            data-testid="player-video"
            src={streamUrl}
            controls playsInline
            className="w-full aspect-video bg-black"
            onError={() => {
              if (!useRemux && decision?.path_type !== "direct_play") {
                setUseRemux(true);
                setPlaybackError("Direct Play failed — switching to server-side stream-copy remux (lossless).");
              } else {
                setPlaybackError("Browser cannot decode this stream. The native Locat Windows/Android host would handle this via its decoder adapter.");
              }
            }}
            onTimeUpdate={(e) => {
              const t = e.currentTarget.currentTime;
              if (Math.floor(t) % 5 === 0) api.saveProgress(item.id, t).catch(() => {});
            }}
            onEnded={() => {
              if (nextEp) nav(`/cinema/${nextEp.id}`);
            }}
          />
          {useRemux && (
            <div className="absolute top-3 left-3 locat-chip bg-sky-500/15 border-sky-500/40 text-sky-200"
                 data-testid="remux-badge">
              Serving: stream-copy remux (lossless)
            </div>
          )}
        </div>
        <div className="mt-5 flex items-start justify-between gap-5 flex-wrap">
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
              {v?.hdr && <span className="locat-chip text-amber-200 bg-amber-400/10 border-amber-400/30">HDR · {v.hdr}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {nextEp && (
              <Button
                onClick={() => nav(`/cinema/${nextEp.id}`)}
                data-testid="next-episode-btn"
                className="bg-white text-black hover:bg-zinc-200 inline-flex items-center gap-2"
              >
                <SkipForward size={14} /> Next: {nextEp.title}
              </Button>
            )}
            {!useRemux && decision?.path_type !== "direct_play" && (
              <Button
                onClick={() => setUseRemux(true)}
                data-testid="switch-remux-btn"
                variant="outline"
                className="border-white/15 text-white hover:bg-white/10 bg-transparent"
              >
                Remux this stream
              </Button>
            )}
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

        {/* Expandable playback information panel */}
        <div className="mt-6 locat-glass rounded-xl p-4" data-testid="info-panel">
          <button
            className="flex items-center gap-2 text-white font-display text-sm"
            onClick={() => setShowInfo((s) => !s)}
            data-testid="toggle-info-panel"
          >
            <Info size={14} className="text-sky-300" />
            Technical information
            {showInfo ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showInfo && info && (
            <div className="mt-4 grid md:grid-cols-2 gap-4 text-xs font-mono" data-testid="info-panel-body">
              <div className="space-y-1">
                <div className="text-zinc-500 uppercase tracking-wider text-[10px]">File</div>
                <KV k="Filename" v={info.filename} testid="info-filename" />
                <KV k="Container" v={info.container} testid="info-container" />
                <KV k="Size" v={formatBytes(info.file_size)} testid="info-size" />
                <KV k="Duration" v={formatDuration(info.duration_seconds)} testid="info-duration" />
                <div className="text-zinc-500 uppercase tracking-wider text-[10px] mt-3">Video</div>
                <KV k="Codec" v={info.video?.codec} testid="info-vcodec" />
                <KV k="Resolution" v={info.video ? `${info.video.width}x${info.video.height}` : "—"} testid="info-vres" />
                <KV k="Frame rate" v={info.video?.fps ? `${info.video.fps.toFixed(2)} fps` : "—"} />
                <KV k="Profile" v={info.video?.profile} />
                <KV k="Level" v={info.video?.level} />
                <KV k="Pixel format" v={info.video?.pixel_format} />
                <KV k="Bitrate" v={formatBps(info.video?.bit_rate)} />
              </div>
              <div className="space-y-1">
                <div className="text-zinc-500 uppercase tracking-wider text-[10px]">HDR</div>
                <KV k="Format" v={info.hdr?.format ?? "SDR"} />
                <KV k="Color space" v={info.hdr?.color_space} />
                <KV k="Color transfer" v={info.hdr?.color_transfer} />
                <KV k="Color primaries" v={info.hdr?.color_primaries} />
                <KV k="Mastering display" v={info.hdr?.mastering_display || "—"} />
                <div className="text-zinc-500 uppercase tracking-wider text-[10px] mt-3">Audio tracks</div>
                {info.audio_tracks?.length ? info.audio_tracks.map((t, i) => (
                  <KV key={i} k={`Track ${i + 1}`} v={`${t.codec} ${t.channels}ch @ ${t.sample_rate} Hz${t.language ? ` (${t.language})` : ""}`} />
                )) : <KV k="None" v="—" />}
                <div className="text-zinc-500 uppercase tracking-wider text-[10px] mt-3">Subtitles</div>
                {info.subtitle_tracks?.length ? info.subtitle_tracks.map((t, i) => (
                  <KV key={i} k={`Sub ${i + 1}`} v={`${t.codec}${t.language ? ` (${t.language})` : ""}`} />
                )) : <KV k="None" v="—" />}
                <div className="text-zinc-500 uppercase tracking-wider text-[10px] mt-3">FFmpeg</div>
                <KV k="Version" v={(info.ffmpeg?.version || "—").split(" ").slice(0, 3).join(" ")} />
                <KV k="NVENC" v={info.ffmpeg?.nvenc_available ? "available" : "unavailable"}
                    warn={!info.ffmpeg?.nvenc_available} />
                <KV k="NVDEC" v={info.ffmpeg?.nvdec_available ? "available" : "unavailable"}
                    warn={!info.ffmpeg?.nvdec_available} />
                <KV k="Accelerators" v={(info.ffmpeg?.hwaccels || []).join(", ") || "—"} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: live diagnostics */}
      <aside className="locat-glass rounded-xl p-5 lg:sticky lg:top-20" data-testid="player-diagnostics">
        <div className="flex items-center gap-2 text-white font-display text-lg">
          <Gauge size={16} className="text-emerald-300" /> Playback diagnostics
        </div>
        <p className="text-xs text-zinc-500 mt-1 mb-3">
          Live stats from the Locat media server session. Numbers update every ~1.5s.
        </p>
        <div className="divide-y divide-white/[0.04]">
          <KV k="Mode" v={useRemux ? "Remux (stream-copy)" : "Direct Play"} testid="diag-mode" />
          <KV k="Resolution" v={diag?.resolution} testid="diag-resolution" />
          <KV k="Video codec" v={diag?.video_codec} testid="diag-vcodec" />
          <KV k="Audio codec" v={diag?.audio_codec} testid="diag-acodec" />
          <KV k="Source bitrate" v={formatBps(diag?.source_bitrate_bps)} testid="diag-src-bps" />
          <KV k="Network throughput" v={formatBps(diag?.estimated_network_bps)} testid="diag-net-bps" />
          <KV k="Buffered ahead" v={`${bufferedSeconds.toFixed(1)}s`} testid="diag-buffered" />
          <KV k="Dropped frames" v={diag?.dropped_frames ?? "—"} testid="diag-dropped" />
          <KV k="Stalls" v={diag?.stalls ?? 0} testid="diag-stalls" />
          <KV k="File size" v={formatBytes(item.size_bytes)} testid="diag-size" />
          <KV k="Duration" v={formatDuration(item.duration_seconds)} testid="diag-duration" />
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs font-mono text-zinc-500">
          <Signal size={12} className="text-emerald-300" />
          HTTP 206 range · server-side session tracking · telemetry posted by the client.
        </div>
      </aside>
    </div>
  );
}
