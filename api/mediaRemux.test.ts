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

  it("surfaces a missing FFmpeg binary as a stream error", async () => {
    process.env.LOCAT_FFMPEG_PATH = "__locat_missing_ffmpeg_executable_987654__";
    const stream = createRemuxStream("not-a-file.mkv", new AbortController().signal);
    const reader = stream.getReader();
    await expect(reader.read()).rejects.toThrow();
  });
});
