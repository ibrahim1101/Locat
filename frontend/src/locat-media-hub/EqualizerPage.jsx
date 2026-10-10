import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, RotateCcw, Save, Sliders, Trash2, Volume2 } from "lucide-react";
import { api } from "./api";
import { useAudioEngine } from "./AudioEngine";
import { BitPerfectChip } from "./chips";
import { FrequencyResponseGraph } from "./freqResponse";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const BAND_FREQS = {
  "10": [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000],
  "15": [25, 40, 63, 100, 160, 250, 400, 630, 1000, 1600, 2500, 4000, 6300, 10000, 16000],
  "31": [20, 25, 31, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800,
         1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000],
};

/** Custom vertical slider: 0 dB centered, draggable with pointer AND touch. */
function VerticalSlider({ value, onChange, min = -12, max = 12, step = 0.1,
                         height = 160, disabled = false, testId }) {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const setFromClientY = (clientY) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
    const pct = y / rect.height;                       // 0 top → 1 bottom
    const raw = max - pct * (max - min);               // max at top, min at bottom
    const stepped = Math.round(raw / step) * step;
    const clamped = Math.max(min, Math.min(max, stepped));
    const rounded = Math.round(clamped * 10) / 10;
    if (rounded !== value) onChange(rounded);
  };

  const onPointerDown = (e) => {
    if (disabled) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    setDragging(true);
    setFromClientY(e.clientY);
  };
  const onPointerMove = (e) => {
    if (!dragging) return;
    setFromClientY(e.clientY);
  };
  const onPointerUp = (e) => {
    setDragging(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
  };
  const onKeyDown = (e) => {
    if (disabled) return;
    const bigStep = e.shiftKey ? step * 10 : step;
    if (e.key === "ArrowUp") { onChange(Math.min(max, Math.round((value + bigStep) * 10) / 10)); e.preventDefault(); }
    else if (e.key === "ArrowDown") { onChange(Math.max(min, Math.round((value - bigStep) * 10) / 10)); e.preventDefault(); }
    else if (e.key === "Home") { onChange(max); e.preventDefault(); }
    else if (e.key === "End") { onChange(min); e.preventDefault(); }
    else if (e.key === "0") { onChange(0); e.preventDefault(); }
  };
  const onDoubleClick = () => { if (!disabled) onChange(0); };

  const pct = (max - value) / (max - min);              // 0..1 top→bottom
  const zeroPct = (max - 0) / (max - min);
  const fillTop = Math.min(zeroPct, pct);
  const fillBot = Math.max(zeroPct, pct);

  return (
    <div
      role="slider"
      aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}
      aria-orientation="vertical"
      tabIndex={disabled ? -1 : 0}
      data-testid={testId}
      ref={trackRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      onDoubleClick={onDoubleClick}
      className={`relative w-7 select-none focus:outline-none ${
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400/60 rounded-full"
      }`}
      style={{ height, touchAction: "none" }}
    >
      {/* track */}
      <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-[3px] bg-white/10 rounded-full" />
      {/* +6 / -6 tick marks */}
      {[-6, 6].map((db) => (
        <div key={db} className="absolute left-1/2 -translate-x-1/2 w-2 h-[1px] bg-white/15"
             style={{ top: `${((max - db) / (max - min)) * 100}%` }} />
      ))}
      {/* 0 dB center mark */}
      <div className="absolute left-1/2 -translate-x-1/2 w-3 h-[1px] bg-white/30"
           style={{ top: `${zeroPct * 100}%` }} />
      {/* fill from 0 dB to current value */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 w-[3px] rounded-full ${
          value > 0.05 ? "bg-emerald-400" : value < -0.05 ? "bg-sky-400" : "bg-white/20"
        }`}
        style={{ top: `${fillTop * 100}%`, height: `${(fillBot - fillTop) * 100}%` }}
      />
      {/* thumb */}
      <div
        className="absolute left-1/2 w-4 h-4 rounded-full bg-white shadow-[0_0_14px_rgba(255,255,255,0.5)] border border-white/60 pointer-events-none"
        style={{
          top: `${pct * 100}%`,
          transform: `translate(-50%, -50%) scale(${dragging ? 1.2 : 1})`,
          transition: dragging ? "none" : "transform 120ms",
        }}
      />
    </div>
  );
}

function BandSlider({ band, disabled, onChange, idx }) {
  const freqLabel =
    band.frequency_hz >= 1000
      ? `${(band.frequency_hz / 1000).toFixed(band.frequency_hz < 10000 ? 1 : 0)}k`
      : `${band.frequency_hz}`;
  const gainTxt = band.gain_db >= 0 ? `+${band.gain_db.toFixed(1)}` : band.gain_db.toFixed(1);
  const gainColor =
    band.gain_db > 0.05 ? "text-emerald-300" :
    band.gain_db < -0.05 ? "text-sky-300" : "text-zinc-400";
  return (
    <div className="flex flex-col items-center gap-2 min-w-[40px]" data-testid={`eq-band-${idx}`}>
      <div className={`text-[11px] font-mono tabular-nums w-10 text-center ${gainColor}`}
           data-testid={`eq-band-value-${idx}`}>
        {gainTxt}
      </div>
      <VerticalSlider
        value={band.gain_db}
        onChange={onChange}
        min={-12} max={12} step={0.1}
        height={160}
        disabled={disabled}
        testId={`eq-band-input-${idx}`}
      />
      <div className="text-[10px] font-mono text-zinc-500">{freqLabel}</div>
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
              {bandsCount}-band · peak {maxGain.toFixed(1)} dB
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* 10 / 15 / 31 mode selector */}
            <div className="flex items-center gap-1 mr-2" data-testid="eq-bands-mode">
              {["10", "15", "31"].map((m) => (
                <button
                  key={m}
                  disabled={disabled || !preset}
                  onClick={() => {
                    const freqs = BAND_FREQS[m];
                    setPreset({
                      ...preset,
                      bands_mode: m,
                      bands: freqs.map((f) => ({ frequency_hz: f, gain_db: 0 })),
                      is_builtin: false,
                    });
                  }}
                  data-testid={`eq-mode-${m}`}
                  className={`font-mono text-xs px-2.5 py-1.5 rounded border ${
                    preset?.bands_mode === m
                      ? "bg-emerald-400 text-black border-emerald-400"
                      : "bg-transparent text-zinc-300 border-white/15 hover:bg-white/5"
                  }`}
                >
                  {m}-band
                </button>
              ))}
            </div>
            <button
              disabled={disabled || !preset}
              onClick={() => {
                const bands = (preset?.bands || []).map((b) => ({ ...b, gain_db: 0 }));
                const parametric = (preset?.parametric || []).map((p) => ({ ...p, gain_db: 0 }));
                setPreset({ ...preset, bands, parametric, preamp_db: 0, is_builtin: false });
              }}
              data-testid="eq-flat-reset"
              className="font-mono text-xs px-3 py-1.5 rounded-md border border-white/15 text-zinc-200 hover:bg-white/5 inline-flex items-center gap-1"
              title="Reset all bands to 0 dB"
            >
              <RotateCcw size={12} /> Flat
            </button>
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

      {/* Parametric EQ + live frequency response */}
      <section className="locat-glass rounded-2xl p-6" data-testid="parametric-section">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2 text-white font-display text-lg">
            <Sliders size={16} className="text-sky-300" />
            Parametric filters
            <span className="text-[11px] font-mono text-zinc-500 ml-2">
              peaking · low/high shelf · low/high pass · notch
            </span>
          </div>
          <Button
            variant="outline"
            disabled={disabled || !preset}
            onClick={() => {
              const parametric = [...(preset.parametric || []), {
                kind: "peaking", frequency_hz: 1000, gain_db: 0, q: 1.0, enabled: true,
              }];
              setPreset({ ...preset, parametric, is_builtin: false });
            }}
            className="border-white/15 text-white hover:bg-white/10 bg-transparent"
            data-testid="eq-add-parametric"
          >
            <Plus size={12} /> Add filter
          </Button>
        </div>

        <FrequencyResponseGraph preset={preset} />

        <div className="mt-5 space-y-2" data-testid="parametric-list">
          {(preset?.parametric || []).map((p, i) => (
            <div
              key={i}
              className="grid grid-cols-[auto,minmax(0,120px),minmax(0,1fr),minmax(0,1fr),minmax(0,1fr),auto] items-center gap-3 bg-black/30 rounded-lg px-3 py-2 border border-white/[0.05]"
              data-testid={`parametric-row-${i}`}
            >
              <Switch
                checked={p.enabled !== false}
                disabled={disabled}
                onCheckedChange={(v) => {
                  const parametric = [...preset.parametric];
                  parametric[i] = { ...p, enabled: v };
                  setPreset({ ...preset, parametric, is_builtin: false });
                }}
              />
              <select
                disabled={disabled}
                value={p.kind}
                onChange={(e) => {
                  const parametric = [...preset.parametric];
                  parametric[i] = { ...p, kind: e.target.value };
                  setPreset({ ...preset, parametric, is_builtin: false });
                }}
                className="bg-white/[0.04] border border-white/10 rounded-md px-2 py-1 text-xs font-mono text-white"
                data-testid={`parametric-kind-${i}`}
              >
                {["peaking","lowshelf","highshelf","lowpass","highpass","notch"].map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
              <div>
                <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Frequency</div>
                <div className="flex items-center gap-2">
                  <Slider
                    disabled={disabled}
                    value={[Math.log10(p.frequency_hz)]}
                    onValueChange={(v) => {
                      const parametric = [...preset.parametric];
                      parametric[i] = { ...p, frequency_hz: Math.round(Math.pow(10, v[0])) };
                      setPreset({ ...preset, parametric, is_builtin: false });
                    }}
                    min={Math.log10(20)} max={Math.log10(20000)} step={0.01}
                  />
                  <span className="text-[11px] font-mono text-zinc-300 w-16 text-right">
                    {p.frequency_hz >= 1000 ? `${(p.frequency_hz / 1000).toFixed(2)}k` : p.frequency_hz} Hz
                  </span>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Gain</div>
                <div className="flex items-center gap-2">
                  <Slider
                    disabled={disabled || ["lowpass","highpass","notch"].includes(p.kind)}
                    value={[p.gain_db]}
                    onValueChange={(v) => {
                      const parametric = [...preset.parametric];
                      parametric[i] = { ...p, gain_db: v[0] };
                      setPreset({ ...preset, parametric, is_builtin: false });
                    }}
                    min={-18} max={18} step={0.1}
                  />
                  <span className="text-[11px] font-mono text-zinc-300 w-14 text-right">
                    {p.gain_db >= 0 ? `+${p.gain_db.toFixed(1)}` : p.gain_db.toFixed(1)} dB
                  </span>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Q</div>
                <div className="flex items-center gap-2">
                  <Slider
                    disabled={disabled}
                    value={[p.q]}
                    onValueChange={(v) => {
                      const parametric = [...preset.parametric];
                      parametric[i] = { ...p, q: v[0] };
                      setPreset({ ...preset, parametric, is_builtin: false });
                    }}
                    min={0.1} max={10} step={0.05}
                  />
                  <span className="text-[11px] font-mono text-zinc-300 w-10 text-right">{p.q.toFixed(2)}</span>
                </div>
              </div>
              <button
                onClick={() => {
                  const parametric = preset.parametric.filter((_, j) => j !== i);
                  setPreset({ ...preset, parametric, is_builtin: false });
                }}
                disabled={disabled}
                className="w-8 h-8 rounded-md text-zinc-500 hover:text-red-400 hover:bg-white/5 flex items-center justify-center"
                data-testid={`parametric-del-${i}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {(preset?.parametric || []).length === 0 && (
            <div className="text-xs text-zinc-500 font-mono">
              No parametric filters yet. Add one to sculpt specific frequencies on top of the graphic EQ.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
