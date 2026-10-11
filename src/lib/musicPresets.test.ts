import { expect, it } from "vitest";
import { cleanPreset, parseMusicPresets, upsertMusicPreset } from "./musicPresets";
const preset = { name: "Night", bands: 5 as const, gains: [0, 1, 2, 3, 4], preamp: -3, kind: "parametric" as const, points: [{ type: "lowshelf" as const, frequency: 100, gain: 3, q: 0.7 }] };
it("round trips both EQ modes with bounded storage restoration", () => {
  expect(parseMusicPresets(JSON.stringify([preset]))).toEqual([preset]);
  expect(cleanPreset({ ...preset, gains: [100, -100, null, Infinity, 1], preamp: 10 })?.gains).toEqual([12, -12, 0, 0, 1]);
  expect(cleanPreset({ ...preset, name: " " })).toBeNull();
  expect(cleanPreset({ ...preset, gains: [] })).toBeNull();
  expect(parseMusicPresets("broken")).toEqual([]);
  expect(parseMusicPresets(JSON.stringify([preset, { ...preset, name: "night" }]))).toHaveLength(1);
});
it("saves updates and renames without collisions or overflowing bounds", () => {
  const saved = upsertMusicPreset([], preset);
  const renamed = upsertMusicPreset(saved, { ...preset, name: "Warm" }, "Night");
  expect(renamed.map(item => item.name)).toEqual(["Warm"]);
  expect(upsertMusicPreset(renamed, { ...preset, name: "Warm", preamp: -6 })[0].preamp).toBe(-6);
  expect(() => upsertMusicPreset([preset, { ...preset, name: "Warm" }], { ...preset, name: "Warm" }, "Night")).toThrow("already exists");
  const full = Array.from({ length: 30 }, (_, i) => ({ ...preset, name: String(i) }));
  expect(() => upsertMusicPreset(full, preset)).toThrow("30 presets");
  expect(parseMusicPresets(JSON.stringify([...full, preset]))).toHaveLength(30);
});
