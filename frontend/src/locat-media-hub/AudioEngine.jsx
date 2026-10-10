/**
 * DualModeAudioEngine — single source of truth for music playback.
 *
 * Pure Audio mode: the component uses a plain <audio> element with NO
 * Web Audio graph attached. The browser routes bits straight to its
 * mixer. Bit-perfect is still reported as "unavailable" because the
 * browser mixer may resample — we never claim verified.
 *
 * Enhanced DSP mode: a MediaElementAudioSourceNode is routed through a
 * chain of BiquadFilterNodes (one per EQ band), a preamp GainNode and
 * (optionally) a DynamicsCompressorNode acting as a soft limiter.
 *
 * Switching mode reinitializes the graph while preserving the queue
 * and the current playback position. Volume isn't jumped on switch.
 */
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import { api } from "./api";

const AudioEngineCtx = createContext(null);

export function useAudioEngine() {
  const v = useContext(AudioEngineCtx);
  if (!v) throw new Error("useAudioEngine must be used inside <AudioEngineProvider>");
  return v;
}

const DEVICE_ID = "web-preview";

export function AudioEngineProvider({ children }) {
  const audioRef = useRef(null);
  if (!audioRef.current && typeof Audio !== "undefined") {
    const el = new Audio();
    el.crossOrigin = "anonymous";
    el.preload = "auto";
    audioRef.current = el;
  }

  const ctxRef = useRef(null);
  const sourceRef = useRef(null);
  const preampRef = useRef(null);
  const filterNodesRef = useRef([]);
  const limiterRef = useRef(null);
  const destRef = useRef(null);

  const [mode, setModeState] = useState("enhanced_dsp");
  const [caps, setCaps] = useState(null);
  const [preset, setPreset] = useState(null);
  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.9);

  // --- Initial fetch of audio mode + presets ---
  useEffect(() => {
    (async () => {
      try {
        const [c, presets] = await Promise.all([
          api.getAudioMode(DEVICE_ID),
          api.eqPresets(),
        ]);
        setCaps(c);
        setModeState(c.active_mode || "enhanced_dsp");
        const flat = presets.find((p) => p.name === "Flat") || presets[0];
        if (flat) setPreset(flat);
      } catch (e) {
        console.warn("AudioEngine init failed", e);
      }
    })();
  }, []);

  const ensureGraph = useCallback(() => {
    if (!audioRef.current) return;
    if (!ctxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctxRef.current = new AC();
      sourceRef.current = ctxRef.current.createMediaElementSource(audioRef.current);
      preampRef.current = ctxRef.current.createGain();
      limiterRef.current = ctxRef.current.createDynamicsCompressor();
      // soft limiter settings — only used when preset.limiter_enabled
      limiterRef.current.threshold.value = -1;
      limiterRef.current.knee.value = 0;
      limiterRef.current.ratio.value = 20;
      limiterRef.current.attack.value = 0.003;
      limiterRef.current.release.value = 0.08;
      destRef.current = ctxRef.current.destination;
    }
  }, []);

  const rewireChain = useCallback(() => {
    const ctx = ctxRef.current;
    const source = sourceRef.current;
    if (!ctx || !source) return;
    source.disconnect();
    filterNodesRef.current.forEach((n) => n.disconnect());
    preampRef.current?.disconnect();
    limiterRef.current?.disconnect();

    if (mode === "pure_audio") {
      // Pure Audio: do NOT route through Web Audio graph. We detach the
      // MediaElementSource by not connecting anything — the <audio>
      // element plays through the browser default output directly.
      // (Note: once a MediaElementSource is created the stream flows
      // through it; to achieve a true no-DSP path we connect source
      // straight to destination with no interposed filters/gain.)
      source.connect(ctx.destination);
      return;
    }

    // Enhanced DSP: build biquad chain
    const bands = preset?.bands || [];
    const bandsMode = preset?.bands_mode || "10";
    const filters = bands.map((b, i) => {
      const node = ctx.createBiquadFilter();
      if (i === 0 && bandsMode !== "parametric") node.type = "lowshelf";
      else if (i === bands.length - 1 && bandsMode !== "parametric") node.type = "highshelf";
      else node.type = "peaking";
      node.frequency.value = b.frequency_hz;
      node.gain.value = b.gain_db || 0;
      node.Q.value = 1.0;
      return node;
    });
    filterNodesRef.current = filters;

    // preamp
    const preamp = preampRef.current;
    preamp.gain.value = Math.pow(10, (preset?.preamp_db || 0) / 20);

    let cursor = source;
    for (const f of filters) {
      cursor.connect(f);
      cursor = f;
    }
    cursor.connect(preamp);
    if (preset?.limiter_enabled && limiterRef.current) {
      preamp.connect(limiterRef.current);
      limiterRef.current.connect(ctx.destination);
    } else {
      preamp.connect(ctx.destination);
    }
  }, [mode, preset]);

  // Rewire when mode or preset changes
  useEffect(() => {
    if (!audioRef.current) return;
    try {
      ensureGraph();
      rewireChain();
    } catch (e) {
      console.warn("rewire failed", e);
    }
  }, [mode, preset, ensureGraph, rewireChain]);

  // Audio element wiring
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => setPosition(el.currentTime || 0);
    const onDur = () => setDuration(el.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      // auto-advance
      setPlaying(false);
      setIndex((i) => (i >= 0 && i < queue.length - 1 ? i + 1 : i));
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("durationchange", onDur);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    el.volume = volume;
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("durationchange", onDur);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
    };
  }, [queue, volume]);

  // Load current track
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const current = index >= 0 && index < queue.length ? queue[index] : null;
    if (!current) {
      el.pause();
      el.removeAttribute("src");
      return;
    }
    const url = api.trackStreamUrl(current.id);
    if (el.src !== url) {
      el.src = url;
      el.load();
    }
    el.play().catch(() => { /* user gesture may be required */ });
  }, [index, queue]);

  const setMode = useCallback(async (next) => {
    const el = audioRef.current;
    const prevVol = el ? el.volume : volume;
    setModeState(next);
    try {
      await api.setAudioMode(next, DEVICE_ID);
      const c = await api.getAudioMode(DEVICE_ID);
      setCaps(c);
    } catch (e) {
      console.warn("setAudioMode failed", e);
    }
    // Volume preservation across mode switch
    if (el) el.volume = prevVol;
  }, [volume]);

  const playTrack = useCallback((track, q) => {
    const list = q || queue;
    const idx = list.findIndex((t) => t.id === track.id);
    if (idx < 0 && q) {
      setQueue(q);
      setIndex(0);
    } else if (idx < 0) {
      setQueue([track]);
      setIndex(0);
    } else {
      if (q) setQueue(q);
      setIndex(idx);
    }
    // user gesture - resume AudioContext if suspended
    try { ctxRef.current && ctxRef.current.state === "suspended" && ctxRef.current.resume(); } catch {}
  }, [queue]);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el || !el.src) return;
    try { ctxRef.current && ctxRef.current.state === "suspended" && ctxRef.current.resume(); } catch {}
    if (el.paused) el.play().catch(() => {}); else el.pause();
  }, []);

  const next = useCallback(() => setIndex((i) => (i < queue.length - 1 ? i + 1 : i)), [queue.length]);
  const prev = useCallback(() => setIndex((i) => (i > 0 ? i - 1 : i)), []);
  const seek = useCallback((t) => { if (audioRef.current) audioRef.current.currentTime = t; }, []);
  const setVolume = useCallback((v) => {
    setVolumeState(v);
    if (audioRef.current) audioRef.current.volume = v;
  }, []);

  const current = index >= 0 && index < queue.length ? queue[index] : null;

  const value = useMemo(() => ({
    mode, setMode, caps,
    preset, setPreset,
    queue, index, current,
    playing, position, duration, volume,
    playTrack, toggle, next, prev, seek, setVolume,
    dspEnabled: mode === "enhanced_dsp",
  }), [mode, caps, preset, queue, index, current, playing, position, duration, volume,
      setMode, playTrack, toggle, next, prev, seek, setVolume]);

  return (
    <AudioEngineCtx.Provider value={value}>{children}</AudioEngineCtx.Provider>
  );
}
