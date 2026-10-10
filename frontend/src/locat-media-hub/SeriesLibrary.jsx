import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Play, Tv } from "lucide-react";
import { api, formatDuration } from "./api";

export default function SeriesLibrary() {
  const [series, setSeries] = useState([]);
  useEffect(() => { api.series().then(setSeries).catch(() => setSeries([])); }, []);

  return (
    <div className="space-y-8" data-testid="series-library">
      <div>
        <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-500">cinema · series</div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight">
          Series &amp; seasons
        </h1>
        <p className="text-zinc-400 text-sm mt-2 max-w-xl">
          Episodes are grouped by series name and season. Resume where you left off, or jump
          to the next episode when one finishes.
        </p>
      </div>

      {series.length === 0 && (
        <div className="text-zinc-500 text-sm">No series indexed yet.</div>
      )}

      {series.map((s) => (
        <section key={s.series_name} className="locat-glass rounded-xl p-5" data-testid={`series-${s.series_name}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Tv size={16} className="text-blue-300" />
              <div className="font-display text-lg text-white">{s.series_name}</div>
              <span className="locat-chip bg-blue-500/10 border-blue-500/30 text-blue-300">
                {s.season_count} season{s.season_count === 1 ? "" : "s"} · {s.episode_count} ep
              </span>
            </div>
          </div>
          {s.seasons.map((season) => (
            <div key={season.season_number} className="mt-3">
              <div className="font-mono text-xs text-zinc-500 uppercase tracking-wider mb-2">
                Season {season.season_number}
              </div>
              <ul className="divide-y divide-white/[0.05]">
                {season.episodes.map((e) => {
                  const progress = e.duration_seconds ? (e.last_position_seconds / e.duration_seconds) * 100 : 0;
                  return (
                    <li key={e.id} className="flex items-center gap-3 py-2 group">
                      <Link
                        to={`/cinema/${e.id}`}
                        data-testid={`episode-${e.id}`}
                        className="flex items-center gap-3 flex-1 min-w-0"
                      >
                        <div className="w-10 h-10 rounded-md bg-gradient-to-br from-blue-500/40 to-blue-900/60 flex items-center justify-center text-xs font-mono text-white">
                          E{String(e.episode_number).padStart(2, "0")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white truncate">{e.title}</div>
                          <div className="font-mono text-[11px] text-zinc-500">
                            {formatDuration(e.duration_seconds)}
                            {progress > 0 ? ` · ${progress.toFixed(0)}% watched` : ""}
                            {e.play_count ? ` · played ${e.play_count}×` : ""}
                          </div>
                          {progress > 0 && (
                            <div className="h-0.5 bg-white/[0.05] rounded-full mt-1 overflow-hidden">
                              <div className="h-full bg-emerald-400" style={{ width: `${Math.min(100, progress)}%` }} />
                            </div>
                          )}
                        </div>
                      </Link>
                      <Link
                        to={`/cinema/${e.id}`}
                        className="opacity-0 group-hover:opacity-100 transition w-8 h-8 rounded-full bg-white text-black flex items-center justify-center"
                      >
                        <Play size={14} fill="black" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
