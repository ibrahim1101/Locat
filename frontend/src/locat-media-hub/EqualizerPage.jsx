import React, { useEffect, useMemo, useState } from "react";
import { Save, Sliders, Volume2 } from "lucide-react";
import { api } from "./api";
import { useAudioEngine } from "./AudioEngine";
import { BitPerfectChip } from "./chips";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

function BandSlider({ band, disabled, onChange, idx }) {
  return (
    <div className="flex flex-col items-center gap-2" data-testid={`eq-band-${idx}`}>
      <div className="h-28 flex flex-col items-center justify-end">
        <div className="text-[10px] font-mono text-zinc-400 mb-1">
          {band.gain_db >= 0 ? `+${band.gain_db.toFixed(1)}` : band.gain_db.toFixed(1)}
        </div>
        <input
          type="range"
          disabled={disabled}
          min={-12} max={12} step={0.1}
          value={band.gain_db}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="h-24 appearance-none locat-vertical-slider"
          style={{
            WebkitAppearance: "slider-vertical",
            width: 20,
            background: "transparent",
          }}
          data-testid={`eq-band-input-${idx}`}
        />
      </div>
      <div className="text-[10px] font-mono text-zinc-500">
        {band.frequency_hz >= 1000 ? `${(band.frequency_hz / 1000).toFixed(band.frequency_hz < 10000 ? 1 : 0)}k` : band.frequency_hz}
      </div>
    </div>
  );
}

