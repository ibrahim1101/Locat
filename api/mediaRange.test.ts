import { describe, expect, it } from "vitest";
import { parseMediaRange } from "./mediaRange";

describe("media HTTP byte ranges", () => {
  it("serves entire files when Range is absent, including files larger than 8 MB", () => {
    expect(parseMediaRange(null, 25_000_000)).toEqual({ status: 200, start: 0, end: 24_999_999 });
  });
  it("supports explicit, open-ended and suffix ranges", () => {
    expect(parseMediaRange("bytes=100-199", 1000)).toEqual({ status: 206, start: 100, end: 199 });
    expect(parseMediaRange("bytes=500-", 1000)).toEqual({ status: 206, start: 500, end: 999 });
    expect(parseMediaRange("bytes=-200", 1000)).toEqual({ status: 206, start: 800, end: 999 });
  });
  it("clamps overlong end ranges to EOF", () => {
    expect(parseMediaRange("bytes=900-5000", 1000)).toEqual({ status: 206, start: 900, end: 999 });
  });
  it("rejects invalid and multi-range requests", () => {
    for (const value of ["bytes=1000-", "bytes=20-10", "bytes=-0", "bytes=0-1,4-5", "items=0-10", "bytes=-"]) {
      expect(parseMediaRange(value, 1000)).toEqual({ status: 416 });
    }
  });
  it("handles empty media", () => {
    expect(parseMediaRange(null, 0)).toEqual({ status: 200, start: 0, end: -1 });
    expect(parseMediaRange("bytes=0-", 0)).toEqual({ status: 416 });
  });
});
