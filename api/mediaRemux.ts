import { spawn } from "node:child_process";
import { PassThrough, Readable } from "node:stream";

const MAX_RUNTIME_MS = 4 * 60 * 60 * 1000;
const MAX_CONCURRENT_REMUXES = 2;
let activeRemuxes = 0;

export class RemuxBusyError extends Error { constructor() { super("Remux capacity reached"); } }

/** A bounded, cancelable FFmpeg stream-copy session. Never executes through a shell. */
export function createRemuxStream(file: string, signal: AbortSignal, transcode = false): ReadableStream<Uint8Array> {
  if (activeRemuxes >= MAX_CONCURRENT_REMUXES) throw new RemuxBusyError();
  if (signal.aborted) throw new Error("Request canceled");
  activeRemuxes++;
  let child: ReturnType<typeof spawn>;
  try {
    child = spawn(process.env.LOCAT_FFMPEG_PATH || "ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-nostdin",
      "-i", file, "-map", "0:v:0", "-map", "0:a:0?",
      ...(transcode ? ["-c:v", process.env.LOCAT_TRANSCODE_ENCODER === "h264_nvenc" ? "h264_nvenc" : "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-vf", "scale=w=1920:h=1080:force_original_aspect_ratio=decrease", "-c:a", "aac", "-b:a", "160k"] : ["-c", "copy"]), "-sn", "-dn",
      "-movflags", "frag_keyframe+empty_moov+default_base_moof",
      "-f", "mp4", "pipe:1",
    ], { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    activeRemuxes--;
    throw error;
  }

  const stdout = child.stdout;
  const stderr = child.stderr;
  if (!stdout || !stderr) {
    child.kill();
    activeRemuxes--;
    throw new Error("FFmpeg stdout/stderr pipes are unavailable");
  }
  const output = new PassThrough();
  let finished = false;
  let canceled = false;
  const abort = () => {
    canceled = true;
    child.kill();
    output.destroy();
  };
  const timeout = setTimeout(() => {
    child.kill();
    output.destroy(new Error("FFmpeg remux timed out"));
  }, MAX_RUNTIME_MS);
  const cleanup = () => {
    if (finished) return;
    finished = true;
    clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
    activeRemuxes--;
  };
  signal.addEventListener("abort", abort, { once: true });
  stderr.resume();
  stdout.pipe(output, { end: false });
  child.on("error", error => {
    output.destroy(error);
    cleanup();
  });
  child.on("close", (code, childSignal) => {
    cleanup();
    if (canceled) {
      output.destroy();
    } else if (code !== 0 || childSignal) {
      output.destroy(new Error("FFmpeg remux failed"));
    } else {
      output.end();
    }
  });
  const reader = (Readable.toWeb(output) as ReadableStream<Uint8Array>).getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await reader.read();
        if (done) controller.close();
        else controller.enqueue(value);
      } catch (error) {
        controller.error(error);
        child.kill();
      }
    },
    async cancel() {
      abort();
      await reader.cancel().catch(() => undefined);
    },
  });
}
