import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, realpath, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createContext } from "./context";
import { probeVideo } from "./mediaProbe";

/**
 * Experimental authenticated HLS transport. Each session is scoped to an
 * authorized media file and the authenticated user. No arbitrary paths are
 * accepted from requests. Output stays in a private temporary directory.
 */
const MAX_SESSIONS = 2;
const IDLE_MS = 10 * 60_000;
const MAX_RUNTIME_MS = 4 * 60 * 60_000;
type Session = {
  dir: string; child: ChildProcess; touched: number;
  failed: boolean; done: boolean; started: number;
};
const sessions = new Map<string, Session>();

async function clearSession(key: string, session: Session) {
  if (sessions.get(key) !== session) return;
  sessions.delete(key);
  if (!session.done) session.child.kill();
  await rm(session.dir, { recursive: true, force: true }).catch(() => {});
}

async function resolveAuthorizedFile(library: string | null, id: string | null) {
  const index = Number(library);
  if (!Number.isSafeInteger(index) || index < 0 || !id || !/^[A-Za-z0-9_-]{1,2048}$/.test(id)) return null;
  const roots = (process.env.LOCAT_MEDIA_AUTHORIZED_ROOTS || "").split(path.delimiter).map(x => x.trim()).filter(Boolean);
  if (index >= roots.length) return null;
  const relative = Buffer.from(id, "base64url").toString("utf8");
  if (!relative || path.isAbsolute(relative) || relative.split(/[\\/]/).some(x => !x || x === "." || x === "..")) return null;
  const root = await realpath(path.resolve(roots[index])).catch(() => "");
  const file = root ? await realpath(path.resolve(root, relative)).catch(() => "") : "";
  if (!file || !file.startsWith(root + path.sep) || ![".mkv", ".mp4", ".mov", ".avi", ".webm", ".m4v"].includes(path.extname(file).toLowerCase())) return null;
  if (!(await stat(file).catch(() => null))?.isFile()) return null;
  return file;
}

function evictIdle() {
  const now = Date.now();
  for (const [key, session] of sessions) {
    if (now - session.touched > IDLE_MS || now - session.started > MAX_RUNTIME_MS) void clearSession(key, session);
  }
}

// Cleanup continues even when clients disconnect and make no more requests.
const cleanupTimer = setInterval(evictIdle, 60_000);
cleanupTimer.unref();

async function getSession(key: string, file: string) {
  evictIdle();
  const existing = sessions.get(key);
  if (existing) { existing.touched = Date.now(); return existing; }
  if (sessions.size >= MAX_SESSIONS) return null;
  const dir = await mkdtemp(path.join(os.tmpdir(), "locat-hls-"));
  const nvenc = process.env.LOCAT_TRANSCODE_ENCODER === "h264_nvenc";
  const child = spawn(process.env.LOCAT_FFMPEG_PATH || "ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-nostdin", "-i", file,
    "-map", "0:v:0", "-map", "0:a:0?",
    "-c:v", nvenc ? "h264_nvenc" : "libx264",
    "-preset", nvenc ? "p4" : "veryfast", "-pix_fmt", "yuv420p",
    "-vf", "scale=w=1920:h=1080:force_original_aspect_ratio=decrease",
    "-g", "120", "-keyint_min", "120", "-sc_threshold", "0",
    "-c:a", "aac", "-b:a", "160k",
    "-sn", "-dn", "-f", "hls", "-hls_time", "4",
    "-hls_list_size", "0", "-hls_playlist_type", "event",
    "-hls_flags", "independent_segments+temp_file",
    "-hls_segment_filename", path.join(dir, "segment-%06d.ts"),
    path.join(dir, "index.m3u8"),
  ], { shell: false, windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
  const session: Session = { dir, child, touched: Date.now(), failed: false, done: false, started: Date.now() };
  sessions.set(key, session);
  let errorTail = "";
  child.stderr?.on("data", (chunk: Buffer) => { errorTail = (errorTail + chunk.toString()).slice(-2048); });
  child.on("error", () => { session.failed = true; session.done = true; });
  child.on("close", code => {
    session.done = true;
    if (code !== 0) {
      session.failed = true;
      console.error("Locat HLS FFmpeg failed:", errorTail || "unknown FFmpeg error");
    }
  });
  return session;
}

export async function handleMediaHls(req: Request): Promise<Response> {
  if (req.method !== "GET") return new Response(null, { status: 405 });
  const ctx = await createContext({ req, resHeaders: new Headers(), info: { isBatchCall: false, calls: [], accept: null, type: "query", connectionParams: null, signal: req.signal, url: new URL(req.url) } } as Parameters<typeof createContext>[0]);
  if (!ctx.user) return new Response("Unauthorized", { status: 401 });
  const params = new URL(req.url).searchParams;
  const file = await resolveAuthorizedFile(params.get("library"), params.get("id"));
  if (!file) return new Response("Not found", { status: 404 });
  const probe = await probeVideo(file).catch(() => null);
  if (!probe || probe.strategy !== "transcode") return new Response("Transcoding not required or probe unavailable", { status: 415 });
  const asset = params.get("asset") || "index.m3u8";
  if (asset !== "index.m3u8" && !/^segment-\d{6}\.ts$/.test(asset)) return new Response("Invalid segment", { status: 400 });
  const userId = String(ctx.user.id);
  const key = createHash("sha256").update(userId + "\0" + file).digest("hex");
  const session = await getSession(key, file);
  if (!session) return new Response("HLS capacity reached", { status: 503, headers: { "Retry-After": "10" } });
  const filename = path.join(session.dir, asset);
  let data: Buffer | null = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    data = await readFile(filename).catch(() => null);
    // A playlist with no completed segment is not yet playable.
    if (data && asset === "index.m3u8" && !/^segment-\d{6}\.ts$/m.test(data.toString("utf8"))) data = null;
    if (data) break;
    if (session.failed) return new Response("FFmpeg HLS transcoding failed", { status: 503 });
    if (session.done) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!data) return new Response("Segment not ready", { status: 404 });
  if (asset === "index.m3u8") {
    // Relative playlist URLs inherit library and id only if supplied explicitly.
    // Rewrite each segment reference to a same-origin authenticated endpoint.
    const base = new URL(req.url);
    base.searchParams.delete("asset");
    const manifest = data.toString("utf8").replace(/^segment-\d{6}\.ts$/gm, segment => {
      const url = new URL(base);
      url.searchParams.set("asset", segment);
      return url.pathname + url.search;
    });
    return new Response(manifest, { headers: { "Content-Type": "application/vnd.apple.mpegurl", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  }
  return new Response(new Uint8Array(data), { headers: { "Content-Type": "video/mp2t", "Cache-Control": "private, max-age=60", "X-Content-Type-Options": "nosniff" } });
}
