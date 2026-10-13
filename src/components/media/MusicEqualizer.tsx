import { MusicFrequencyResponse } from "./MusicFrequencyResponse";
import { MUSIC_PRESET_KEY, parseMusicPresets, upsertMusicPreset, type SavedMusicPreset } from "@/lib/musicPresets";
import { connectEqGraph, sanitizePoints, parametricPreset, FILTER_TYPES, MAX_EQ_POINTS, type EqPoint } from "@/lib/musicEq";
import { useEffect, useRef, useState } from "react";

type Mode = "pure" | "enhanced";
type BandCount = 5 | 10 | 15 | 31;
const FREQUENCIES: Record<BandCount, number[]> = {
  5: [60, 230, 910, 3600, 14000],
  10: [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000],
  15: [25, 40, 63, 100, 160, 250, 400, 630, 1000, 1600, 2500, 4000, 6300, 10000, 16000],
  31: [20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000],
};
const STORAGE_KEY = "locat-music-eq-v2";
type Settings = { bands: BandCount; mode: Mode; gains: number[]; preamp: number; preset: string; kind: "graphic" | "parametric"; points: EqPoint[] };
const defaults: Settings = { bands: 10, mode: "pure", gains: Array(10).fill(0), preamp: 0, preset: "Flat", kind: "graphic", points: [] };
const PRESETS = ["Flat", "Warm", "Clarity", "Bass Boost", "Vocal", "Custom"] as const;
function presetGain(name: string, frequency: number): number {
  if (name === "Warm") return frequency < 150 ? 3 : frequency < 500 ? 1 : frequency > 5000 ? -2 : 0;
  if (name === "Clarity") return frequency < 150 ? -2 : frequency >= 1500 && frequency <= 6000 ? 3 : 0;
  if (name === "Bass Boost") return frequency <= 100 ? 5 : frequency <= 250 ? 3 : 0;
  if (name === "Vocal") return frequency < 180 ? -2 : frequency >= 500 && frequency <= 4000 ? 3 : 0;
  return 0;
}
function restore(): Settings {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<Settings> | null;
    if (!value || ![5, 10, 15, 31].includes(value.bands as number)) return defaults;
    const bands = value.bands as BandCount;
    return {
      bands, kind: value.kind === "parametric" ? "parametric" : "graphic", points: sanitizePoints(value.points), mode: value.mode === "enhanced" ? "enhanced" : "pure",
      gains: Array.isArray(value.gains) && value.gains.length === bands
        ? value.gains.map(g => Number.isFinite(g) ? Math.max(-12, Math.min(12, g)) : 0)
        : FREQUENCIES[bands].map(() => 0),
      preamp: Number.isFinite(value.preamp) ? Math.max(-18, Math.min(0, value.preamp!)) : 0,
      preset: typeof value.preset === "string" && PRESETS.includes(value.preset as typeof PRESETS[number]) ? value.preset : "Custom",
    };
  } catch { return defaults; }
}
function label(frequency: number) { return frequency >= 1000 ? `${frequency / 1000}k` : String(frequency); }

