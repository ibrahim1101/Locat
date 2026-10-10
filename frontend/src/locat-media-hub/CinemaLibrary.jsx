import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Film, Play, Search } from "lucide-react";
import { api, formatBytes, formatDuration } from "./api";
import { Input } from "@/components/ui/input";

function CinemaCard({ item }) {
  const v = item.video_streams?.[0];
  const a = item.audio_streams?.[0];
  const bg = `linear-gradient(135deg, hsl(${(item.id.charCodeAt(0) * 11) % 360} 70% 20%), hsl(${(item.id.charCodeAt(2) * 23) % 360} 70% 10%))`;
  return (
    <Link
      to={`/cinema/${item.id}`}
      data-testid={`cinema-card-${item.id}`}
      className="group locat-glass rounded-xl overflow-hidden hover:border-white/20 transition-colors shadow-[0_6px_28px_rgba(0,0,0,0.35)]"
    >
      <div
        className="aspect-[16/9] relative overflow-hidden"
        style={{ background: bg }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent_55%)]" />
        <div className="absolute inset-0 flex items-end p-4">
          <div className="font-display text-lg font-semibold text-white drop-shadow-md">
            {item.title}{item.year ? ` · ${item.year}` : ""}
          </div>
        </div>
        <div className="absolute top-3 left-3 locat-chip bg-black/40 border-white/15 text-white">
          <Film size={11} /> {v ? `${v.height}p` : item.container.toUpperCase()}
        </div>
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
          <div className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-2xl">
            <Play size={22} fill="black" />
          </div>
        </div>
      </div>
      <div className="p-4 text-xs font-mono text-zinc-400">
        <div className="flex items-center justify-between">
          <span>{item.container}</span>
          <span>{formatBytes(item.size_bytes)}</span>
        </div>
        <div className="flex items-center justify-between mt-1 text-zinc-500">
          <span>{v ? `${v.codec}/${v.width}×${v.height}` : "—"}</span>
          <span>{a ? `${a.codec} ${a.channels}ch` : ""}</span>
          <span>{formatDuration(item.duration_seconds)}</span>
        </div>
      </div>
    </Link>
  );
}

export default function CinemaLibrary() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    api.items({ q }).then(setItems).catch(() => setItems([]));
  }, [q]);

  const grouped = useMemo(() => {
    const movies = items.filter((i) => i.media_type === "movie");
    const episodes = items.filter((i) => i.media_type === "episode");
    return { movies, episodes };
  }, [items]);

  return (
    <div className="space-y-10" data-testid="cinema-library">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-500">cinema</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Your indexed cinema library
          </h1>
          <p className="text-zinc-400 text-sm mt-2 max-w-lg">
            Streamed with HTTP byte-range requests. The playback decider picks Direct Play
            whenever your browser can handle the container, codecs, and HDR profile.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            data-testid="cinema-search"
            placeholder="Search titles…"
            value={q} onChange={(e) => setQ(e.target.value)}
            className="pl-9 bg-white/[0.04] border-white/10 text-white placeholder:text-zinc-500 focus-visible:ring-blue-500/60"
          />
        </div>
      </div>

      {grouped.movies.length > 0 && (
        <section>
          <h2 className="font-display text-xl text-white mb-4">Movies</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {grouped.movies.map((i) => <CinemaCard key={i.id} item={i} />)}
          </div>
        </section>
      )}
      {grouped.episodes.length > 0 && (
        <section>
          <h2 className="font-display text-xl text-white mb-4">Series</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {grouped.episodes.map((i) => <CinemaCard key={i.id} item={i} />)}
          </div>
        </section>
      )}
      {items.length === 0 && (
        <div className="text-zinc-500 text-sm">
          No indexed items yet. Trigger a scan from the Hub.
        </div>
      )}
    </div>
  );
}
