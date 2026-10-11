import { expect, it, vi } from "vitest";
import { boostHeadroom, filterHeadroom, connectEqGraph, parametricPreset, sanitizePoints } from "./musicEq";
it("bounds persisted parametric input and preserves supported filters", () => {
  expect(sanitizePoints([{ type: "highpass", frequency: 99999, gain: Infinity, q: 0 }])).toEqual([{ type: "highpass", frequency: 20000, gain: 0, q: 0.1 }]);
  expect(sanitizePoints(Array(40).fill(null))).toHaveLength(24);
  expect(sanitizePoints({})).toEqual([]);
  expect(boostHeadroom([5, 3, -2])).toBe(8);
  expect(parametricPreset("Bass Boost")[0].type).toBe("lowshelf");
});
it("chains filter parameters, applies stacked-boost headroom and bypasses DSP", () => {
  const parameter = () => ({ setValueAtTime: vi.fn(), setTargetAtTime: vi.fn() });
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });
  const source = node(); const preamp = { ...node(), gain: parameter() };
  const filters = Array.from({ length: 31 }, () => ({ ...node(), type: "", frequency: parameter(), gain: parameter(), Q: parameter() }));
  const context = { currentTime: 2, sampleRate: 32000, destination: {} };
  const points = sanitizePoints([{ type: "peaking", frequency: 1000, gain: 5, q: 2 }, { type: "highshelf", frequency: 20000, gain: 3, q: 0.7 }]);
  const apply = (bypass: boolean) => connectEqGraph(source as unknown as MediaElementAudioSourceNode, context as unknown as AudioContext, filters as unknown as BiquadFilterNode[], preamp as unknown as GainNode, points, -2, bypass);
  apply(false);
  expect(source.connect).toHaveBeenLastCalledWith(preamp);
  expect(preamp.gain.setTargetAtTime).toHaveBeenCalledWith(Math.pow(10, -10 / 20), 2, 0.02);
  expect(filters[0].Q.setValueAtTime).toHaveBeenCalledWith(2, 2);
  expect(filters[1].type).toBe("highshelf");
  expect(filters[1].frequency.setValueAtTime).toHaveBeenCalledWith(15999, 2);
  expect(filters[0].connect).toHaveBeenCalledWith(filters[1]);
  expect(filters[1].connect).toHaveBeenCalledWith(context.destination);
  apply(true);
  expect(source.connect).toHaveBeenLastCalledWith(context.destination);
  expect(filters[0].disconnect).toHaveBeenCalledTimes(2);
});

it("attenuates resonant pass filters as well as overlapping EQ boosts", () => {
  expect(filterHeadroom({ type: "highpass", frequency: 1000, gain: 12, q: Math.SQRT1_2 })).toBe(0);
  expect(filterHeadroom({ type: "lowpass", frequency: 1000, gain: 0, q: 20 })).toBeGreaterThan(26);
  expect(filterHeadroom({ type: "highpass", frequency: 1000, gain: -12, q: 1 })).toBeCloseTo(1.249, 2);
});
it("applies resonant-pass headroom to the actual gain node", () => {
  const parameter = () => ({ setValueAtTime: vi.fn(), setTargetAtTime: vi.fn() });
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });
  const source = node(); const preamp = { ...node(), gain: parameter() };
  const filter = { ...node(), type: "", frequency: parameter(), gain: parameter(), Q: parameter() };
  const context = { currentTime: 0, sampleRate: 48000, destination: {} };
  const point = { type: "highpass" as const, frequency: 1000, gain: 0, q: 20 };
  connectEqGraph(source as unknown as MediaElementAudioSourceNode, context as unknown as AudioContext, [filter] as unknown as BiquadFilterNode[], preamp as unknown as GainNode, [point], 0, false);
  expect(preamp.gain.setTargetAtTime).toHaveBeenCalledWith(Math.pow(10, -filterHeadroom(point) / 20), 0, 0.02);
  expect(filter.type).toBe("highpass");
  expect(filter.Q.setValueAtTime).toHaveBeenCalledWith(20 * Math.log10(20), 0);
});
