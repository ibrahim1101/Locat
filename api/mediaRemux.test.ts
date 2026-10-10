import { afterEach, describe, expect, it } from "vitest";
import { createRemuxStream } from "./mediaRemux";

const originalBinary = process.env.LOCAT_FFMPEG_PATH;
afterEach(() => {
  if (originalBinary === undefined) delete process.env.LOCAT_FFMPEG_PATH;
  else process.env.LOCAT_FFMPEG_PATH = originalBinary;
});

describe("FFmpeg remux lifecycle", () => {
  it("refuses to spawn a process for an already aborted request", () => {
    const controller = new AbortController();
    controller.abort();
    expect(() => createRemuxStream("not-a-file.mkv", controller.signal)).toThrow("Request canceled");
  });

  it("reports a subprocess failure instead of completing a remux stream", async () => {
    // Node accepts FFmpeg arguments as script flags and exits unsuccessfully.
    // This makes the regression independent of whether FFmpeg is installed.
    process.env.LOCAT_FFMPEG_PATH = process.execPath;
    const stream = createRemuxStream("missing-video.mkv", new AbortController().signal);
    await expect(stream.getReader().read()).rejects.toThrow("FFmpeg remux failed");
  });

  it("rejects a third concurrent remux and frees capacity after subprocess exit", async () => {
    process.env.LOCAT_FFMPEG_PATH = process.execPath;
    const one = createRemuxStream("first.mkv", new AbortController().signal);
    const two = createRemuxStream("second.mkv", new AbortController().signal);
    expect(() => createRemuxStream("third.mkv", new AbortController().signal)).toThrow("Remux capacity reached");
    await Promise.all([
      expect(one.getReader().read()).rejects.toThrow(),
      expect(two.getReader().read()).rejects.toThrow(),
    ]);
    const after = createRemuxStream("after.mkv", new AbortController().signal);
    await expect(after.getReader().read()).rejects.toThrow();
  });

  it("surfaces a missing FFmpeg binary as a stream error", async () => {
    process.env.LOCAT_FFMPEG_PATH = "__locat_missing_ffmpeg_executable_987654__";
    const stream = createRemuxStream("not-a-file.mkv", new AbortController().signal);
    const reader = stream.getReader();
    await expect(reader.read()).rejects.toThrow();
  });
});
