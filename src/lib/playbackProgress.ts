export const PLAYBACK_PROGRESS_KEY = "locat-local-video-progress-v1";
export const MAX_PLAYBACK_ENTRIES = 200;
export type PlaybackCheckpoint = { id: string; position: number; duration: number; updatedAt: number };
export function parsePlaybackProgress(raw: string | null): PlaybackCheckpoint[] {
  try {
    if (!raw || raw.length > 100_000) return [];
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const valid = value.filter((entry): entry is PlaybackCheckpoint => !!entry && typeof entry === "object" && /^[a-f0-9]{64}$/.test(entry.id) && Number.isFinite(entry.position) && entry.position >= 0 && Number.isFinite(entry.duration) && entry.duration > 0 && entry.duration <= 864000 && entry.position <= entry.duration && Number.isSafeInteger(entry.updatedAt) && entry.updatedAt >= 0);
    return [...new Map(valid.sort((a, b) => a.updatedAt - b.updatedAt).map(entry => [entry.id, entry])).values()].slice(-MAX_PLAYBACK_ENTRIES);
  } catch { return []; }
}
export function resumePosition(checkpoint: PlaybackCheckpoint | undefined, duration: number): number {
  if (!checkpoint || !Number.isFinite(duration) || duration <= 0 || Math.abs(checkpoint.duration - duration) > Math.max(1, duration * .01)) return 0;
  return checkpoint.position >= duration - Math.min(10, duration * .05) ? 0 : Math.max(0, Math.min(checkpoint.position, duration));
}
export function updatePlaybackProgress(rows: PlaybackCheckpoint[], id: string, position: number, duration: number, now = Date.now()): PlaybackCheckpoint[] {
  if (!/^[a-f0-9]{64}$/.test(id) || !Number.isFinite(position) || position < 0 || !Number.isFinite(duration) || duration <= 0 || duration > 864000) return rows;
  const rest = rows.filter(row => row.id !== id);
  if (position < .1 || position >= duration - Math.min(10, duration * .05)) return rest;
  return parsePlaybackProgress(JSON.stringify([...rest, { id, position, duration, updatedAt: now }]));
}
/** Metadata matching only, not a content identity or security proof. No raw filename is persisted. */
export async function playbackFileId(file: Pick<File, "name" | "size" | "lastModified">): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([file.name, file.size, file.lastModified])));
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
