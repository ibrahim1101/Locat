import { detectPlatform } from "./platform";
export type MediaKind = "cinema" | "music" | "photos";
export type DeviceMedia = { id: string; uri: string; name: string; mime: string; size: number; modified: number; folder: string; album?: string; artist?: string; duration: number; file?: File };
export type MediaAccess = "full" | "limited" | "denied";
export type MediaSort = "name" | "newest" | "oldest" | "size" | "duration";
type Plugin = {
  thumbnail(options: { kind: MediaKind; id: string }): Promise<{ data: string }>;
  status(options: { kind: MediaKind }): Promise<{ access: MediaAccess }>;
  authorize(options: { kind: MediaKind }): Promise<{ access: MediaAccess }>;
  list(options: { kind: MediaKind; before?: string }): Promise<{ items: DeviceMedia[]; next: string; access: MediaAccess }>;
};
export function deviceMediaBridge(): { plugin: Plugin; source(uri: string): string } | null {
  if (detectPlatform() !== "capacitor-android") return null;
  const cap = window.Capacitor as unknown as { Plugins?: { LocatMedia?: Plugin }; convertFileSrc?: (uri: string) => string };
  return cap?.Plugins?.LocatMedia && cap.convertFileSrc ? { plugin: cap.Plugins.LocatMedia, source: uri => cap.convertFileSrc!(uri) } : null;
}
const extensions = {
  cinema: /\.(mp4|m4v|webm|mkv|mov|avi|3gp|mpeg|mpg|ts)$/i,
  music: /\.(mp3|m4a|aac|wav|flac|alac|ogg|opus|aiff|wma)$/i,
  photos: /\.(jpg|jpeg|png|webp|gif|bmp|avif|heic|heif)$/i,
};
export function supportsMedia(row: Pick<DeviceMedia, "name" | "mime">, kind: MediaKind): boolean {
  // Indexed type is not a guarantee that the device has a decoder. SVG is never edited.
  return extensions[kind].test(row.name) || (kind !== "photos" && row.mime.startsWith(kind === "cinema" ? "video/" : "audio/"));
}
export function sortMedia(rows: DeviceMedia[], sort: MediaSort): DeviceMedia[] {
  return [...rows].sort((a, b) => {
    const compared = sort === "name" ? a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }) : sort === "newest" ? b.modified - a.modified : sort === "oldest" ? a.modified - b.modified : sort === "size" ? b.size - a.size : b.duration - a.duration;
    return compared || a.name.localeCompare(b.name, undefined, { numeric: true }) || a.id.localeCompare(b.id);
  });
}
export function groupMedia(rows: DeviceMedia[], grouping: "folder" | "album" | "artist"): [string, DeviceMedia[]][] {
  const groups = new Map<string, DeviceMedia[]>();
  for (const row of rows) {
    const key = grouping === "folder" ? row.folder || "Other" : row[grouping]?.trim() && row[grouping] !== "<unknown>" ? row[grouping]! : `Unknown ${grouping}`;
    const group = groups.get(key) ?? []; group.push(row); groups.set(key, group);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
}
export function folderMedia(files: File[], kind: MediaKind): DeviceMedia[] {
  return files.map((file, index) => ({ id: `${index}:${file.webkitRelativePath || file.name}`, uri: "", name: file.name, mime: file.type, size: file.size, modified: file.lastModified, folder: file.webkitRelativePath.split("/").slice(0, -1).join("/") || "Selected files", duration: 0, file })).filter(row => supportsMedia(row, kind));
}
export async function readLibraryPhoto(row: DeviceMedia, source: string, signal: AbortSignal): Promise<File> {
  if (row.size > 20_000_000) throw new Error("Choose a picture smaller than 20 MB.");
  if (row.file) return row.file;
  const response = await fetch(source, { signal });
  if (!response.ok || !response.body) throw new Error("Photo access expired. Refresh the library or permission.");
  const reader = response.body.getReader(); const chunks: Uint8Array<ArrayBuffer>[] = []; let size = 0;
  try {
    for (;;) { const result = await reader.read(); if (result.done) break; size += result.value.length; if (size > 20_000_000) throw new Error("Choose a picture smaller than 20 MB."); chunks.push(new Uint8Array(result.value)); }
  } finally { await reader.cancel(); reader.releaseLock(); }
  return new File(chunks, row.name, { type: row.mime, lastModified: row.modified });
}
