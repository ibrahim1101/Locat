import { describe, expect, it } from "vitest";
import { AUDIO_EXTENSIONS, MEDIA_MIME, PHOTO_EXTENSIONS, VIDEO_EXTENSIONS } from "./mediaTypes";

describe("authorized media formats", () => {
  it("provides a MIME type for every indexed media extension", () => {
    for (const ext of [...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS, ...PHOTO_EXTENSIONS]) {
      expect(MEDIA_MIME[ext], `Missing MIME mapping for ${ext}`).toBeTruthy();
    }
  });

  it("does not allow the same extension in multiple media categories", () => {
    const all = [...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS, ...PHOTO_EXTENSIONS];
    expect(new Set(all).size).toBe(all.length);
  });

  it("uses matching MIME families for videos, audio, and photos", () => {
    for (const ext of VIDEO_EXTENSIONS) expect(MEDIA_MIME[ext]).toMatch(/^video\//);
    for (const ext of AUDIO_EXTENSIONS) expect(MEDIA_MIME[ext]).toMatch(/^audio\//);
    for (const ext of PHOTO_EXTENSIONS) expect(MEDIA_MIME[ext]).toMatch(/^image\//);
  });

  it("includes common phone photo formats", () => {
    for (const ext of [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"]) {
      expect(PHOTO_EXTENSIONS.has(ext)).toBe(true);
    }
  });

  it("does not declare executable or document formats as streamable media", () => {
    for (const ext of [".exe", ".bat", ".js", ".html", ".svg", ".pdf"]) {
      expect(MEDIA_MIME[ext]).toBeUndefined();
    }
  });
});
