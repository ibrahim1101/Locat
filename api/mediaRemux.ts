import { spawn } from "node:child_process";
import { Readable } from "node:stream";

const MAX_RUNTIME_MS = 4 * 60 * 60 * 1000;

/** Stream-copy to fragmented MP4. No shell and no filesystem output. */
export function createRemuxStream(file: string, signal: AbortSignal): ReadableStream<Uint8Array> {
  const binary = process.env.LOCAT_FFMPEG_PATH || "ffmpeg";
  const child = spawn(binary, [
    "-hide_banner", "-loglevel", "error", "-nostdin",
    "-i", file, "-map", "0:v:0", "-map", "0:a:0?",
    "-c", "copy", "-sn", "-dn",
    "-movflags", "frag_keyframe+empty_moov+default_base_moof",
    "-f", "mp4", "pipe:1",
  ], { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  const timer = setTimeout(() => child.kill(), MAX_RUNTIME_MS);
  let errorOutput = "";
  child.stderr.on("data", (part: Buffer) => { if (errorOutput.length < 2048) errorOutput += String(part).slice(0, 2048); });
  const destroy = () => child.kill();
  if (signal.aborted) destroy();
  signal.addEventListener("abort", destroy, { once: true });
  child.once("close", () => { clearTimeout(timer); signal.removeEventListener("abort", destroy); });
  // A subprocess is deliberately tied to consumer cancellation.
  return Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>;
}
