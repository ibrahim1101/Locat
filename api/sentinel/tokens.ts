import { randomBytes, createHash } from "node:crypto";

/** Capabilities an integration token may hold. */
export const SENTINEL_SCOPES = ["incidents:write"] as const;
export type SentinelScope = (typeof SENTINEL_SCOPES)[number];

/** Integration tokens are prefixed so they can never be confused with the
 * random session tokens used for user auth (those carry no prefix and live in a
 * different table). Only the sha256 hash is persisted. */
export const TOKEN_PREFIX = "lsk_";

export function generateIntegrationToken(): {
  token: string;
  tokenHash: string;
  tokenPrefix: string;
} {
  const secret = randomBytes(32).toString("base64url");
  const token = `${TOKEN_PREFIX}${secret}`;
  return { token, tokenHash: hashToken(token), tokenPrefix: token.slice(0, 12) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function looksLikeIntegrationToken(value: string): boolean {
  return value.startsWith(TOKEN_PREFIX) && value.length >= TOKEN_PREFIX.length + 20;
}

export function scopeAllows(scope: string, required: SentinelScope): boolean {
  return scope
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .includes(required);
}
