import { parseUserCode } from "@contracts/userCode";
import { avatarSchema } from "@contracts/avatar";
import { z } from "zod";
import { like, eq, ne, and, or, inArray, notInArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users, userBlocks } from "@db/schema";
import { keyFingerprint } from "./crypto";
import { onlineUserIds } from "./hub";

const publicUserCols = {
  id: users.id,
  username: users.username,
  displayName: users.displayName,
  lcCode: users.lcCode,
  bio: users.bio,
  avatar: users.avatar,
  publicKey: users.publicKey,
};

export const usersRouter = createRouter({
  blocked: authedQuery.query(async ({ ctx }) => {
    return getDb().select({ id: users.id, username: users.username, displayName: users.displayName,
      avatar: users.avatar }).from(userBlocks).innerJoin(users, eq(userBlocks.blockedId, users.id))
      .where(eq(userBlocks.blockerId, ctx.user!.id));
  }),
  block: authedQuery.input(z.object({ userId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    if (input.userId === ctx.user!.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot block yourself" });
    const db = getDb();
    const target = await db.query.users.findFirst({ where: eq(users.id, input.userId) });
    if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    await db.insert(userBlocks).values({ blockerId: ctx.user!.id, blockedId: input.userId })
      .onDuplicateKeyUpdate({ set: { blockedId: input.userId } });
    return { blocked: true };
  }),
  unblock: authedQuery.input(z.object({ userId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await getDb().delete(userBlocks).where(and(eq(userBlocks.blockerId, ctx.user!.id), eq(userBlocks.blockedId, input.userId)));
    return { blocked: false };
  }),
  setAvatar: authedQuery.input(z.object({ avatar: avatarSchema.nullable() })).mutation(async ({ ctx, input }) => {
    await getDb().update(users).set({ avatar: input.avatar }).where(eq(users.id, ctx.user!.id));
    return { saved: true };
  }),
  /** Update profile fields that are safe to publish in the user directory. */
  updateProfile: authedQuery
    .input(z.object({
      displayName: z.string().trim().min(1).max(64),
      bio: z.string().trim().max(280),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db.update(users).set({
        displayName: input.displayName,
        bio: input.bio || null,
      }).where(eq(users.id, ctx.user!.id));
      return { ...input, bio: input.bio || null };
    }),

  /** Search the user directory by username or display name. */
  search: authedQuery
    .input(z.object({ q: z.string().min(1).max(64) }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const codeId = parseUserCode(input.q);
      if (/^LC-/i.test(input.q.trim()) && codeId === null) return [];
      const q = `%${input.q.replace(/[%_]/g, "")}%`;
      const blockedRows = await db.select({ blockerId: userBlocks.blockerId, blockedId: userBlocks.blockedId })
        .from(userBlocks).where(or(eq(userBlocks.blockerId, ctx.user!.id), eq(userBlocks.blockedId, ctx.user!.id)));
      const hiddenIds = blockedRows.map(row => row.blockerId === ctx.user!.id ? row.blockedId : row.blockerId);
      return db
        .select(publicUserCols)
        .from(users)
        .where(
          and(
            ne(users.id, ctx.user!.id),
            eq(users.disabled, false),
            hiddenIds.length ? notInArray(users.id, hiddenIds) : undefined,
            codeId !== null ? eq(users.lcCode, codeId) : or(like(users.username, q), like(users.displayName, q)),
          ),
        )
        .limit(12);
    }),

  /** Fetch public keys + fingerprints for a set of users. */
  keys: authedQuery
    .input(z.object({ ids: z.array(z.number().int().positive()).max(100) }))
    .query(async ({ input }) => {
      if (input.ids.length === 0) return [];
      const db = getDb();
      const rows = await db
        .select(publicUserCols)
        .from(users)
        .where(inArray(users.id, input.ids));
      return rows.map((u) => ({ ...u, fingerprint: keyFingerprint(u.publicKey) }));
    }),

  /** Currently online user ids (has an open realtime connection). */
  presence: authedQuery.query(() => ({ online: onlineUserIds() })),
});
