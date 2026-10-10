import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Film, Music2, PlugZap, RefreshCcw, ShieldCheck, Server } from "lucide-react";
import { api, formatBytes } from "./api";
import { LibraryKindChip, ScanStatusChip } from "./chips";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function HubHome() {
  const [health, setHealth] = useState(null);
  const [libraries, setLibraries] = useState([]);
  const [matrix, setMatrix] = useState(null);
  const [scanning, setScanning] = useState({});

  const refresh = async () => {
    try {
      const [h, l, m] = await Promise.all([api.health(), api.libraries(), api.capabilityMatrix()]);
      setHealth(h); setLibraries(l); setMatrix(m);
    } catch (e) { toast.error(`Failed to load: ${e.message}`); }
  };
  useEffect(() => { refresh(); }, []);

  const triggerScan = async (id) => {
    setScanning((s) => ({ ...s, [id]: true }));
    try {
      const r = await api.scanLibrary(id);
      toast.success(`Scanned: ${r.indexed_items} items + ${r.indexed_tracks} tracks`);
      await refresh();
    } catch (e) { toast.error(`Scan failed: ${e.message}`); }
    finally { setScanning((s) => ({ ...s, [id]: false })); }
  };

  return (
    <div className="space-y-10" data-testid="hub-home">
      <section className="grid lg:grid-cols-[1.1fr,0.9fr] gap-8 items-start">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-500 mb-4">
            // locat 2.0 · media hub · milestone a + b
          </div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.02] break-words">
            A reusable media engine<br />
            <span className="bg-gradient-to-br from-sky-300 via-blue-400 to-emerald-300 bg-clip-text text-transparent">
              that drops into Locat.
            </span>
          </h1>
          <p className="mt-5 text-zinc-400 text-sm leading-relaxed max-w-xl">
            Locat Cinema and Locat Music live as independent packages — a FastAPI media server,
            a dual-mode audio engine, and a React UI kit — wired into the existing Locat Windows
            host and Android Capacitor client through adapters. This preview demonstrates every
            working surface against real indexed media.
          </p>
          <div className="mt-7 flex items-center gap-3">
            <Button asChild data-testid="hub-cta-cinema" className="bg-white text-black hover:bg-zinc-200">
              <Link to="/cinema" className="inline-flex items-center gap-2">
                <Film size={16} /> Open Cinema <ArrowRight size={14} />
              </Link>
            </Button>
            <Button asChild variant="outline" data-testid="hub-cta-music" className="border-white/15 text-white hover:bg-white/10 bg-transparent">
              <Link to="/music" className="inline-flex items-center gap-2">
                <Music2 size={16} /> Open Music
              </Link>
            </Button>
            <Button asChild variant="ghost" data-testid="hub-cta-integration" className="text-zinc-300 hover:text-white hover:bg-white/5">
              <Link to="/integration" className="inline-flex items-center gap-2">
                <PlugZap size={16} /> Integration guide
              </Link>
            </Button>
          </div>
        </div>

        <div className="locat-glass rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.4)]" data-testid="hub-health-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-zinc-300">
              <Server size={16} className="text-emerald-300" />
              <span className="font-display text-sm font-medium">Server</span>
            </div>
            <span className={`locat-chip ${health?.status === "ok" ? "text-emerald-300 bg-emerald-400/10 border-emerald-400/30" : "text-red-300 bg-red-400/10 border-red-400/30"}`}>
              {health?.status || "..."}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-mono text-zinc-400">
            <div><div className="text-zinc-500">Runtime</div><div className="text-zinc-200">{health?.runtime || "—"}</div></div>
            <div><div className="text-zinc-500">Active sessions</div><div className="text-zinc-200">{health?.active_sessions ?? "—"}</div></div>
            <div><div className="text-zinc-500">Dev mode</div><div className="text-zinc-200">{String(health?.dev_mode)}</div></div>
            <div><div className="text-zinc-500">LOCAT_MEDIA_ENABLED</div><div className="text-emerald-300">true</div></div>
          </div>
          <div className="mt-5 flex items-center gap-2 text-zinc-400 text-xs">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>Authorized library roots:</span>
          </div>
          <ul className="mt-2 space-y-1 text-xs font-mono text-zinc-300">
            {(health?.authorized_roots || []).map((r) => (
              <li key={r} className="truncate text-zinc-400">{r}</li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between mb-5">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-500">libraries</div>
            <h2 className="font-display text-2xl font-semibold text-white">Indexed libraries</h2>
          </div>
          <Button variant="outline" onClick={refresh} data-testid="hub-refresh"
                  className="border-white/15 text-white hover:bg-white/10 bg-transparent">
            <RefreshCcw size={14} /> Refresh
          </Button>
        </div>
        <div className="grid md:grid-cols-2 gap-4" data-testid="hub-library-grid">
          {libraries.map((lib) => (
            <div key={lib.id} className="locat-glass rounded-xl p-5" data-testid={`lib-row-${lib.id}`}>
              <div className="flex items-center gap-3">
                <LibraryKindChip kind={lib.kind} />
                <div className="font-display text-base font-medium text-white truncate">{lib.name}</div>
                <ScanStatusChip status={lib.scan_status} />
              </div>
              <div className="mt-2 text-xs font-mono text-zinc-400 truncate">{lib.root_path}</div>
              <div className="mt-4 flex items-center justify-between">
                <div className="font-mono text-xs text-zinc-400">
                  {lib.item_count} items · last scan {lib.last_scanned_at ? new Date(lib.last_scanned_at).toLocaleString() : "never"}
                </div>
                <Button size="sm" onClick={() => triggerScan(lib.id)}
                        disabled={!!scanning[lib.id]}
                        data-testid={`lib-scan-${lib.id}`}
                        className="bg-white/[0.08] hover:bg-white/[0.16] text-white border border-white/15">
                  <RefreshCcw size={12} /> {scanning[lib.id] ? "Scanning…" : "Scan"}
                </Button>
              </div>
            </div>
          ))}
          {libraries.length === 0 && (
            <div className="text-zinc-500 text-sm">No libraries yet. The dev preview auto-seeds <code className="text-zinc-300">/app/media_samples</code> on startup.</div>
          )}
        </div>
      </section>

      {matrix && (
        <section>
          <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-500 mb-2">
            capability matrix · runtime: {matrix.runtime}
          </div>
          <h2 className="font-display text-2xl font-semibold text-white mb-4">What this device can actually play</h2>
          <div className="locat-glass rounded-xl overflow-hidden">
            <table className="w-full text-sm font-mono">
              <thead className="text-zinc-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Container</th>
                  <th className="text-left px-4 py-3">Video</th>
                  <th className="text-left px-4 py-3">Audio</th>
                  <th className="text-left px-4 py-3">Max</th>
                  <th className="text-left px-4 py-3">HDR</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                {(matrix.decoders || []).map((d, i) => (
                  <tr key={i} className="border-t border-white/[0.05]">
                    <td className="px-4 py-2">{d.container || "—"}</td>
                    <td className="px-4 py-2">{d.video_codec || "—"}</td>
                    <td className="px-4 py-2">{d.audio_codec || "—"}</td>
                    <td className="px-4 py-2">{d.max_width ? `${d.max_width}×${d.max_height}` : "—"}</td>
                    <td className="px-4 py-2">{(d.hdr || []).join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-zinc-500 mt-3 max-w-2xl leading-relaxed">
            {matrix.notes}
          </p>
        </section>
      )}
    </div>
  );
}
