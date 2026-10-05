import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users, sessions } from "@db/schema";
import { hashPassword, verifyPassword, newSessionToken } from "./crypto";
import { sessionCookie } from "./context";

import { limit } from "./rateLimit";

const SESSION_TTL_DAYS = 30;

const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(32)
  .regex(/^[a-zA-Z0-9_.-]+$/, "Letters, numbers, _ . - only");

const keyBundleSchema = z.object({
  publicKey: z.string().min(1).max(16000),
  encryptedPrivateKey: z.string().min(1).max(16000),
  keySalt: z.string().min(1).max(16000),
});

export const authRouter = createRouter({
  register: publicQuery
    .input(
      z.object({
        username: usernameSchema,
        displayName: z.string().min(1).max(64),
        password: z.string().min(8, "Password must be at least 8 characters").max(1024),
        keys: keyBundleSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      limit("auth-global", 120, 60000);
      limit(`auth-account:${input.username.toLowerCase()}`, 15, 15 * 60000);
      const db = getDb();
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, input.username.toLowerCase()))
        .limit(1);
      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "Username is taken" });
      }

      const passwordHash = await hashPassword(input.password);
      const [{ id }] = await db
        .insert(users)
        .values({
          username: input.username.toLowerCase(),
          displayName: input.displayName,
          passwordHash,
          publicKey: input.keys.publicKey,
          encryptedPrivateKey: input.keys.encryptedPrivateKey,
          keySalt: input.keys.keySalt,
        })
        .$returningId();

      const token = newSessionToken();
      const expiresAt = new Date(
        Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
      );
      await db.insert(sessions).values({ token, userId: id, expiresAt });
      ctx.resHeaders.append(
        "Set-Cookie",
        sessionCookie(token, SESSION_TTL_DAYS * 24 * 60 * 60),
      );

      const user = await db.query.users.findFirst({ where: eq(users.id, id) });
      return { token, user: publicProfile(user!) };
    }),

  login: publicQuery
    .input(z.object({ username: z.string().max(64), password: z.string().max(1024) }))
    .mutation(async ({ ctx, input }) => {
      limit("auth-global", 120, 60000);
      limit(`auth-account:${input.username.toLowerCase()}`, 15, 15 * 60000);
      const db = getDb();
      const user = await db.query.users.findFirst({
        where: eq(users.username, input.username.toLowerCase()),
      });
      if (!user || user.disabled || !(await verifyPassword(input.password, user.passwordHash))) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid username or password",
        });
      }

      const token = newSessionToken();
      const expiresAt = new Date(
        Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
      );
      // Delivery is currently account-scoped. Keep one active login until per-device queues exist.
      await db.transaction(async (tx) => {
        await tx.select({ id: users.id }).from(users).where(eq(users.id, user.id)).for("update");
        await tx.delete(sessions).where(eq(sessions.userId, user.id));
        await tx.insert(sessions).values({ token, userId: user.id, expiresAt });
      });
      ctx.resHeaders.append(
        "Set-Cookie",
        sessionCookie(token, SESSION_TTL_DAYS * 24 * 60 * 60),
      );

      return {
        token,
        user: publicProfile(user),
        // encrypted private-key backup so any device can restore the identity
        keys: {
          publicKey: user.publicKey,
          encryptedPrivateKey: user.encryptedPrivateKey,
          keySalt: user.keySalt,
        },
      };
    }),

  logout: publicQuery.mutation(async ({ ctx }) => {
    const db = getDb();
    if (ctx.sessionToken) {
      await db.delete(sessions).where(eq(sessions.token, ctx.sessionToken));
    }
    ctx.resHeaders.append("Set-Cookie", sessionCookie("deleted", 0));
    return { ok: true };
  }),

  me: authedQuery.query(({ ctx }) => publicProfile(ctx.user!)),

  /** Encrypted private-key backup (for restoring identity on a new device). */
  keyBackup: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const user = await db.query.users.findFirst({ where: eq(users.id, ctx.user!.id) });
    if (!user) throw new TRPCError({ code: "NOT_FOUND" });
    return {
      publicKey: user.publicKey,
      encryptedPrivateKey: user.encryptedPrivateKey,
      keySalt: user.keySalt,
    };
  }),

  /** Rotate identity keys (new key pair + new encrypted backup). */
  rotateKeys: authedQuery
    .input(keyBundleSchema)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .update(users)
        .set({
          publicKey: input.publicKey,
          encryptedPrivateKey: input.encryptedPrivateKey,
          keySalt: input.keySalt,
        })
        .where(eq(users.id, ctx.user!.id));
      return { ok: true };
    }),
});

function publicProfile(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    publicKey: user.publicKey,
    isAdmin: user.isAdmin,
  };
}