export default function EqualizerPage() {
  const { mode, setMode, caps, preset, setPreset } = useAudioEngine();
  const [presets, setPresets] = useState([]);
  const [newName, setNewName] = useState("");

  const refresh = async () => {
    const p = await api.eqPresets();
    setPresets(p);
    if (preset) {
      const found = p.find((x) => x.id === preset.id) || p[0];
      if (found && found.id !== preset.id) setPreset(found);
    } else if (p.length) setPreset(p[0]);
  };
  useEffect(() => { refresh().catch(() => {}); }, []);

  const disabled = mode === "pure_audio";

  const updateBand = (idx, gain) => {
    if (!preset || disabled) return;
    const bands = preset.bands.map((b, i) => i === idx ? { ...b, gain_db: gain } : b);
    setPreset({ ...preset, bands, is_builtin: false });
  };

  const savePreset = async () => {
    if (!preset) return;
    const body = {
      ...preset,
      name: newName || `${preset.name} (edited)`,
      id: undefined,
      is_builtin: false,
    };
    const saved = await api.saveEqPreset(body);
    toast.success(`Saved preset "${saved.name}"`);
    setNewName("");
    await refresh();
    setPreset(saved);
  };

  const bandsCount = preset?.bands?.length || 0;
  const maxGain = useMemo(
    () => Math.max(0, ...(preset?.bands || []).map((b) => Math.abs(b.gain_db || 0))),
    [preset],
  );

  return (
    <div className="space-y-10" data-testid="eq-page">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-500">audio engine</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Pure Audio vs Enhanced DSP
          </h1>
          <p className="text-zinc-400 text-sm mt-2 max-w-xl">
            Pure Audio bypasses every DSP stage — no EQ, no ReplayGain, no limiter — and routes
            audio straight to the browser output. Enhanced DSP engages a {bandsCount}-band
            graphic equalizer plus preamp and optional limiter.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {caps && <BitPerfectChip status={caps.bit_perfect} />}
        </div>
      </div>

      <section className="locat-glass rounded-2xl p-6" data-testid="audio-mode-section">
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setMode("pure_audio")}
                data-testid="mode-pure-audio"
                className={`px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-wider border transition ${
                  mode === "pure_audio"
                    ? "bg-white text-black border-white"
                    : "bg-transparent text-zinc-300 border-white/15 hover:bg-white/5"
                }`}
              >
                Pure Audio
              </button>
              <button
                onClick={() => setMode("enhanced_dsp")}
                data-testid="mode-enhanced-dsp"
                className={`px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-wider border transition ${
                  mode === "enhanced_dsp"
                    ? "bg-emerald-400 text-black border-emerald-400"
                    : "bg-transparent text-zinc-300 border-white/15 hover:bg-white/5"
                }`}
              >
                Enhanced DSP
              </button>
            </div>
            <p className="text-xs text-zinc-500 mt-3 max-w-xl leading-relaxed" data-testid="mode-reason">
              {caps?.reason}
            </p>
          </div>
          <div className="text-right text-xs font-mono text-zinc-400">
            <div>Runtime: <span className="text-zinc-200">{caps?.runtime}</span></div>
            <div>Active mode: <span className="text-zinc-200">{caps?.active_mode}</span></div>
            <div>DSP enabled: <span className="text-zinc-200">{String(caps?.dsp_enabled)}</span></div>
            <div>Resampling detected: <span className="text-zinc-200">{String(caps?.resampling_detected)}</span></div>
          </div>
        </div>
      </section>

      <section className="locat-glass rounded-2xl p-6" data-testid="eq-section">
        <div className="flex items-center justify-between gap-5 flex-wrap mb-4">
          <div className="flex items-center gap-2 text-white font-display text-lg">
            <Sliders size={16} className="text-emerald-300" />
            Graphic equalizer
            <span className="text-[11px] font-mono text-zinc-500 ml-2">
              {bandsCount}-band · peak +{maxGain.toFixed(1)} dB
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {presets.map((p) => (
              <button key={p.id}
                      onClick={() => setPreset(p)}
                      data-testid={`eq-preset-${p.name}`}
                      className={`font-mono text-xs px-3 py-1.5 rounded-md border transition ${
                        preset?.id === p.id
                          ? "bg-white text-black border-white"
                          : "bg-transparent text-zinc-300 border-white/15 hover:bg-white/5"
                      }`}>
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {disabled && (
          <div className="mb-4 text-xs font-mono text-amber-300/80 border border-amber-400/20 bg-amber-400/5 rounded-md px-3 py-2" data-testid="eq-disabled-notice">
            Pure Audio is active — EQ, ReplayGain, limiter and balance are bypassed.
          </div>
        )}

        <div className="flex items-end justify-center gap-3 sm:gap-6 overflow-x-auto pb-2" data-testid="eq-bands">
          {(preset?.bands || []).map((b, i) => (
            <BandSlider key={i} band={b} disabled={disabled} idx={i}
                        onChange={(g) => updateBand(i, g)} />
          ))}
        </div>

        <div className="mt-6 grid md:grid-cols-3 gap-5 items-start">
          <div>
            <label className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">Preamp</label>
            <div className="flex items-center gap-3 mt-2">
              <Volume2 size={14} className="text-zinc-500" />
              <Slider
                value={[preset?.preamp_db || 0]}
                onValueChange={(v) => setPreset({ ...preset, preamp_db: v[0] })}
                min={-12} max={6} step={0.1}
                disabled={disabled}
                data-testid="eq-preamp"
                className="w-full"
              />
              <span className="text-xs font-mono text-zinc-300 w-14 text-right">
                {(preset?.preamp_db || 0).toFixed(1)} dB
              </span>
            </div>
          </div>

          <div>
            <label className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">Limiter</label>
            <div className="flex items-center gap-3 mt-2">
              <Switch
                checked={!!preset?.limiter_enabled}
                disabled={disabled}
                onCheckedChange={(v) => setPreset({ ...preset, limiter_enabled: v })}
                data-testid="eq-limiter"
              />
              <span className="text-xs font-mono text-zinc-400">
                Soft brick-wall limiter to prevent clipping
              </span>
            </div>
          </div>

          <div>
            <label className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">ReplayGain</label>
            <div className="flex items-center gap-2 mt-2">
              {["off", "track", "album"].map((m) => (
                <button
                  key={m}
                  onClick={() => setPreset({ ...preset, replaygain_mode: m })}
                  disabled={disabled}
                  data-testid={`eq-rg-${m}`}
                  className={`font-mono text-[11px] px-2.5 py-1 rounded border uppercase tracking-wider ${
                    preset?.replaygain_mode === m
                      ? "bg-white text-black border-white"
                      : "text-zinc-300 border-white/15 hover:bg-white/5"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3 flex-wrap">
          <Input
            placeholder="Save as preset name…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            disabled={disabled}
            className="w-64 bg-white/[0.04] border-white/10 text-white placeholder:text-zinc-500"
            data-testid="eq-save-name"
          />
          <Button
            onClick={savePreset}
            disabled={disabled || !preset}
            className="bg-emerald-400 text-black hover:bg-emerald-300"
            data-testid="eq-save-btn"
          >
            <Save size={14} /> Save preset
          </Button>
          <div className="text-[11px] font-mono text-zinc-500">
            Saved presets persist in Locat's media database and reload on restart.
          </div>
        </div>
      </section>
    </div>
  );
}
