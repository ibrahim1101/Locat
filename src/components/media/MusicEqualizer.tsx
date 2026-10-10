import { useEffect, useRef, useState } from "react";

const FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
type Mode = "pure" | "enhanced";
const PRESETS: Record<string, number[]> = {
  Flat: FREQUENCIES.map(() => 0),
  Warm: [3, 3, 2, 1, 0, 0, -1, -1, -1, -2],
  Clarity: [-2, -1, 0, 0, 1, 2, 2, 2, 1, 0],
};

export function MusicEqualizer({ audioRef }: { audioRef: React.RefObject<HTMLAudioElement | null> }) {
  const [mode, setMode] = useState<Mode>("pure");
  const [gains, setGains] = useState<number[]>(() => [...PRESETS.Flat]);
  const [preset, setPreset] = useState("Flat");
  const [error, setError] = useState("");
  const graph = useRef<{ context: AudioContext; source: MediaElementAudioSourceNode; filters: BiquadFilterNode[] } | null>(null);

  useEffect(() => {
    const element = audioRef.current;
    if (!element) return;
    let cancelled = false;
    try {
      const context = new AudioContext();
      const source = context.createMediaElementSource(element);
      const filters = FREQUENCIES.map((frequency, index) => {
        const filter = context.createBiquadFilter();
        filter.type = "peaking";
        filter.frequency.value = Math.min(frequency, context.sampleRate / 2 - 1);
        filter.Q.value = 1.4;
        filter.gain.value = gains[index];
        return filter;
      });
      source.connect(context.destination);
      graph.current = { context, source, filters };
      // Browsers suspend audio contexts until a user gesture.
      const resume = () => { if (!cancelled) void context.resume().catch(() => setError("Audio processing could not start.")); };
      element.addEventListener("play", resume);
      return () => {
        cancelled = true;
        element.removeEventListener("play", resume);
        source.disconnect();
        filters.forEach(filter => filter.disconnect());
        graph.current = null;
        void context.close();
      };
    } catch {
      setError("Web Audio is unavailable for this playback device.");
    }
    // Graph must be created once per mounted audio element.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioRef]);

  useEffect(() => {
    const active = graph.current;
    if (!active) return;
    const { source, context, filters } = active;
    source.disconnect();
    filters.forEach(filter => filter.disconnect());
    filters.forEach((filter, index) => { filter.gain.setTargetAtTime(gains[index], context.currentTime, 0.015); });
    if (mode === "pure") {
      source.connect(context.destination);
    } else {
      source.connect(filters[0]);
      for (let i = 1; i < filters.length; i++) filters[i - 1].connect(filters[i]);
      filters[filters.length - 1].connect(context.destination);
    }
  }, [mode, gains]);

  return <section className="rounded-2xl border border-border bg-card/80 p-5 space-y-4" aria-label="Music equalizer">
    <div><h2 className="font-semibold">Audio modes & 10-band EQ</h2><p className="text-xs text-secondary">Pure bypasses EQ; browser output is not verified bit-perfect.</p></div>
    <div className="flex flex-wrap gap-2">
      <button type="button" aria-pressed={mode === "pure"} onClick={() => setMode("pure")} className={`rounded-lg border px-3 py-2 text-sm ${mode === "pure" ? "border-primary ember-text" : "text-secondary"}`}>Pure Audio</button>
      <button type="button" aria-pressed={mode === "enhanced"} onClick={() => setMode("enhanced")} className={`rounded-lg border px-3 py-2 text-sm ${mode === "enhanced" ? "border-primary ember-text" : "text-secondary"}`}>Enhanced DSP</button>
    </div>
    <label className="block text-sm">EQ preset
      <select className="ml-3 rounded-lg border bg-background px-3 py-2" value={preset} onChange={event => { const name = event.target.value; setPreset(name); setGains([...PRESETS[name]]); }}>
        {Object.keys(PRESETS).map(name => <option key={name} value={name}>{name}</option>)}
        {preset === "Custom" && <option value="Custom">Custom</option>}
      </select>
    </label>
    <div className="grid grid-cols-5 gap-3 sm:grid-cols-10">
      {FREQUENCIES.map((frequency, index) => <label key={frequency} className="flex flex-col items-center gap-2 text-[11px] text-secondary">
        <span>{gains[index] > 0 ? "+" : ""}{gains[index]} dB</span>
        <input type="range" min="-12" max="12" step="1" value={gains[index]} disabled={mode === "pure"} onChange={event => { const next = [...gains]; next[index] = Number(event.target.value); setGains(next); setPreset("Custom"); }} aria-label={`${frequency} Hz gain`} className="w-full accent-orange-500" />
        <span>{frequency >= 1000 ? `${frequency / 1000}k` : frequency}</span>
      </label>)}
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}
