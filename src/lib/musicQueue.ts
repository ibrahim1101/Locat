export type RepeatMode = "off" | "one" | "all";
export function nextMusicIndex(current: number, length: number, repeat: RepeatMode, shuffle: boolean, random = Math.random): number | null {
  if (length < 1) return null;
  if (repeat === "one") return current;
  if (shuffle && length > 1) {
    const offset = 1 + Math.min(length - 2, Math.max(0, Math.floor(random() * (length - 1))));
    return (current + offset) % length;
  }
  return current + 1 < length ? current + 1 : repeat === "all" ? 0 : null;
}
export function localTrackKey(file: Pick<File, "name" | "size" | "lastModified">): string { return `${file.name}:${file.size}:${file.lastModified}`; }
export function parseMusicFavorites(raw: string | null): string[] {
  try { const value: unknown = JSON.parse(raw ?? "null"); return Array.isArray(value) ? [...new Set(value.filter((key): key is string => typeof key === "string" && key.length <= 512))].slice(0, 1000) : []; } catch { return []; }
}
