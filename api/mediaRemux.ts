import { spawn } from "node:child_process";
import { Readable } from "node:stream";

const MAX_RUNTIME_MS = 4 * 60 * 60 * 1000;
const MAX_CONCURRENT_REMUXES = 2;
let activeRemuxes = 0;

export class RemuxBusyError extends Error { constructor() { super("Remux capacity reached"); } }

/** A bounded, cancelable FFmpeg stream-copy session. Never executes through a shell. */
export function createRemuxStream(file: string, signal: AbortSignal): ReadableStream<Uint8Array> {
  if (activeRemuxes >= MAX_CONCURRENT_REMUXES) throw new RemuxBusyError();
  if (signal.aborted) throw new Error("Request canceled");
  activeRemuxes++;
  let child: ReturnType<typeof spawn>;
  try {
    child = spawn(process.env.LOCAT_FFMPEG_PATH || "ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-nostdin",
      "-i", file, "-map", "0:v:0", "-map", "0:a:0?",
      "-c", "copy", "-sn", "-dn",
      "-movflags", "frag_keyframe+empty_moov+default_base_moof",
      "-f", "mp4", "pipe:1",
    ], { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    activeRemuxes--;
    throw error;
  }

  const stdout = child.stdout;
  const stderr = child.stderr;
  let finished = false;
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  const abort = () => child.kill();
  const timeout = setTimeout(abort, MAX_RUNTIME_MS);
  const cleanup = () => {
    if (finished) return;
    finished = true;
    clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
    activeRemuxes--;
  };
  signal.addEventListener("abort", abort, { once: true });
  stderr.resume();
  const source = Readable.toWeb(stdout) as ReadableStream<Uint8Array>;
  const reader = source.getReader();

  // Ensure process failure cannot turn into a silent, successful partial response.
  child.on("error", error => {
    if (!finished) {
      cleanup();
      controller?.error(error);
      void reader.cancel().catch(() => undefined);
    }
  });
  child.on("close", code => {
    cleanup();
    if (code !== 0 && code !== null) controller?.error(new Error("FFmpeg remux failed"));
  });

  return new ReadableStream<Uint8Array>({
    async pull(current) {
      controller = current;
      try {
        const { value, done } = await reader.read();
        if (done) {
          current.close();
        } else {
          current.enqueue(value);
        }
      } catch (error) {
        current.error(error);
        abort();
      }
    },
    async cancel() {
      abort();
      await reader.cancel().catch(() => undefined);
    },
  });
}
