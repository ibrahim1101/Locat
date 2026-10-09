import { afterEach, describe, expect, it, vi } from "vitest";

const originalNodeEnv = process.env.NODE_ENV;
const originalCookieSecure = process.env.COOKIE_SECURE;

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalCookieSecure === undefined) delete process.env.COOKIE_SECURE;
  else process.env.COOKIE_SECURE = originalCookieSecure;
  vi.resetModules();
});

describe("session cookie transport policy", () => {
  it("enforces Secure in production even when an override requests false", async () => {
    process.env.NODE_ENV = "production";
    process.env.COOKIE_SECURE = "false";
    vi.resetModules();
    const { sessionCookie } = await import("./context");
    expect(sessionCookie("sample", 60)).toContain("; Secure");
  });

  it("allows explicitly secure development cookies", async () => {
    process.env.NODE_ENV = "test";
    process.env.COOKIE_SECURE = "true";
    vi.resetModules();
    const { sessionCookie } = await import("./context");
    expect(sessionCookie("sample", 60)).toContain("; Secure");
  });

  it("preserves local development without TLS", async () => {
    process.env.NODE_ENV = "test";
    process.env.COOKIE_SECURE = "false";
    vi.resetModules();
    const { sessionCookie } = await import("./context");
    expect(sessionCookie("sample", 60)).not.toContain("; Secure");
  });
});
