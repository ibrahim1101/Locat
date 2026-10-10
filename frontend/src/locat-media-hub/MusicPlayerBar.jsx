import React from "react";
import { Pause, Play, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { useAudioEngine } from "./AudioEngine";
import { Slider } from "@/components/ui/slider";
import { BitPerfectChip } from "./chips";
import { formatDuration } from "./api";

export default function MusicPlayerBar() {
  const {
    current, playing, toggle, next, prev,
    position, duration, seek,
    volume, setVolume,
    mode, caps,
  } = useAudioEngine();

  if (!current) return null;
  return (
    <div className="locat-glass border-t border-white/10 px-4 py-3 flex items-center gap-4"
         data-testid="music-player-bar">
      <div className="flex items-center gap-3 min-w-0 w-72">
        <div className="w-11 h-11 rounded-md bg-gradient-to-br from-emerald-400/40 to-sky-400/40 border border-white/10" />
        <div className="min-w-0">
          <div className="font-display text-sm text-white truncate" data-testid="player-title">{current.title}</div>
          <div className="text-[11px] font-mono text-zinc-500 truncate">{current.artist} · {current.album}</div>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-center gap-2">
          <button onClick={prev} data-testid="player-prev" className="p-2 text-zinc-300 hover:text-white"><SkipBack size={16} /></button>
          <button onClick={toggle} data-testid="player-toggle"
                  className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center hover:bg-zinc-200">
            {playing ? <Pause size={16} /> : <Play size={16} fill="black" />}
          </button>
          <button onClick={next} data-testid="player-next" className="p-2 text-zinc-300 hover:text-white"><SkipForward size={16} /></button>
        </div>
        <div className="mt-1 flex items-center gap-3 text-[11px] font-mono text-zinc-400">
          <span className="w-10 text-right">{formatDuration(position)}</span>
          <Slider
            value={[duration ? (position / duration) * 100 : 0]}
            onValueChange={(v) => duration && seek((v[0] / 100) * duration)}
            min={0} max={100} step={0.1}
            className="flex-1"
            data-testid="player-seek"
          />
          <span className="w-10">{formatDuration(duration)}</span>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-3 w-72 justify-end">
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
          <span className={`locat-chip ${mode === "pure_audio" ? "text-zinc-300 bg-white/[0.04] border-white/15" : "text-emerald-300 bg-emerald-400/10 border-emerald-400/30"}`}>
            {mode === "pure_audio" ? "Pure Audio" : "Enhanced DSP"}
          </span>
          {caps && <BitPerfectChip status={caps.bit_perfect} />}
        </div>
        <div className="flex items-center gap-2 w-28">
          <Volume2 size={14} className="text-zinc-500" />
          <Slider
            value={[Math.round(volume * 100)]}
            onValueChange={(v) => setVolume(v[0] / 100)}
            min={0} max={100} step={1}
            data-testid="player-volume"
          />
        </div>
      </div>
    </div>
  );
}
