import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { createContext } from "./context";

const MIME: Record<string, string> = {
  ".mp4": "video/mp4", ".m4v": "video/mp4", ".mov": "video/quicktime",
  ".webm": "video/webm", ".mkv": "video/x-matroska", ".avi": "video/x-msvideo",
  ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".aac": "audio/aac",
  ".flac": "audio/flac", ".wav": "audio/wav", ".ogg": "audio/ogg", ".opus": "audio/ogg",
};
const MAX_RANGE = 8 * 1024 * 1024;

export async function handleMediaStream(req: Request): Promise<Response> {
  if (req.method !== "GET" && req.method !== "HEAD") return new Response(null, { status: 405 });
  const ctx = await createContext({ req, resHeaders: new Headers(), info: { isBatchCall: false, calls: [], accept: null, type: "query", connectionParams: null, signal: req.signal, url: new URL(req.url) } } as Parameters<typeof createContext>[0]);
  if (!ctx.user) return new Response("Unauthorized", { status: 401 });
  const params = new URL(req.url).searchParams;
  const rootIndex = Number(params.get("library"));
  const id = params.get("id") || "";
  if (!Number.isSafeInteger(rootIndex) || rootIndex < 0 || !/^[A-Za-z0-9_-]{1,2048}$/.test(id)) return new Response("Bad media identifier", { status: 400 });
  const roots = (process.env.LOCAT_MEDIA_AUTHORIZED_ROOTS || "").split(path.delimiter).map(p => p.trim()).filter(Boolean);
  if (rootIndex >= roots.length) return new Response("Not found", { status: 404 });
  const relative = Buffer.from(id, "base64url").toString("utf8");
  if (!relative || path.isAbsolute(relative) || relative.split(/[\\/]/).some(part => part === ".." || part === "." || !part)) return new Response("Invalid path", { status: 400 });
  const root = await realpath(path.resolve(roots[rootIndex])).catch(() => "");
  if (!root) return new Response("Not found", { status: 404 });
  const file = await realpath(path.resolve(root, relative)).catch(() => "");
  if (!file || !file.startsWith(root + path.sep)) return new Response("Not found", { status: 404 });
  const ext = path.extname(file).toLowerCase();
  if (!MIME[ext]) return new Response("Unsupported media", { status: 415 });
  const metadata = await stat(file).catch(() => null);
  if (!metadata?.isFile()) return new Response("Not found", { status: 404 });
  const size = metadata.size;
  const range = req.headers.get("range");
  let start = 0;
  let end = size - 1;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    if (!match[1]) {
      const suffix = Number(match[2]);
      if (!Number.isSafeInteger(suffix) || suffix < 1) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      start = Math.max(0, size - suffix);
    } else {
      start = Number(match[1]);
      if (match[2]) end = Number(match[2]);
    }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  if (size === 0) return new Response(null, { status: range ? 416 : 200, headers: { "Content-Length": "0", "Accept-Ranges": "bytes" } });
  end = Math.min(end, start + MAX_RANGE - 1, size - 1);
  const partial = Boolean(range) || end < size - 1;
  const headers = new Headers({ "Content-Type": MIME[ext], "Content-Length": String(end - start + 1),
    "Accept-Ranges": "bytes", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
  if (partial) headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  if (req.method === "HEAD") return new Response(null, { status: partial ? 206 : 200, headers });
  const stream = createReadStream(file, { start, end });
  req.signal.addEventListener("abort", () => stream.destroy(), { once: true });
  return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, { status: partial ? 206 : 200, headers });
}
