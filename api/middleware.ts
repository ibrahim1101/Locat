import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const createRouter = t.router;
export const publicQuery = t.procedure.use(async ({ ctx, type, next }) => {
  if (type === "mutation") {
    const origin = ctx.req.headers.get("origin");
    const expected = process.env.PUBLIC_ORIGIN || new URL(ctx.req.url).origin;
    const isNativeOrigin = origin === "https://localhost";
    // Capacitor serves the packaged app from this fixed HTTPS origin. Login and
    // registration cannot carry a bearer token yet, so allow that native origin
    // through the origin/Fetch-Metadata guard. CORS remains restricted to the same
    // exact origin, while browser mutations still require PUBLIC_ORIGIN.
    const isAllowedNativeRequest = isNativeOrigin;
    if (origin && !isAllowedNativeRequest && (process.env.PUBLIC_ORIGIN ? origin !== expected : new URL(origin).host !== new URL(expected).host)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Request origin is not allowed" });
    }
    if (ctx.req.headers.get("sec-fetch-site") === "cross-site" && !isAllowedNativeRequest) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
  }
  return next();
});

/** Requires a valid session (username/password auth). ctx.user is non-null. */
export const authedQuery = publicQuery.use(async ({ ctx, next }) => {
  if (!ctx.user || ctx.user.disabled) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not signed in" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});
