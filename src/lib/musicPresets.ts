import { sanitizePoints, type EqPoint } from "./musicEq";
export type SavedMusicPreset = { name: string; bands: 5 | 10 | 15 | 31; gains: number[]; preamp: number; kind: "graphic" | "parametric"; points: EqPoint[] };
export const MUSIC_PRESET_KEY = "locat-music-custom-presets-v1";
export const MAX_MUSIC_PRESETS = 30;
const clamp = (value: unknown, low: number, high: number) => typeof value === "number" && Number.isFinite(value) ? Math.max(low, Math.min(high, value)) : 0;
export function cleanPreset(value: unknown): SavedMusicPreset | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<SavedMusicPreset>;
  if (typeof raw.name !== "string" || !raw.name.trim() || raw.name.trim().length > 60 || ![5, 10, 15, 31].includes(raw.bands as number)) return null;
  if (!Array.isArray(raw.gains) || raw.gains.length !== raw.bands) return null;
  return { name: raw.name.trim(), bands: raw.bands!, gains: raw.gains.map(value => clamp(value, -12, 12)), preamp: clamp(raw.preamp, -18, 0), kind: raw.kind === "parametric" ? "parametric" : "graphic", points: sanitizePoints(raw.points) };
}
export function parseMusicPresets(value: string | null): SavedMusicPreset[] {
  try {
    const raw: unknown = JSON.parse(value ?? "null");
    if (!Array.isArray(raw)) return [];
    const result: SavedMusicPreset[] = [];
    for (const item of raw.slice(0, 100)) {
      const preset = cleanPreset(item);
      if (preset && !result.some(existing => existing.name.toLowerCase() === preset.name.toLowerCase())) result.push(preset);
      if (result.length >= MAX_MUSIC_PRESETS) break;
    }
    return result;
  } catch { return []; }
}
export function upsertMusicPreset(presets: SavedMusicPreset[], value: unknown, replacing?: string): SavedMusicPreset[] {
  const next = cleanPreset(value);
  if (!next) throw new Error("Use a preset name of 1–60 characters and valid EQ settings.");
  const target = replacing ?? next.name;
  const index = presets.findIndex(preset => preset.name.toLowerCase() === target.toLowerCase());
  if (presets.some((preset, i) => i !== index && preset.name.toLowerCase() === next.name.toLowerCase())) throw new Error("That preset name already exists.");
  if (index < 0 && presets.length >= MAX_MUSIC_PRESETS) throw new Error("Delete a preset first; up to 30 presets can be saved.");
  return index < 0 ? [...presets, next] : presets.map((preset, i) => i === index ? next : preset);
}
