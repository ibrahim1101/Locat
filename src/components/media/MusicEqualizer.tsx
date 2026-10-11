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
type Settings = { bands: BandCount; mode: Mode; gains: number[]; preamp: number; preset: string };
const defaults: Settings = { bands: 10, mode: "pure", gains: Array(10).fill(0), preamp: 0, preset: "Flat" };
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
      bands, mode: value.mode === "enhanced" ? "enhanced" : "pure",
      gains: Array.isArray(value.gains) && value.gains.length === bands
        ? value.gains.map(g => Number.isFinite(g) ? Math.max(-12, Math.min(12, g)) : 0)
        : FREQUENCIES[bands].map(() => 0),
      preamp: Number.isFinite(value.preamp) ? Math.max(-18, Math.min(0, value.preamp!)) : 0,
      preset: typeof value.preset === "string" && PRESETS.includes(value.preset as typeof PRESETS[number]) ? value.preset : "Custom",
    };
  } catch { return defaults; }
}
function label(frequency: number) { return frequency >= 1000 ? `${frequency / 1000}k` : String(frequency); }

export function MusicEqualizer({ src, onEnded }: { src: string; onEnded: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [settings, setSettings] = useState<Settings>(restore);
  const [error, setError] = useState("");
  const graph = useRef<{ context: AudioContext; source: MediaElementAudioSourceNode; filters: BiquadFilterNode[]; preamp: GainNode } | null>(null);
  const { bands, gains, mode, preamp, preset } = settings;
  const frequencies = FREQUENCIES[bands];

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* storage may be disabled */ }
  }, [settings]);

  useEffect(() => {
    const element = audioRef.current;
    if (!element) return;
    let disposed = false;
    try {
      const context = new AudioContext();
      const source = context.createMediaElementSource(element);
      const preampNode = context.createGain();
      const filters = FREQUENCIES[31].map(() => context.createBiquadFilter());
      filters.forEach(filter => { filter.type = "peaking"; });
      graph.current = { context, source, filters, preamp: preampNode };
      source.connect(context.destination);
      const resume = () => { if (!disposed) void context.resume().catch(() => setError("Audio processing could not start.")); };
      element.addEventListener("play", resume);
      return () => {
        disposed = true;
        element.removeEventListener("play", resume);
        source.disconnect();
        filters.forEach(filter => filter.disconnect());
        preampNode.disconnect();
        graph.current = null;
        void context.close();
      };
    } catch { setError("Web Audio processing is unavailable on this device."); }
  }, []);

  useEffect(() => {
    const active = graph.current;
    if (!active) return;
    const { source, context, filters, preamp: preampNode } = active;
    source.disconnect();
    filters.forEach(filter => filter.disconnect());
    preampNode.disconnect();
    if (mode === "pure") { source.connect(context.destination); return; }
    // Cut headroom automatically for positive boosts; user preamp can attenuate further.
    const headroom = Math.max(0, ...gains);
    preampNode.gain.setTargetAtTime(Math.pow(10, (preamp - headroom) / 20), context.currentTime, 0.02);
    source.connect(preampNode);
    frequencies.forEach((frequency, index) => {
      const filter = filters[index];
      filter.frequency.setValueAtTime(Math.min(frequency, context.sampleRate / 2 - 1), context.currentTime);
      filter.Q.setValueAtTime(bands === 31 ? 4.3 : bands === 15 ? 2.2 : bands === 10 ? 1.4 : 0.7, context.currentTime);
      filter.gain.setTargetAtTime(gains[index], context.currentTime, 0.02);
      if (index === 0) preampNode.connect(filter);
      else filters[index - 1].connect(filter);
    });
    filters[frequencies.length - 1].connect(context.destination);
  }, [bands, mode, gains, preamp, frequencies]);

  const update = (patch: Partial<Settings>) => setSettings(previous => ({ ...previous, ...patch }));
  return <div className="space-y-4">
    <audio ref={audioRef} src={src} controls onEnded={onEnded} className="w-full" />
    <section className="rounded-2xl border border-border bg-card/80 p-5 space-y-4" aria-label="Music equalizer">
      <div><h2 className="font-semibold">Locat Music · Graphic Equalizer</h2><p className="text-xs text-secondary">Pure bypasses DSP. Enhanced applies EQ with automatic boost headroom; output is not verified bit-perfect.</p></div>
      <div className="flex flex-wrap gap-2">
        {(["pure", "enhanced"] as const).map(value => <button key={value} type="button" aria-pressed={mode === value} onClick={() => update({ mode: value })} className={`rounded-lg border px-3 py-2 text-sm ${mode === value ? "border-primary ember-text" : "text-secondary"}`}>{value === "pure" ? "Pure Audio" : "Enhanced DSP"}</button>)}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="text-sm">EQ bands <select aria-label="Equalizer band count" value={bands} onChange={event => { const count = Number(event.target.value) as BandCount; update({ bands: count, gains: FREQUENCIES[count].map(f => preset === "Custom" ? 0 : presetGain(preset, f)) }); }} className="ml-2 rounded-lg border bg-background px-2 py-2">{([5, 10, 15, 31] as const).map(count => <option key={count} value={count}>{count}-band</option>)}</select></label>
        <label className="text-sm">Preset <select aria-label="EQ preset" value={preset} onChange={event => { const name = event.target.value; update({ preset: name, gains: frequencies.map(f => presetGain(name, f)) }); }} className="ml-2 rounded-lg border bg-background px-2 py-2">{PRESETS.map(name => <option key={name}>{name}</option>)}</select></label>
        <button type="button" onClick={() => update({ gains: frequencies.map(() => 0), preamp: 0, preset: "Flat" })} className="rounded-lg border px-3 py-2 text-sm">Reset EQ</button>
      </div>
      <label className="block text-sm">Preamp: {preamp} dB <input aria-label="EQ preamp" type="range" min="-18" max="0" step="1" value={preamp} disabled={mode === "pure"} onChange={event => update({ preamp: Number(event.target.value) })} className="ml-3 accent-orange-500" /></label>
      <div className="overflow-x-auto pb-2"><div className="flex min-w-max gap-2">
        {frequencies.map((frequency, index) => <label key={frequency} className="flex w-11 flex-col items-center gap-2 text-[11px] text-secondary">
          <span>{gains[index] > 0 ? "+" : ""}{gains[index]}</span>
          <input type="range" min="-12" max="12" step="1" value={gains[index]} disabled={mode === "pure"} onChange={event => { const next = [...gains]; next[index] = Number(event.target.value); update({ gains: next, preset: "Custom" }); }} aria-label={`${frequency} Hz gain`} className="h-28 w-5 accent-orange-500" style={{ writingMode: "vertical-lr", direction: "rtl" }} />
          <span>{label(frequency)}</span>
        </label>)}
      </div></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  </div>;
}
