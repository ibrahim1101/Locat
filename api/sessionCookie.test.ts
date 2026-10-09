import { afterEach, describe, expect, it, vi } from "vitest";

const originalNodeEnv = process.env.NODE_ENV;
const originalCookieSecure = process.env.COOKIE_SECURE;
const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalCookieSecure === undefined) delete process.env.COOKIE_SECURE;
  else process.env.COOKIE_SECURE = originalCookieSecure;
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  vi.resetModules();
});

describe("session cookie transport policy", () => {
  it("enforces Secure in production even when an override requests false", async () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "mysql://test:test@127.0.0.1:3306/locat_test";
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
