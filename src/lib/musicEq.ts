export const FILTER_TYPES = ["peaking", "lowshelf", "highshelf", "highpass", "lowpass"] as const;
export type EqPoint = { type: typeof FILTER_TYPES[number]; frequency: number; gain: number; q: number };
export const MAX_EQ_POINTS = 24;
const bounded = (value: unknown, min: number, max: number, fallback: number) => typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
export function sanitizePoints(value: unknown): EqPoint[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_EQ_POINTS).map(raw => {
    const point = raw && typeof raw === "object" ? raw : {};
    return { type: FILTER_TYPES.includes(point.type) ? point.type : "peaking", frequency: bounded(point.frequency, 20, 20000, 1000), gain: bounded(point.gain, -12, 12, 0), q: bounded(point.q, 0.1, 20, 1) };
  });
}
/** Sum positive boosts: conservative headroom even for overlapping peaks/shelves. */
export function boostHeadroom(gains: number[]): number { return gains.reduce((total, gain) => total + Math.max(0, gain), 0); }
/** Resonance of a second-order pass filter above Butterworth Q. */
export function filterHeadroom(point: EqPoint): number {
  if (point.type !== "highpass" && point.type !== "lowpass") return Math.max(0, point.gain);
  if (point.q <= Math.SQRT1_2) return 0;
  return Math.max(0, 20 * Math.log10(point.q / Math.sqrt(1 - 1 / (4 * point.q * point.q))));
}
export function parametricPreset(name: string): EqPoint[] {
  if (name === "Warm") return [{ type: "lowshelf", frequency: 150, gain: 3, q: 0.7 }, { type: "highshelf", frequency: 5000, gain: -2, q: 0.7 }];
  if (name === "Bass Boost") return [{ type: "lowshelf", frequency: 100, gain: 5, q: 0.7 }];
  if (name === "Clarity" || name === "Vocal") return [{ type: "lowshelf", frequency: 150, gain: -2, q: 0.7 }, { type: "peaking", frequency: name === "Vocal" ? 1500 : 3000, gain: 3, q: 1 }];
  return [];
}
export function connectEqGraph(source: MediaElementAudioSourceNode, context: AudioContext, filters: BiquadFilterNode[], preamp: GainNode, points: EqPoint[], preampDb: number, bypass: boolean): void {
  source.disconnect(); filters.forEach(filter => filter.disconnect()); preamp.disconnect();
  if (bypass) { source.connect(context.destination); return; }
  const boost = points.reduce((total, point) => total + filterHeadroom(point), 0);
  preamp.gain.setTargetAtTime(Math.pow(10, (preampDb - boost) / 20), context.currentTime, 0.02);
  source.connect(preamp);
  let tail: AudioNode = preamp;
  points.forEach((point, index) => {
    const filter = filters[index]; filter.type = point.type;
    filter.frequency.setValueAtTime(Math.min(point.frequency, context.sampleRate / 2 - 1), context.currentTime);
    filter.Q.setValueAtTime(point.q, context.currentTime);
    filter.gain.setTargetAtTime(point.gain, context.currentTime, 0.02);
    tail.connect(filter); tail = filter;
  });
  tail.connect(context.destination);
}
