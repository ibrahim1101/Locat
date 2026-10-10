import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { createRouter, authedQuery } from "./middleware";

const VIDEO_EXTENSIONS = new Set([".mp4", ".m4v", ".mov", ".mkv", ".webm", ".avi"]);
const AUDIO_EXTENSIONS = new Set([".mp3", ".m4a", ".aac", ".flac", ".wav", ".ogg", ".opus"]);
const MAX_FILES = 3000;
const MAX_DEPTH = 6;

function configuredRoots() {
  // Host administrator explicitly opts in to sharing these folders.
  // Never accept arbitrary paths from clients.
  const raw = process.env.LOCAT_MEDIA_AUTHORIZED_ROOTS || "";
  return raw.split(path.delimiter).map(value => value.trim()).filter(Boolean).map(value => path.resolve(value));
}

export type IndexedMediaItem = {
  id: string;
  name: string;
  kind: "cinema" | "music";
  sizeBytes: number;
  relativePath: string;
  library: string;
  libraryId: number;
};

async function scanRoot(root: string, kind: "cinema" | "music"): Promise<IndexedMediaItem[]> {
  const items: IndexedMediaItem[] = [];
  const visited = new Set<string>();
  async function walk(directory: string, depth: number): Promise<void> {
    if (depth > MAX_DEPTH || items.length >= MAX_FILES) return;
    const { realpath } = await import("node:fs/promises");
    const actual = await realpath(directory).catch(() => "");
    if (!actual || visited.has(actual) || (actual !== root && !actual.startsWith(root + path.sep))) return;
    visited.add(actual);
    const entries = await readdir(actual, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (items.length >= MAX_FILES) break;
      if (entry.isSymbolicLink()) continue;
      const full = path.join(actual, entry.name);
      if (entry.isDirectory()) {
        await walk(full, depth + 1);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!(kind === "cinema" ? VIDEO_EXTENSIONS : AUDIO_EXTENSIONS).has(ext)) continue;
        const metadata = await stat(full).catch(() => null);
        if (!metadata?.isFile()) continue;
        const relativePath = path.relative(root, full);
        items.push({ id: Buffer.from(relativePath).toString("base64url"), name: entry.name,
          kind, sizeBytes: metadata.size, relativePath, library: path.basename(root), libraryId: -1 });
      }
    }
  }
  await walk(root, 0);
  return items;
}

export const mediaRouter = createRouter({
  libraries: authedQuery.query(async () => {
    const roots = configuredRoots();
    return roots.map((root, index) => ({ id: index, name: path.basename(root) }));
  }),
  items: authedQuery.query(async () => {
    const roots = configuredRoots();
    const output: IndexedMediaItem[] = [];
    for (const root of roots) {
      const { realpath } = await import("node:fs/promises");
      const actual = await realpath(root).catch(() => "");
      if (!actual) continue;
      for (const kind of ["cinema", "music"] as const) {
        const items = await scanRoot(actual, kind);
        output.push(...items.map(item => ({ ...item, libraryId: roots.indexOf(root) })));
      }
    }
    return output;
  }),
});
