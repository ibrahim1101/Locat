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
const IDLE_MS = 90_000;
const MAX_RUNTIME_MS = 4 * 60 * 60_000;
type Session = {
  dir: string; child: ChildProcess; touched: number;
  failed: boolean; done: boolean; started: number;
};
const sessions = new Map<string, Session>();

async function clearSession(key: string, session: Session) {
  if (sessions.get(key) !== session) return;
  sessions.delete(key);
  if (!session.done) {
    session.child.kill();
    await new Promise<void>(resolve => {
      if (session.child.exitCode !== null || session.child.signalCode !== null) return resolve();
      session.child.once("close", () => resolve());
      setTimeout(resolve, 3000).unref();
    });
  }
  await rm(session.dir, { recursive: true, force: true, maxRetries: 4, retryDelay: 250 }).catch(() => {});
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

async function getSession(key: string, file: string, quality: "1080p" | "4k", start: number) {
  evictIdle();
  const existing = sessions.get(key);
  if (existing) { existing.touched = Date.now(); return existing; }
  // Switching quality can arrive before the old rendition's release completes.
  if (sessions.size >= MAX_SESSIONS) {
    const oldest = [...sessions.entries()].sort((a, b) => a[1].touched - b[1].touched)[0];
    if (oldest) await clearSession(oldest[0], oldest[1]);
  }
  if (sessions.size >= MAX_SESSIONS) return null;
  const dir = await mkdtemp(path.join(os.tmpdir(), "locat-hls-"));
  const nvenc = process.env.LOCAT_TRANSCODE_ENCODER === "h264_nvenc";
  const maxHeight = quality === "4k" ? 2160 : 1080;
  const child = spawn(process.env.LOCAT_FFMPEG_PATH || "ffmpeg", [
    // Throttle file ingestion to near playback speed: prevents runaway GPU/disk use.
    // This is not pause-aware yet; the next stage will make segment production demand-driven.
    "-hide_banner", "-loglevel", "error", "-nostdin",
    "-readrate", "1.25", "-readrate_initial_burst", "8",
    ...(start > 0 ? ["-ss", String(start)] : []), "-i", file,
    "-map", "0:v:0", "-map", "0:a:0?",
    "-c:v", nvenc ? "h264_nvenc" : "libx264",
    "-preset", nvenc ? "p4" : "veryfast", "-pix_fmt", "yuv420p",
    ...(nvenc ? ["-rc", "vbr", "-cq", quality === "4k" ? "23" : "21", "-b:v", quality === "4k" ? "12M" : "5M", "-maxrate", quality === "4k" ? "16M" : "8M", "-bufsize", quality === "4k" ? "32M" : "16M"] : ["-crf", quality === "4k" ? "21" : "20", "-maxrate", quality === "4k" ? "16M" : "8M", "-bufsize", quality === "4k" ? "32M" : "16M"]),
    "-vf", `scale=w=${quality === "4k" ? 3840 : 1920}:h=${maxHeight}:force_original_aspect_ratio=decrease:force_divisible_by=2`,
    // 2-second closed GOP at 60 fps reduces startup and segment latency.
    "-g", "120", "-keyint_min", "120", "-sc_threshold", "0",
    "-profile:v", "high", "-level:v", quality === "4k" ? "5.2" : "4.2",
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
  if (req.method !== "GET" && req.method !== "POST") return new Response(null, { status: 405 });
  const ctx = await createContext({ req, resHeaders: new Headers(), info: { isBatchCall: false, calls: [], accept: null, type: "query", connectionParams: null, signal: req.signal, url: new URL(req.url) } } as Parameters<typeof createContext>[0]);
  if (!ctx.user) return new Response("Unauthorized", { status: 401 });
  const params = new URL(req.url).searchParams;
  const file = await resolveAuthorizedFile(params.get("library"), params.get("id"));
  if (!file) return new Response("Not found", { status: 404 });
  const action = params.get("action");
  if (req.method === "POST" && action !== "release") return new Response("Invalid action", { status: 400 });
  if (req.method === "GET" && action) return new Response("Invalid action", { status: 400 });
  const quality = params.get("quality") === "4k" ? "4k" : "1080p";
  // Start a new rendition near the previous playback position, rather than at 0.
  const requestedStart = Number(params.get("start") || "0");
  if (!Number.isFinite(requestedStart) || requestedStart < 0 || requestedStart > 86400) return new Response("Invalid start time", { status: 400 });
  const start = Math.floor(requestedStart);
  const userId = String(ctx.user.id);
  const key = createHash("sha256").update(userId + "\0" + file + "\0" + quality + "\0" + start).digest("hex");
  if (action === "release") {
    const session = sessions.get(key);
    if (session) await clearSession(key, session);
    return new Response(null, { status: 204 });
  }
  const probe = await probeVideo(file).catch(() => null);
  if (!probe || probe.strategy !== "transcode") return new Response("Transcoding not required or probe unavailable", { status: 415 });
  const asset = params.get("asset") || "index.m3u8";
  if (asset !== "index.m3u8" && !/^segment-\d{6}\.ts$/.test(asset)) return new Response("Invalid segment", { status: 400 });
  const session = await getSession(key, file, quality, start);
  if (!session) return new Response("HLS capacity reached", { status: 503, headers: { "Retry-After": "10" } });
  const filename = path.join(session.dir, asset);
  let data: Buffer | null = null;
  for (let attempt = 0; attempt < 120; attempt++) {
    data = await readFile(filename).catch(() => null);
    // A playlist with no completed segment is not yet playable.
    if (data && asset === "index.m3u8" && !/^segment-\d{6}\.ts$/m.test(data.toString("utf8"))) data = null;
    if (data) break;
    if (session.failed) return new Response("FFmpeg HLS transcoding failed", { status: 503 });
    if (session.done) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!data) return new Response("Segment not ready", { status: 503, headers: { "Retry-After": "2" } });
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
