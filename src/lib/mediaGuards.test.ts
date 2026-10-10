import { describe, expect, it } from "vitest";
import {
  SUPPORTED_IMAGE_MIMES,
  normalizeImageMime,
  sanitizeAttachmentMime,
  sniffImageMime,
} from "./crypto";

describe("image MIME normalization", () => {
  it("keeps every inline-renderable type", () => {
    for (const mime of SUPPORTED_IMAGE_MIMES) {
      expect(normalizeImageMime(mime)).toBe(mime);
    }
  });

  it("rejects types Android commonly mislabels", () => {
    expect(normalizeImageMime("image/heic")).toBeNull();
    expect(normalizeImageMime("image/heif")).toBeNull();
    expect(normalizeImageMime("")).toBeNull();
    expect(normalizeImageMime(undefined)).toBeNull();
    expect(normalizeImageMime("application/octet-stream")).toBeNull();
  });

  it("is case-insensitive for OS-reported types", () => {
    expect(normalizeImageMime("IMAGE/PNG")).toBe("image/png");
  });
});

describe("image magic-byte sniffing", () => {
  it("detects JPEG, PNG, GIF, WebP and AVIF", () => {
    expect(sniffImageMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]))).toBe("image/jpeg");
    expect(sniffImageMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffImageMime(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).toBe("image/gif");
    expect(
      sniffImageMime(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])),
    ).toBe("image/webp");
    // AVIF: size + 'ftyp' + brand 'avif'
    expect(
      sniffImageMime(new Uint8Array([0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66])),
    ).toBe("image/avif");
  });

  it("does not misdetect HEIC as a supported type", () => {
    // HEIC brand 'heic' must return null so the receiver does not attempt
    // to render it inline (Android share sheet passes these through).
    expect(
      sniffImageMime(new Uint8Array([0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63])),
    ).toBeNull();
  });

  it("returns null for empty, short or unknown payloads", () => {
    expect(sniffImageMime(new Uint8Array([]))).toBeNull();
    expect(sniffImageMime(new Uint8Array([0xff]))).toBeNull();
    expect(sniffImageMime(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBeNull(); // PDF
  });
});

describe("attachment download MIME", () => {
  it("keeps well-formed content types so the OS can pick an app", () => {
    expect(sanitizeAttachmentMime("application/pdf")).toBe("application/pdf");
    expect(sanitizeAttachmentMime("text/plain")).toBe("text/plain");
    expect(sanitizeAttachmentMime("application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
      .toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  });

  it("degrades malformed values to octet-stream", () => {
    expect(sanitizeAttachmentMime("")).toBe("application/octet-stream");
    expect(sanitizeAttachmentMime("no-slash")).toBe("application/octet-stream");
    expect(sanitizeAttachmentMime("text/html; charset=utf-8")).toBe("application/octet-stream");
    expect(sanitizeAttachmentMime(`x/${"y".repeat(200)}`)).toBe("application/octet-stream");
  });
});
