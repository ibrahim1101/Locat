import { describe, it, expect } from "vitest";
import { generateIntegrationToken, hashToken, looksLikeIntegrationToken, scopeAllows, TOKEN_PREFIX } from "./tokens";

describe("integration tokens", () => {
  it("generates a prefixed token whose stored hash matches", () => {
    const { token, tokenHash, tokenPrefix } = generateIntegrationToken();
    expect(token.startsWith(TOKEN_PREFIX)).toBe(true);
    expect(tokenHash).toHaveLength(64);
    expect(hashToken(token)).toBe(tokenHash);
    expect(token.startsWith(tokenPrefix)).toBe(true);
  });

  it("produces unique tokens", () => {
    const a = generateIntegrationToken();
    const b = generateIntegrationToken();
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });

  it("never exposes the plaintext inside the hash", () => {
    const { token, tokenHash } = generateIntegrationToken();
    expect(tokenHash).not.toContain(token);
  });

  it("distinguishes integration tokens from bare session tokens", () => {
    const { token } = generateIntegrationToken();
    expect(looksLikeIntegrationToken(token)).toBe(true);
    // A random base64url session-style token must not be mistaken for one.
    expect(looksLikeIntegrationToken("Hh2Kd9f0sampleSessionTokenValue")).toBe(false);
  });

  it("enforces scopes", () => {
    expect(scopeAllows("incidents:write", "incidents:write")).toBe(true);
    expect(scopeAllows("incidents:read incidents:write", "incidents:write")).toBe(true);
    expect(scopeAllows("incidents:read", "incidents:write")).toBe(false);
  });
});
