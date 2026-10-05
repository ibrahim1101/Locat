import { ECDH } from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, or } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { pushSubscriptions } from "@db/schema";
import {
  allowedPushEndpoint,
  endpointHash,
  notifyUsers,
  pushConfiguration,
} from "./push";
import { limit } from "./rateLimit";
const endpoint = z
  .string()
  .url()
  .max(4096)
  .refine(allowedPushEndpoint, "Unsupported push provider");
const key = z.string().regex(/^[A-Za-z0-9_-]+={0,2}$/);
export const pushRouter = createRouter({
  configuration: authedQuery.query(() => ({
    publicKey: pushConfiguration()?.publicKey ?? null,
  })),
  subscribe: authedQuery
    .input(
      z.object({
        endpoint,
        keys: z.object({ p256dh: key.max(128), auth: key.max(64) }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!pushConfiguration())
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Push notifications are not configured on this server.",
        });
      if (!ctx.sessionToken) throw new TRPCError({ code: "UNAUTHORIZED" });
      limit(`push-subscribe:${ctx.user.id}`, 20, 60000);
      if (
        Buffer.from(input.keys.p256dh, "base64url").length !== 65 ||
        Buffer.from(input.keys.auth, "base64url").length !== 16
      )
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid subscription keys",
        });
      try {
        ECDH.convertKey(
          Buffer.from(input.keys.p256dh, "base64url"),
          "prime256v1"
        );
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid subscription public key",
        });
      }
      const hash = endpointHash(input.endpoint);
      await getDb().transaction(async tx => {
        const existing = await tx
          .select()
          .from(pushSubscriptions)
          .where(eq(pushSubscriptions.endpointHash, hash))
          .for("update");
        if (existing[0] && existing[0].userId !== ctx.user.id)
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Disable notifications in the previous account before enabling them here.",
          });
        await tx
          .delete(pushSubscriptions)
          .where(
            and(
              eq(pushSubscriptions.userId, ctx.user.id),
              or(
                eq(pushSubscriptions.sessionToken, ctx.sessionToken!),
                eq(pushSubscriptions.endpointHash, hash)
              )
            )
          );
        await tx.insert(pushSubscriptions).values({
          userId: ctx.user.id,
          sessionToken: ctx.sessionToken!,
          endpointHash: hash,
          endpoint: input.endpoint,
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
        });
      });
      return { ok: true };
    }),
  unsubscribe: authedQuery
    .input(z.object({ endpoint }))
    .mutation(async ({ ctx, input }) => {
      await getDb()
        .delete(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.userId, ctx.user.id),
            eq(pushSubscriptions.endpointHash, endpointHash(input.endpoint))
          )
        );
      return { ok: true };
    }),
  test: authedQuery.mutation(async ({ ctx }) => {
    limit(`push-test:${ctx.user.id}`, 5, 60000);
    await notifyUsers([ctx.user.id]);
    return { ok: true };
  }),
});
