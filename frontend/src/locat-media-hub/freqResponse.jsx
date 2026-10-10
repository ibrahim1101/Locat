import React, { useMemo } from "react";

/**
 * Computes the magnitude response (dB) at ``freqs`` for a chain of
 * biquad filters. Uses the real Web Audio ``getFrequencyResponse`` API
 * for each filter and sums the magnitudes (log-space).
 */
export function computeChainResponse(ctx, filters, freqs) {
  const n = freqs.length;
  const total = new Float32Array(n).fill(1);
  const magOut = new Float32Array(n);
  const phaseOut = new Float32Array(n);
  const freqArray = new Float32Array(freqs);
  for (const f of filters) {
    f.getFrequencyResponse(freqArray, magOut, phaseOut);
    for (let i = 0; i < n; i += 1) total[i] *= magOut[i];
  }
  const db = new Array(n);
  for (let i = 0; i < n; i += 1) db[i] = 20 * Math.log10(Math.max(total[i], 1e-6));
  return db;
}

/** Log-spaced frequencies between 20 Hz and 20 kHz. */
export function logFreqAxis(count = 128) {
  const out = new Array(count);
  const lo = Math.log10(20);
  const hi = Math.log10(20000);
  for (let i = 0; i < count; i += 1) {
    out[i] = Math.pow(10, lo + ((hi - lo) * i) / (count - 1));
  }
  return out;
}

/** Pure SVG frequency-response graph (no canvas, server-safe). */
export function FrequencyResponseGraph({ preset }) {
  const points = useMemo(() => {
    const AC = typeof window !== "undefined" ? (window.OfflineAudioContext || window.webkitOfflineAudioContext) : null;
    if (!AC || !preset) return [];
    const ctx = new AC(1, 1, 44100);
    const filters = [];
    (preset.bands || []).forEach((b, i, arr) => {
      const node = ctx.createBiquadFilter();
      node.type = i === 0 ? "lowshelf" : i === arr.length - 1 ? "highshelf" : "peaking";
      node.frequency.value = b.frequency_hz;
      node.gain.value = b.gain_db || 0;
      node.Q.value = 1.0;
      filters.push(node);
    });
    (preset.parametric || []).filter((p) => p.enabled !== false).forEach((p) => {
      const node = ctx.createBiquadFilter();
      node.type = p.kind || "peaking";
      node.frequency.value = p.frequency_hz;
      node.gain.value = p.gain_db || 0;
      node.Q.value = p.q || 1.0;
      filters.push(node);
    });
    const freqs = logFreqAxis(128);
    const db = computeChainResponse(ctx, filters, freqs);
    return freqs.map((f, i) => ({ f, db: db[i] + (preset.preamp_db || 0) }));
  }, [preset]);

  const W = 640, H = 180, MARGIN_L = 36, MARGIN_B = 20, MARGIN_T = 10, MARGIN_R = 10;
  const dbMin = -18, dbMax = 18;
  const xMin = Math.log10(20), xMax = Math.log10(20000);
  const px = (f) => MARGIN_L + ((Math.log10(f) - xMin) / (xMax - xMin)) * (W - MARGIN_L - MARGIN_R);
  const py = (db) => MARGIN_T + (1 - (db - dbMin) / (dbMax - dbMin)) * (H - MARGIN_T - MARGIN_B);
  const d = points.length === 0 ? "" :
    "M " + points.map((p) => `${px(p.f).toFixed(1)} ${py(p.db).toFixed(1)}`).join(" L ");

  const refFreqs = [20, 100, 1000, 10000, 20000];
  const refDbs = [-12, -6, 0, 6, 12];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-44 bg-black/40 rounded-md border border-white/[0.06]"
         data-testid="eq-freq-response">
      {/* gridlines */}
      {refDbs.map((d) => (
        <line key={d} x1={MARGIN_L} x2={W - MARGIN_R} y1={py(d)} y2={py(d)} stroke="rgba(255,255,255,0.06)" strokeDasharray={d === 0 ? "" : "2 3"} />
      ))}
      {refFreqs.map((f) => (
        <line key={f} x1={px(f)} x2={px(f)} y1={MARGIN_T} y2={H - MARGIN_B} stroke="rgba(255,255,255,0.05)" />
      ))}
      {/* axes labels */}
      {refFreqs.map((f) => (
        <text key={`fx-${f}`} x={px(f)} y={H - 6} textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono" fill="#64748b">
          {f >= 1000 ? `${f / 1000}k` : f}
        </text>
      ))}
      {refDbs.map((d) => (
        <text key={`dy-${d}`} x={MARGIN_L - 6} y={py(d) + 3} textAnchor="end" fontSize="9" fontFamily="JetBrains Mono" fill="#64748b">
          {d > 0 ? `+${d}` : d}
        </text>
      ))}
      {/* 0dB reference */}
      <line x1={MARGIN_L} x2={W - MARGIN_R} y1={py(0)} y2={py(0)} stroke="rgba(16,185,129,0.4)" />
      {/* curve */}
      <path d={d} stroke="#10b981" strokeWidth="2" fill="none" />
    </svg>
  );
}
