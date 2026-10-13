import { useMemo } from "react";
import type { EqPoint } from "@/lib/musicEq";

type Props = { points: EqPoint[]; preamp: number; bypass: boolean };
const WIDTH = 640, HEIGHT = 170, LEFT = 35, RIGHT = 10, TOP = 10, BOTTOM = 22;
const frequencies = Array.from({ length: 161 }, (_, i) => 20 * Math.pow(1000, i / 160));

export function MusicFrequencyResponse({ points, preamp, bypass }: Props) {
  const path = useMemo(() => {
    if (bypass) return "";
    if (typeof OfflineAudioContext === "undefined") return "";
    const context = new OfflineAudioContext(1, 1, 48000);
    const axis = new Float32Array(frequencies);
    const magnitude = new Float32Array(axis.length);
    const phase = new Float32Array(axis.length);
    const sum = new Float64Array(axis.length);
    for (const point of points) {
      const filter = context.createBiquadFilter();
      filter.type = point.type;
      filter.frequency.value = Math.min(point.frequency, context.sampleRate / 2 - 1);
      filter.gain.value = point.gain;
      filter.Q.value = point.type === "highpass" || point.type === "lowpass" ? 20 * Math.log10(point.q) : point.q;
      filter.getFrequencyResponse(axis, magnitude, phase);
      for (let i = 0; i < sum.length; i++) sum[i] += 20 * Math.log10(Math.max(magnitude[i], 1e-6));
    }
    const x = (i: number) => LEFT + (i / (axis.length - 1)) * (WIDTH - LEFT - RIGHT);
    const y = (db: number) => TOP + (1 - (Math.max(-24, Math.min(24, db)) + 24) / 48) * (HEIGHT - TOP - BOTTOM);
    return frequencies.map((_, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(sum[i] + preamp).toFixed(1)}`).join(" ");
  }, [points, preamp, bypass]);
  return <div className="rounded-xl border border-border bg-background/70 p-3" aria-label="Equalizer frequency response">
    <div className="mb-2 flex items-center justify-between gap-2"><span className="text-xs font-medium">Frequency response</span><span className="text-[11px] text-secondary">{bypass ? "DSP bypassed" : path ? "Estimated filter curve" : "Unavailable"}</span></div>
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Estimated equalizer response from 20 Hz to 20 kHz" className="w-full">
      {[-12, 0, 12].map(db => <g key={db}><line x1={LEFT} x2={WIDTH - RIGHT} y1={TOP + (1 - (db + 24) / 48) * (HEIGHT - TOP - BOTTOM)} y2={TOP + (1 - (db + 24) / 48) * (HEIGHT - TOP - BOTTOM)} stroke="currentColor" opacity=".16" strokeDasharray={db ? "3 4" : undefined} /><text x={LEFT - 5} y={TOP + (1 - (db + 24) / 48) * (HEIGHT - TOP - BOTTOM) + 3} textAnchor="end" fontSize="10" fill="currentColor">{db}dB</text></g>)}
      {[20, 100, 1000, 10000, 20000].map(hz => { const x = LEFT + Math.log10(hz / 20) / 3 * (WIDTH - LEFT - RIGHT); return <text key={hz} x={x} y={HEIGHT - 4} textAnchor="middle" fontSize="10" fill="currentColor">{hz >= 1000 ? `${hz / 1000}k` : hz}</text>; })}
      {path && <path d={path} fill="none" stroke="#f97316" strokeWidth="2" />}
    </svg>
    <p className="mt-1 text-[11px] text-secondary">Visual estimate only; actual output also depends on playback routing, device and headroom management.</p>
  </div>;
}
