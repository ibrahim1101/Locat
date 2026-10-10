import { readdir, stat, realpath } from "node:fs/promises";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { probeVideo } from "./mediaProbe";
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
  probe: authedQuery.input(z.object({ libraryId: z.number().int().nonnegative(), id: z.string().min(1).max(2048) })).query(async ({ input }) => {
    const roots = configuredRoots();
    const configured = roots[input.libraryId];
    if (!configured || !/^[A-Za-z0-9_-]+$/.test(input.id)) throw new TRPCError({ code: "NOT_FOUND" });
    const relative = Buffer.from(input.id, "base64url").toString("utf8");
    if (!relative || path.isAbsolute(relative) || relative.split(path.sep).some(segment => !segment || segment === "." || segment === "..")) throw new TRPCError({ code: "BAD_REQUEST" });
    const root = await realpath(configured).catch(() => "");
    const file = root ? await realpath(path.resolve(root, relative)).catch(() => "") : "";
    if (!root || !file.startsWith(root + path.sep) || ![".mp4", ".m4v", ".mov", ".mkv", ".webm", ".avi"].includes(path.extname(file).toLowerCase())) throw new TRPCError({ code: "NOT_FOUND" });
    const metadata = await stat(file).catch(() => null);
    if (!metadata?.isFile()) throw new TRPCError({ code: "NOT_FOUND" });
    try { return await probeVideo(file); } catch { throw new TRPCError({ code: "PRECONDITION_FAILED", message: "FFprobe is unavailable or could not inspect this file" }); }
  }),
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
