import { describe, it, expect } from "vitest";
import { utf8ByteLength, exceedsByteLimit, parseContentLength, MAX_WEBHOOK_BODY_BYTES } from "./limits";

describe("sentinel webhook size limits", () => {
  it("measures real UTF-8 bytes, not UTF-16 string length", () => {
    // Each 😀 is 2 UTF-16 code units (.length === 2) but 4 UTF-8 bytes.
    const emoji = "😀";
    expect(emoji.length).toBe(2);
    expect(utf8ByteLength(emoji)).toBe(4);
    // A 4-char multibyte string (é = 2 bytes) exceeds a tiny byte budget even
    // though its .length is small.
    expect(utf8ByteLength("é".repeat(10))).toBe(20);
  });

  it("flags a multibyte payload that fits under the char limit but not the byte limit", () => {
    // 20,000 emoji = 40,000 chars (.length) but 80,000 bytes > 64 KB.
    const payload = "😀".repeat(20_000);
    expect(payload.length).toBeLessThan(MAX_WEBHOOK_BODY_BYTES); // would wrongly pass a .length check
    expect(exceedsByteLimit(payload)).toBe(true); // correctly rejected by byte check
  });

  it("accepts a payload within the byte limit", () => {
    expect(exceedsByteLimit("a".repeat(1000))).toBe(false);
    expect(exceedsByteLimit("ok")).toBe(false);
  });

  it("rejects an oversized ASCII payload", () => {
    expect(exceedsByteLimit("x".repeat(MAX_WEBHOOK_BODY_BYTES + 1))).toBe(true);
    expect(exceedsByteLimit("x".repeat(MAX_WEBHOOK_BODY_BYTES))).toBe(false);
  });

  it("parses Content-Length defensively", () => {
    expect(parseContentLength("1024")).toBe(1024);
    expect(parseContentLength("0")).toBe(0);
    expect(parseContentLength(null)).toBeNull();
    expect(parseContentLength("")).toBeNull();
    expect(parseContentLength("-5")).toBeNull();
    expect(parseContentLength("abc")).toBeNull();
  });
});
