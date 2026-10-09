import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { eq } from "drizzle-orm";
import { getDb } from "./queries/connection";
import { sessions, users, type User } from "@db/schema";
import { env } from "./lib/env";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user?: User;
  sessionToken?: string;
};

const SESSION_COOKIE = "rc_session";

export function sessionCookie(token: string, maxAgeSeconds: number): string {
  const secure = env.isProduction || process.env.COOKIE_SECURE === "true";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure ? "; Secure" : ""}`;
}

function extractToken(req: Request): string | undefined {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const cookie = req.headers.get("cookie");
  if (cookie) {
    for (const part of cookie.split(";")) {
      const [k, ...v] = part.trim().split("=");
      if (k === SESSION_COOKIE) {
        try { return decodeURIComponent(v.join("=")); } catch { return undefined; }
      }
    }
  }
  return undefined;
}

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  const ctx: TrpcContext = { req: opts.req, resHeaders: opts.resHeaders };
  const token = extractToken(opts.req);
  if (!token) return ctx;

  const db = getDb();
  const rows = await db
    .select({ user: users, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.token, token))
    .limit(1);

  const row = rows[0];
  if (row && !row.user.disabled && row.session.expiresAt > new Date()) {
    ctx.user = row.user;
    ctx.sessionToken = token;
  }
  return ctx;
}
