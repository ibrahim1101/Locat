import { describe, expect, it } from "vitest";
import { playbackStrategy } from "./mediaProbe";

describe("Cinema playback decision", () => {
  it("direct plays compatible MP4", () => {
    expect(playbackStrategy("mov,mp4,m4a,3gp,3g2,mj2", "h264", "aac").strategy).toBe("direct");
  });
  it("recommends remux when streams can be copied into MP4", () => {
    expect(playbackStrategy("matroska,webm", "h264", "aac").strategy).toBe("remux");
  });
  it("recommends transcoding for unsupported streams", () => {
    expect(playbackStrategy("matroska,webm", "mpeg2video", "ac3").strategy).toBe("transcode");
  });
  it("transcodes 4K HEVC MKV even when audio is AAC", () => {
    expect(playbackStrategy("matroska,webm", "hevc", "aac").strategy).toBe("transcode");
  });
  it("transcodes AV1 MP4 when browser support is uncertain", () => {
    expect(playbackStrategy("mov,mp4,m4a,3gp,3g2,mj2", "av1", "aac").strategy).toBe("transcode");
  });
  it("rejects missing video", () => {
    expect(playbackStrategy("matroska,webm", null, "aac").strategy).toBe("unsupported");
  });
});
