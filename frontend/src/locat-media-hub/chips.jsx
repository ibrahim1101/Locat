import React from "react";

export function PathChip({ pathType, size = "sm" }) {
  const map = {
    direct_play:   { label: "Direct Play",   fg: "text-emerald-300", bg: "bg-emerald-400/10", bd: "border-emerald-400/30" },
    direct_stream: { label: "Direct Stream", fg: "text-sky-300",      bg: "bg-sky-400/10",      bd: "border-sky-400/30" },
    transcode:     { label: "Transcode",     fg: "text-amber-300",    bg: "bg-amber-400/10",    bd: "border-amber-400/30" },
    unsupported:   { label: "Unsupported",   fg: "text-red-300",      bg: "bg-red-400/10",      bd: "border-red-400/30" },
  };
  const c = map[pathType] || map.transcode;
  return (
    <span
      data-testid={`path-chip-${pathType}`}
      className={`locat-chip ${c.fg} ${c.bg} ${c.bd} ${size === "lg" ? "text-[11px] px-3 py-1" : ""}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />{c.label}
    </span>
  );
}

export function BitPerfectChip({ status }) {
  const map = {
    verified:    { label: "Bit-perfect · Verified",    fg: "text-emerald-300", bg: "bg-emerald-400/10", bd: "border-emerald-400/30" },
    unverified:  { label: "Bit-perfect · Unverified",  fg: "text-amber-300",   bg: "bg-amber-400/10",   bd: "border-amber-400/30" },
    unavailable: { label: "Bit-perfect · Unavailable", fg: "text-zinc-300",    bg: "bg-white/[0.04]",   bd: "border-white/15" },
  };
  const c = map[status] || map.unavailable;
  return (
    <span data-testid={`bit-perfect-${status}`} className={`locat-chip ${c.fg} ${c.bg} ${c.bd}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />{c.label}
    </span>
  );
}

export function LibraryKindChip({ kind }) {
  const map = {
    movie:   { label: "Cinema", c: "text-blue-300 bg-blue-500/10 border-blue-500/30" },
    episode: { label: "Series", c: "text-blue-300 bg-blue-500/10 border-blue-500/30" },
    music:   { label: "Music",  c: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30" },
    unknown: { label: "Unknown", c: "text-zinc-300 bg-white/5 border-white/10" },
  };
  const m = map[kind] || map.unknown;
  return <span className={`locat-chip ${m.c}`}>{m.label}</span>;
}

export function ScanStatusChip({ status }) {
  const map = {
    idle:     "text-zinc-300 bg-white/5 border-white/10",
    scanning: "text-sky-300 bg-sky-500/10 border-sky-500/30 animate-pulse",
    done:     "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
    failed:   "text-red-300 bg-red-500/10 border-red-500/30",
  };
  return <span className={`locat-chip ${map[status] || map.idle}`}>{status}</span>;
}