export function MusicEqualizer({ src, onEnded, repeatOne = false, autoplay = false }: { src: string; onEnded: () => void; repeatOne?: boolean; autoplay?: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [settings, setSettings] = useState<Settings>(restore);
  const [customPresets, setCustomPresets] = useState<SavedMusicPreset[]>(() => { try { return parseMusicPresets(localStorage.getItem(MUSIC_PRESET_KEY)); } catch { return []; } });
  const [presetName, setPresetName] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("");
  const [presetFeedback, setPresetFeedback] = useState("");
  const persistPresets = (next: SavedMusicPreset[]) => {
    setCustomPresets(next);
    try { localStorage.setItem(MUSIC_PRESET_KEY, JSON.stringify(next)); setPresetFeedback("Preset library saved on this device."); }
    catch { setPresetFeedback("Presets changed for this session; device storage prevented saving."); }
  };
  const [error, setError] = useState("");
  const graph = useRef<{ context: AudioContext; source: MediaElementAudioSourceNode; filters: BiquadFilterNode[]; preamp: GainNode } | null>(null);
  const graphLease = useRef(0);
  const { bands, gains, mode, preamp, preset, kind, points } = settings;
  const frequencies = FREQUENCIES[bands];
  const responsePoints: EqPoint[] = kind === "parametric" ? points : frequencies.map((frequency, index) => ({ type: "peaking" as const, frequency, gain: gains[index], q: bands === 31 ? 4.3 : bands === 15 ? 2.2 : bands === 10 ? 1.4 : 0.7 }));

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* storage may be disabled */ }
  }, [settings]);

  useEffect(() => {
    const element = audioRef.current;
    if (!element) return;
    const leaseRef = graphLease;
    const lease = ++leaseRef.current;
    let disposed = false;
    try {
      // StrictMode replays effects on the same audio element: reuse its source.
      if (!graph.current) {
        const context = new AudioContext();
        try {
          const source = context.createMediaElementSource(element);
          graph.current = { context, source, filters: FREQUENCIES[31].map(() => context.createBiquadFilter()), preamp: context.createGain() };
          source.connect(context.destination);
        } catch (error) { void context.close(); throw error; }
      }
      const { context, source, filters, preamp: preampNode } = graph.current;
      const resume = () => { if (!disposed) void context.resume().catch(() => setError("Audio processing could not start.")); };
      element.addEventListener("play", resume);
      return () => {
        disposed = true;
        element.removeEventListener("play", resume);
        queueMicrotask(() => {
          if (leaseRef.current !== lease) return;
          source.disconnect();
          filters.forEach(filter => filter.disconnect());
          preampNode.disconnect();
          graph.current = null;
          void context.close();
        });
      };
    } catch { queueMicrotask(() => setError("Web Audio processing is unavailable on this device.")); }
  }, []);

  useEffect(() => {
    const active = graph.current;
    if (!active) return;
    const { source, context, filters, preamp: preampNode } = active;
    connectEqGraph(source, context, filters, preampNode, responsePoints, preamp, mode === "pure");
  }, [bands, mode, gains, preamp, frequencies, kind, points]);

  const update = (patch: Partial<Settings>) => setSettings(previous => ({ ...previous, ...patch }));
  return <div className="space-y-4">
    <audio crossOrigin="anonymous" ref={audioRef} src={src} controls autoPlay={autoplay} onEnded={() => { if (repeatOne && audioRef.current) { audioRef.current.currentTime = 0; void audioRef.current.play().catch(() => setError("Tap Play to resume this track.")); } else onEnded(); }} onError={() => setError("This track could not play. Check its codec or host connection.")} onPlaying={() => { if (graph.current) setError(""); }} className="w-full" />
    <section className="rounded-2xl border border-border bg-card/80 p-5 space-y-4" aria-label="Music equalizer">
      <div><h2 className="font-semibold">Locat Music · Equalizer</h2><p className="text-xs text-secondary">Pure bypasses DSP. Enhanced applies EQ with boost and pass-filter resonance headroom. This reduces clipping risk; arbitrary waveforms may still peak. Output is not verified bit-perfect.</p></div>
      <div className="flex flex-wrap gap-2">
        {(["pure", "enhanced"] as const).map(value => <button key={value} type="button" aria-pressed={mode === value} onClick={() => update({ mode: value })} className={`rounded-lg border px-3 py-2 text-sm ${mode === value ? "border-primary ember-text" : "text-secondary"}`}>{value === "pure" ? "Pure Audio" : "Enhanced DSP"}</button>)}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="text-sm">EQ type <select aria-label="EQ type" value={kind} onChange={event => update({ kind: event.target.value as Settings["kind"] })} className="ml-2 rounded-lg border bg-background px-2 py-2"><option value="graphic">Graphic</option><option value="parametric">Parametric</option></select></label>
        <label className="text-sm">EQ bands <select aria-label="Equalizer band count" value={bands} onChange={event => { const count = Number(event.target.value) as BandCount; update({ bands: count, gains: FREQUENCIES[count].map(f => preset === "Custom" ? 0 : presetGain(preset, f)) }); }} className="ml-2 rounded-lg border bg-background px-2 py-2">{([5, 10, 15, 31] as const).map(count => <option key={count} value={count}>{count}-band</option>)}</select></label>
        <label className="text-sm">Preset <select aria-label="EQ preset" value={preset} onChange={event => { const name = event.target.value; update({ preset: name, points: parametricPreset(name), gains: frequencies.map(f => presetGain(name, f)) }); }} className="ml-2 rounded-lg border bg-background px-2 py-2">{PRESETS.map(name => <option key={name}>{name}</option>)}</select></label>
        <button type="button" onClick={() => update({ gains: frequencies.map(() => 0), preamp: 0, preset: "Flat", points: [] })} className="rounded-lg border px-3 py-2 text-sm">Reset EQ</button>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border p-3">
        <label className="text-sm">Saved presets <select aria-label="Saved music presets" value={selectedPreset} onChange={event => { const name = event.target.value; setSelectedPreset(name); const saved = customPresets.find(item => item.name === name); if (saved) { update({ ...saved, preset: "Custom" }); setPresetName(saved.name); } }} className="ml-2 max-w-full rounded border bg-background p-2"><option value="">Choose a preset</option>{customPresets.map(item => <option key={item.name}>{item.name}</option>)}</select></label>
        <input aria-label="Custom preset name" placeholder="Preset name" maxLength={60} value={presetName} onChange={event => setPresetName(event.target.value)} className="min-w-0 rounded border bg-background p-2 text-sm" />
        <button type="button" onClick={() => { try { persistPresets(upsertMusicPreset(customPresets, { ...settings, name: presetName })); setSelectedPreset(presetName.trim()); } catch (error) { setPresetFeedback(error instanceof Error ? error.message : "Could not save preset."); } }} className="rounded border px-3 py-2 text-sm">Save current EQ</button>
        <button type="button" disabled={!selectedPreset} onClick={() => { const saved = customPresets.find(item => item.name === selectedPreset); if (!saved) return; try { persistPresets(upsertMusicPreset(customPresets, { ...saved, name: presetName }, selectedPreset)); setSelectedPreset(presetName.trim()); } catch (error) { setPresetFeedback(error instanceof Error ? error.message : "Could not rename preset."); } }} className="rounded border px-3 py-2 text-sm disabled:opacity-40">Rename</button>
        <button type="button" disabled={!selectedPreset} onClick={() => { persistPresets(customPresets.filter(item => item.name !== selectedPreset)); setSelectedPreset(""); setPresetName(""); }} className="rounded border px-3 py-2 text-sm disabled:opacity-40">Delete preset</button>
        {presetFeedback && <p role="status" className="w-full text-xs text-secondary">{presetFeedback}</p>}
      </div>
      <label className="block text-sm">Preamp: {preamp} dB <input aria-label="EQ preamp" type="range" min="-18" max="0" step="1" value={preamp} disabled={mode === "pure"} onChange={event => update({ preamp: Number(event.target.value) })} className="ml-3 accent-orange-500" /></label>
      {kind === "graphic" && <div className="overflow-x-auto pb-2"><div className="flex min-w-max gap-2">
        {frequencies.map((frequency, index) => <label key={frequency} className="flex w-11 flex-col items-center gap-2 text-[11px] text-secondary">
          <span>{gains[index] > 0 ? "+" : ""}{gains[index]}</span>
          <input type="range" min="-12" max="12" step="1" value={gains[index]} disabled={mode === "pure"} onChange={event => { const next = [...gains]; next[index] = Number(event.target.value); update({ gains: next, preset: "Custom" }); }} aria-label={`${frequency} Hz gain`} className="h-28 w-5 accent-orange-500" style={{ writingMode: "vertical-lr", direction: "rtl" }} />
          <span>{label(frequency)}</span>
        </label>)}
      </div></div>}
      {kind === "parametric" && <div className="space-y-3">
        <p className="text-xs text-secondary">Up to 24 filters. Frequency 20–20,000 Hz, gain ±12 dB, Q 0.1–20. Pass filters use Q and ignore gain.</p>
        {points.map((point, index) => <div key={index} className="flex flex-wrap gap-2 items-center">
          <span className="text-xs">Filter {index + 1}</span>
          <select aria-label={`Filter ${index + 1} type`} value={point.type} disabled={mode === "pure"} onChange={event => { const next = [...points]; next[index] = { ...point, type: event.target.value as EqPoint["type"] }; update({ points: next, preset: "Custom" }); }} className="rounded border bg-background p-2">{FILTER_TYPES.map(type => <option key={type}>{type}</option>)}</select>
          {(["frequency", "gain", "q"] as const).map(field => <label key={field} className="text-xs">{field === "frequency" ? "Hz" : field === "gain" ? "dB" : "Q"} <input aria-label={`Filter ${index + 1} ${field}`} type="number" min={field === "frequency" ? 20 : field === "gain" ? -12 : 0.1} max={field === "frequency" ? 20000 : field === "gain" ? 12 : 20} step={field === "frequency" ? 1 : 0.1} value={point[field]} disabled={mode === "pure" || (field === "gain" && ["highpass", "lowpass"].includes(point.type))} onChange={event => { const next = [...points]; next[index] = { ...point, [field]: Number(event.target.value) }; update({ points: sanitizePoints(next), preset: "Custom" }); }} className="w-20 rounded border bg-background p-2" /></label>)}
          <button type="button" aria-label={`Remove filter ${index + 1}`} onClick={() => update({ points: points.filter((_, i) => i !== index), preset: "Custom" })} className="rounded border px-3 py-2 text-xs">Remove</button>
        </div>)}
        <button type="button" disabled={points.length >= MAX_EQ_POINTS} onClick={() => update({ points: [...points, { type: "peaking", frequency: 1000, gain: 0, q: 1 }], preset: "Custom" })} className="rounded-lg border px-3 py-2 text-sm">Add filter</button>
      </div>}
      <MusicFrequencyResponse points={responsePoints} preamp={preamp} bypass={mode === "pure"} />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  </div>;
}
