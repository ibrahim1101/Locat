import React, { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Cpu, HardDrive, MemoryStick, Monitor, Pause, Play, Wifi } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { api, formatBps, formatBytes } from "./api";

const INTERVAL_OPTIONS = [1000, 2000, 5000];

function Card({ title, icon: Icon, children, right }) {
  return (
    <div className="locat-glass rounded-xl p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-white font-display text-sm">
          {Icon ? <Icon size={14} className="text-emerald-300" /> : null}
          {title}
        </div>
        {right}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Metric({ label, value, hint, warn }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/[0.04]">
      <span className="text-zinc-500 text-[11px] uppercase tracking-wider">{label}</span>
      <span className={`font-mono text-xs ${warn ? "text-amber-300" : "text-zinc-100"}`}>
        {value}
        {hint ? <span className="text-zinc-500 ml-2">{hint}</span> : null}
      </span>
    </div>
  );
}

export default function PerformancePage() {
  const [interval, setInterval_] = useState(1000);
  const [paused, setPaused] = useState(false);
  const [overview, setOverview] = useState(null);
  const [cinema, setCinema] = useState(null);
  const [server, setServer] = useState(null);
  const [network, setNetwork] = useState(null);
  const [music, setMusic] = useState(null);
  const [cpuHistory, setCpuHistory] = useState([]);
  const [netHistory, setNetHistory] = useState([]);
  const histRef = useRef({ cpu: [], net: [] });

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (paused) return;
      try {
        const [ov, cin, srv, net, mus] = await Promise.all([
          api.telemetry("overview"),
          api.telemetry("cinema"),
          api.telemetry("server"),
          api.telemetry("network"),
          api.telemetry("music"),
        ]);
        if (cancelled) return;
        setOverview(ov); setCinema(cin); setServer(srv); setNetwork(net); setMusic(mus);
        const t = new Date();
        const label = t.toLocaleTimeString();
        histRef.current.cpu.push({ t: label, cpu: ov.cpu_percent, ram: ov.memory?.percent });
        histRef.current.net.push({
          t: label,
          up: Math.round((ov.network?.upload_bps || 0) / 1000),
          down: Math.round((ov.network?.download_bps || 0) / 1000),
        });
        histRef.current.cpu = histRef.current.cpu.slice(-120);
        histRef.current.net = histRef.current.net.slice(-120);
        setCpuHistory([...histRef.current.cpu]);
        setNetHistory([...histRef.current.net]);
      } catch { /* swallow */ }
    };
    tick();
    const id = window.setInterval(tick, interval);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [interval, paused]);

  const gpu = overview?.gpu;

  return (
    <div className="space-y-8" data-testid="performance-page">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-500">performance</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Real-time telemetry
          </h1>
          <p className="text-zinc-400 text-sm mt-2 max-w-xl">
            Live CPU, memory, disk, network, GPU and streaming metrics sourced from
            <code className="text-zinc-200 mx-1">psutil</code> and
            <code className="text-zinc-200 mx-1">NVML</code>. Any metric that cannot
            be measured on this host is reported as <span className="text-amber-300">Unavailable</span>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {INTERVAL_OPTIONS.map((n) => (
            <button key={n}
                    onClick={() => setInterval_(n)}
                    data-testid={`perf-interval-${n}`}
                    className={`font-mono text-xs px-3 py-1.5 rounded-md border ${interval === n ? "bg-white text-black border-white" : "text-zinc-300 border-white/15 hover:bg-white/5"}`}>
              {n / 1000}s
            </button>
          ))}
          <button
            onClick={() => setPaused((p) => !p)}
            data-testid="perf-pause"
            className="font-mono text-xs px-3 py-1.5 rounded-md border bg-emerald-400 text-black border-emerald-400 inline-flex items-center gap-1"
          >
            {paused ? <><Play size={12} fill="black" />Resume</> : <><Pause size={12} />Pause</>}
          </button>
        </div>
      </div>

      {/* Overview */}
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card title="CPU" icon={Cpu}>
          <Metric label="Overall" value={overview?.cpu_percent != null ? `${overview.cpu_percent.toFixed(1)}%` : "—"}
                  hint={overview?.cpu_cores ? `${overview.cpu_cores} cores` : null}
                  warn={(overview?.cpu_percent || 0) > 85} />
          <Metric label="psutil" value={overview?.psutil_available ? "available" : "unavailable"} />
        </Card>
        <Card title="Memory" icon={MemoryStick}>
          <Metric label="Used" value={overview?.memory ? `${formatBytes(overview.memory.used)} / ${formatBytes(overview.memory.total)}` : "—"} />
          <Metric label="Percent" value={overview?.memory ? `${overview.memory.percent}%` : "—"}
                  warn={(overview?.memory?.percent || 0) > 85} />
        </Card>
        <Card title="Disk" icon={HardDrive}>
          <Metric label="Usage" value={overview?.disk?.percent != null ? `${overview.disk.percent}%` : "—"} />
          <Metric label="Read" value={formatBps(overview?.disk?.read_bps)} />
          <Metric label="Write" value={formatBps(overview?.disk?.write_bps)} />
        </Card>
        <Card title="Network" icon={Wifi}>
          <Metric label="Download" value={formatBps(overview?.network?.download_bps)} />
          <Metric label="Upload" value={formatBps(overview?.network?.upload_bps)} />
        </Card>
      </div>

      {/* CPU + Memory chart */}
      <Card title="CPU & memory over time" icon={Activity}>
        <div className="h-56" data-testid="chart-cpu">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cpuHistory}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="t" stroke="#64748b" tick={{ fontSize: 10 }} minTickGap={40} />
              <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={[0, 100]} unit="%" />
              <Tooltip contentStyle={{ background: "#0b0d14", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 11 }} />
              <Line type="monotone" dataKey="cpu" stroke="#3b82f6" dot={false} strokeWidth={2} isAnimationActive={false} />
              <Line type="monotone" dataKey="ram" stroke="#10b981" dot={false} strokeWidth={2} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Network chart */}
      <Card title="Network throughput over time (KB/s)" icon={Wifi}>
        <div className="h-56" data-testid="chart-net">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={netHistory}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="t" stroke="#64748b" tick={{ fontSize: 10 }} minTickGap={40} />
              <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit=" KB/s" />
              <Tooltip contentStyle={{ background: "#0b0d14", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 11 }} />
              <Line type="monotone" dataKey="down" stroke="#38bdf8" dot={false} strokeWidth={2} isAnimationActive={false} />
              <Line type="monotone" dataKey="up" stroke="#f59e0b" dot={false} strokeWidth={2} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="GPU (NVIDIA via NVML)" icon={Monitor}>
          {!gpu?.available ? (
            <div className="text-xs text-amber-300 font-mono" data-testid="gpu-unavailable">
              Unavailable — {gpu?.reason || "no driver detected"}
            </div>
          ) : (
            <div className="space-y-3">
              {gpu.devices.map((d) => (
                <div key={d.index} className="text-xs font-mono text-zinc-300">
                  <div className="text-zinc-100">{d.name}</div>
                  <div>GPU util: {d.utilization}% · encoder: {d.encoder_percent ?? "—"}% · decoder: {d.decoder_percent ?? "—"}%</div>
                  <div>VRAM: {formatBytes(d.memory_used)} / {formatBytes(d.memory_total)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Streaming sessions" icon={Activity}>
          <div data-testid="server-sessions">
            <Metric label="Active sessions" value={server?.active_sessions ?? "—"} />
            <Metric label="FFmpeg version" value={(server?.ffmpeg_version || "—").split(" ").slice(0, 3).join(" ")} />
            <Metric label="HW accelerators" value={(server?.hwaccels || []).join(", ") || "—"} />
            <Metric label="NVENC" value={server?.nvenc_available ? "available" : "unavailable"}
                    warn={!server?.nvenc_available} />
            <Metric label="NVDEC" value={server?.nvdec_available ? "available" : "unavailable"}
                    warn={!server?.nvdec_available} />
          </div>
          <div className="mt-4 space-y-2">
            {(cinema?.sessions || []).map((s) => (
              <div key={s.session_id} className="font-mono text-[11px] text-zinc-400 border-l-2 border-emerald-400/40 pl-3">
                <div>{s.resolution || "?"} · {s.video_codec || "?"} / {s.audio_codec || "?"} · {s.path_type || "?"}</div>
                <div className="text-zinc-500">
                  {formatBytes(s.bytes_served)} served · {formatBps(s.estimated_network_bps)} · stalls {s.stalls}
                </div>
              </div>
            ))}
            {(!cinema?.sessions || cinema.sessions.length === 0) && (
              <div className="text-xs text-zinc-500">No active sessions.</div>
            )}
          </div>
        </Card>
      </div>

      <Card title="Music runtime">
        {music?.capabilities ? (
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Metric label="Runtime" value={music.capabilities.runtime} />
              <Metric label="Active mode" value={music.capabilities.active_mode} />
              <Metric label="DSP enabled" value={String(music.capabilities.dsp_enabled)} />
            </div>
            <div>
              <Metric label="Bit-perfect" value={music.capabilities.bit_perfect}
                      warn={music.capabilities.bit_perfect !== "verified"} />
              <Metric label="Supports exclusive" value={String(music.capabilities.supports_exclusive)} />
              <Metric label="Resampling detected" value={String(music.capabilities.resampling_detected)} />
            </div>
          </div>
        ) : (
          <div className="text-xs text-zinc-500">Loading…</div>
        )}
      </Card>
    </div>
  );
}
