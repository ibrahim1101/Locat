import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { createContext } from "./context";
import { parseMediaRange } from "./mediaRange";
import { probeVideo } from "./mediaProbe";
import { createRemuxStream, RemuxBusyError } from "./mediaRemux";

const MIME: Record<string, string> = {
  ".mp4": "video/mp4", ".m4v": "video/mp4", ".mov": "video/quicktime",
  ".webm": "video/webm", ".mkv": "video/x-matroska", ".avi": "video/x-msvideo",
  ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".aac": "audio/aac",
  ".flac": "audio/flac", ".wav": "audio/wav", ".ogg": "audio/ogg", ".opus": "audio/ogg",
};

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
  if (params.get("mode") === "remux") {
    if (req.method !== "GET" || req.headers.has("range")) return new Response("Remux does not support seeking", { status: 400 });
    if (![".mkv", ".avi", ".mov", ".mp4", ".m4v", ".webm"].includes(ext)) return new Response("Unsupported media", { status: 415 });
    let probe;
    try { probe = await probeVideo(file); }
    catch { return new Response("FFprobe unavailable", { status: 503 }); }
    if (probe.strategy !== "remux") return new Response("Stream copy unavailable for this codec combination", { status: 415 });
    let stream: ReadableStream<Uint8Array>;
    try { stream = createRemuxStream(file, req.signal); }
    catch (error) {
      if (error instanceof RemuxBusyError) return new Response("Too many active remux streams", { status: 503, headers: { "Retry-After": "10" } });
      return new Response("Unable to start remux", { status: 503 });
    }
    return new Response(stream, { status: 200, headers: {
      "Content-Type": "video/mp4",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    } });
  }
  const size = metadata.size;
  const range = parseMediaRange(req.headers.get("range"), size);
  if (range.status === 416) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}`, "Accept-Ranges": "bytes" } });
  const { start, end } = range;
  const partial = range.status === 206;
  if (size === 0) return new Response(null, { status: 200, headers: { "Content-Length": "0", "Accept-Ranges": "bytes" } });
  const headers = new Headers({ "Content-Type": MIME[ext], "Content-Length": String(end - start + 1),
    "Accept-Ranges": "bytes", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
  if (partial) headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  if (req.method === "HEAD") return new Response(null, { status: partial ? 206 : 200, headers });
  const stream = createReadStream(file, { start, end });
  req.signal.addEventListener("abort", () => stream.destroy(), { once: true });
  return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, { status: partial ? 206 : 200, headers });
}
