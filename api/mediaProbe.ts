import { spawn } from "node:child_process";
import path from "node:path";

export type VideoProbe = { container: string; videoCodec: string | null; audioCodec: string | null; durationSeconds: number | null; strategy: "direct" | "remux" | "transcode" | "unsupported"; reason: string };

export function playbackStrategy(container: string, videoCodec: string | null, audioCodec: string | null): Pick<VideoProbe, "strategy" | "reason"> {
  const c = container.toLowerCase().split(",")[0];
  const video = videoCodec?.toLowerCase() ?? null;
  const audio = audioCodec?.toLowerCase() ?? null;
  if (!video) return { strategy: "unsupported", reason: "No video stream detected" };
  const mp4 = ["mov", "mp4", "m4a", "3gp", "3g2", "mj2"].includes(c);
  const webm = c === "matroska" || c === "webm";
  if (mp4 && video === "h264" && (!audio || audio === "aac" || audio === "mp3")) return { strategy: "direct", reason: "Browser-friendly MP4/H.264 stream" };
  if (webm && video === "vp9" && (!audio || audio === "opus" || audio === "vorbis")) return { strategy: "direct", reason: "WebM-compatible video and audio; browser support varies" };
  if (["h264", "hevc", "av1"].includes(video) && (!audio || ["aac", "mp3", "alac"].includes(audio))) {
    return { strategy: "remux", reason: "Compatible elementary streams may be copied into MP4; client codec support must still be checked" };
  }
  return { strategy: "transcode", reason: "At least one elementary stream needs conversion for broad browser playback" };
}

export async function probeVideo(file: string, timeoutMs = 8000): Promise<VideoProbe> {
  const executable = process.env.LOCAT_FFPROBE_PATH || "ffprobe";
  const result = await new Promise<string>((resolve, reject) => {
    const child = spawn(executable, ["-v", "error", "-show_entries", "format=format_name,duration:stream=codec_type,codec_name", "-of", "json", file], { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => { child.kill(); reject(new Error("ffprobe timed out")); }, timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); if (stdout.length > 256_000) child.kill(); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); if (stderr.length > 16_000) child.kill(); });
    child.on("error", error => { clearTimeout(timer); reject(error); });
    child.on("close", code => { clearTimeout(timer); if (code === 0 && stdout.length <= 256_000) resolve(stdout); else reject(new Error("ffprobe failed or output exceeded limits")); });
  });
  const parsed: unknown = JSON.parse(result);
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid ffprobe output");
  const data = parsed as { format?: { format_name?: string; duration?: string }; streams?: Array<{ codec_type?: string; codec_name?: string }> };
  const video = data.streams?.find(s => s.codec_type === "video")?.codec_name ?? null;
  const audio = data.streams?.find(s => s.codec_type === "audio")?.codec_name ?? null;
  const container = data.format?.format_name ?? path.extname(file).slice(1);
  const duration = Number(data.format?.duration);
  return { container, videoCodec: video, audioCodec: audio, durationSeconds: Number.isFinite(duration) && duration >= 0 ? duration : null, ...playbackStrategy(container, video, audio) };
}
