import React, { useEffect, useMemo, useState } from "react";
import { Heart, Music2, Play, Search } from "lucide-react";
import { api, formatDuration } from "./api";
import { useAudioEngine } from "./AudioEngine";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

function AlbumArt({ title, size = "md" }) {
  const h1 = Math.abs(title.charCodeAt(0) || 0) * 7 % 360;
  const h2 = Math.abs(title.charCodeAt(title.length - 1) || 0) * 13 % 360;
  const bg = `linear-gradient(135deg, hsl(${h1} 65% 24%), hsl(${h2} 65% 10%))`;
  const dim = size === "md" ? "aspect-square" : "aspect-square";
  return (
    <div className={`${dim} rounded-lg overflow-hidden relative`} style={{ background: bg }}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent_60%)]" />
      <div className="absolute bottom-2 left-2 right-2 text-xs font-mono text-white/90 line-clamp-2 drop-shadow">
        {title}
      </div>
    </div>
  );
}

export default function MusicLibrary() {
  const [tracks, setTracks] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [q, setQ] = useState("");
  const { playTrack, current, playing } = useAudioEngine();

  const refresh = async () => {
    const [t, a] = await Promise.all([api.tracks({ q }), api.albums()]);
    setTracks(t); setAlbums(a);
  };
  useEffect(() => { refresh().catch(() => {}); /* eslint-disable-next-line */ }, [q]);

  const byAlbum = useMemo(() => {
    const map = new Map();
    for (const t of tracks) {
      const key = `${t.album_artist || t.artist}::${t.album}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    }
    return Array.from(map.entries()).map(([k, items]) => {
      const [albumArtist, album] = k.split("::");
      return { albumArtist, album, items };
    });
  }, [tracks]);

  const toggleFav = async (t) => {
    try {
      await api.favoriteTrack(t.id, !t.favorite);
      await refresh();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-10" data-testid="music-library">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-500">music</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Lossless library
          </h1>
          <p className="text-zinc-400 text-sm mt-2 max-w-lg">
            FLAC and MP3 indexed with embedded tags. Playback is driven by the dual-mode
            audio engine — see <span className="text-white">Audio &amp; EQ</span> for Pure Audio
            vs Enhanced DSP.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            data-testid="music-search"
            placeholder="Search tracks…"
            value={q} onChange={(e) => setQ(e.target.value)}
            className="pl-9 bg-white/[0.04] border-white/10 text-white placeholder:text-zinc-500 focus-visible:ring-emerald-500/60"
          />
        </div>
      </div>

      <section>
        <h2 className="font-display text-xl text-white mb-4">Albums</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5" data-testid="music-albums">
          {byAlbum.map(({ album, albumArtist, items }) => (
            <div key={`${album}-${albumArtist}`} className="locat-glass rounded-xl p-4"
                 data-testid={`album-card-${album}`}>
              <AlbumArt title={album || "(Unknown album)"} />
              <div className="mt-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-display text-sm text-white truncate">{album || "Unknown"}</div>
                  <div className="text-[11px] text-zinc-500 truncate">{albumArtist || "Various"}</div>
                </div>
                <button
                  onClick={() => playTrack(items[0], items)}
                  data-testid={`album-play-${album}`}
                  className="w-9 h-9 rounded-full bg-emerald-400 hover:bg-emerald-300 text-black flex items-center justify-center transition shadow-[0_6px_16px_rgba(16,185,129,0.35)]"
                  aria-label="Play album"
                >
                  <Play size={16} fill="black" />
                </button>
              </div>
              <ul className="mt-4 space-y-1 text-xs font-mono">
                {items.map((t, i) => (
                  <li key={t.id}
                      className={`flex items-center gap-2 group px-2 py-1 rounded hover:bg-white/[0.04] cursor-pointer ${
                        current?.id === t.id ? "text-emerald-300" : "text-zinc-300"
                      }`}
                      data-testid={`track-${t.id}`}
                      onClick={() => playTrack(t, items)}>
                    <span className="text-zinc-500 w-6 text-right">{t.track_number || i + 1}</span>
                    <span className="flex-1 truncate">{t.title || t.path.split("/").pop()}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFav(t); }}
                      className={`opacity-0 group-hover:opacity-100 transition ${
                        t.favorite ? "opacity-100 text-red-400" : "text-zinc-500 hover:text-red-400"
                      }`}
                      data-testid={`track-fav-${t.id}`}
                    >
                      <Heart size={12} fill={t.favorite ? "currentColor" : "none"} />
                    </button>
                    <span className="text-zinc-500">{formatDuration(t.duration_seconds)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {byAlbum.length === 0 && (
            <div className="text-zinc-500 text-sm col-span-full">No tracks indexed yet. Trigger a music scan from the Hub.</div>
          )}
        </div>
      </section>
    </div>
  );
}
