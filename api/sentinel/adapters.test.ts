import { describe, it, expect } from "vitest";
import { normalizeWebhook, maxSeverity } from "./adapters";

describe("sentinel severity", () => {
  it("returns the higher severity", () => {
    expect(maxSeverity("low", "critical")).toBe("critical");
    expect(maxSeverity("high", "medium")).toBe("high");
    expect(maxSeverity("info", "info")).toBe("info");
  });
});

describe("generic adapter", () => {
  it("normalizes a minimal payload with defaults", () => {
    const n = normalizeWebhook("generic", { title: "Disk almost full" });
    expect(n.title).toBe("Disk almost full");
    expect(n.severity).toBe("medium");
    expect(n.source).toBe("custom");
    expect(n.resolve).toBe(false);
  });
  it("respects explicit severity, source and resolved status", () => {
    const n = normalizeWebhook("generic", {
      title: "Breach", severity: "critical", source: "siem", status: "resolved", fingerprint: "fp1",
    });
    expect(n.severity).toBe("critical");
    expect(n.source).toBe("siem");
    expect(n.resolve).toBe(true);
    expect(n.fingerprint).toBe("fp1");
  });
  it("rejects payloads without a title", () => {
    expect(() => normalizeWebhook("generic", { severity: "high" })).toThrow();
  });
  it("rejects an over-long title", () => {
    expect(() => normalizeWebhook("generic", { title: "x".repeat(201) })).toThrow();
    const n = normalizeWebhook("generic", { title: "x".repeat(199) });
    expect(n.title.length).toBeLessThanOrEqual(200);
  });
});

describe("nScout adapter", () => {
  it("maps a critical alert and builds a fingerprint", () => {
    const n = normalizeWebhook("nscout", {
      alert: { name: "CPU high", service: "web", host: "pi-1", level: "critical", message: "load 9.2", id: "a-42" },
    });
    expect(n.source).toBe("nscout");
    expect(n.severity).toBe("critical");
    expect(n.title).toBe("CPU high");
    expect(n.externalId).toBe("a-42");
    expect(n.description).toContain("Host: pi-1");
    expect(n.resolve).toBe(false);
  });
  it("treats a recovered state as a resolve signal", () => {
    const n = normalizeWebhook("nscout", { alert: { name: "CPU high", state: "recovered", service: "web", host: "pi-1" } });
    expect(n.resolve).toBe(true);
    expect(n.fingerprint).toBe("nscout:web:pi-1");
  });
  it("defaults severity to high when level is unknown", () => {
    const n = normalizeWebhook("nscout", { alert: { name: "Something" } });
    expect(n.severity).toBe("high");
  });
});

describe("PipelineGuard adapter", () => {
  it("maps a failed pipeline run to a high-severity incident", () => {
    const n = normalizeWebhook("pipelineguard", {
      pipeline: "api-deploy", stage: "build", status: "failed", branch: "main", commit: "abc123", runId: "run-7",
    });
    expect(n.source).toBe("pipelineguard");
    expect(n.severity).toBe("high");
    expect(n.title).toContain("api-deploy");
    expect(n.title).toContain("build");
    expect(n.fingerprint).toBe("pipelineguard:api-deploy:build");
    expect(n.externalId).toBe("run-7");
    expect(n.resolve).toBe(false);
  });
  it("marks a successful run as resolved/info", () => {
    const n = normalizeWebhook("pipelineguard", { pipeline: "api-deploy", stage: "build", status: "success" });
    expect(n.resolve).toBe(true);
    expect(n.severity).toBe("info");
  });
});
