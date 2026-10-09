import { describe, expect, it } from "vitest";
import { parseNativeServerOrigin } from "./nativeServerOrigin";

describe("Android server origin validation", () => {
  it("accepts HTTPS with a port", () => {
    expect(parseNativeServerOrigin("https://localhost:8443/")).toBe("https://localhost:8443");
  });
  it("rejects HTTP and paths", () => {
    expect(() => parseNativeServerOrigin("http://localhost:3000")).toThrow();
    expect(() => parseNativeServerOrigin("https://example.org/path")).toThrow();
  });
});
