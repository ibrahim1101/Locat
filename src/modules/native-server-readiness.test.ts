import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("native HTTPS onboarding", () => {
  const code = readFileSync(new URL("../components/NativeServerSetup.tsx", import.meta.url), "utf8");
  it("requires the schema-ready endpoint, not a process-only health check", () => {
    expect(code).toContain("/api/ready");
    expect(code).not.toContain("/api/health");
    expect(code).toContain('health.status !== "ready"');
  });
  it("refuses redirects and failed readiness before persisting", () => {
    expect(code).toContain('redirect: "manual"');
    expect(code).toContain("response.status !== 200");
    expect(code.indexOf("response.status !== 200")).toBeLessThan(code.indexOf("setNativeServerUrl(origin)"));
  });
});
