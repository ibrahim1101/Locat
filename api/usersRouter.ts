import { parseUserCode } from "@contracts/userCode";
import { z } from "zod";
import { like, eq, ne, and, or, inArray } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users } from "@db/schema";
import { keyFingerprint } from "./crypto";
import { onlineUserIds } from "./hub";

const publicUserCols = {
  id: users.id,
  username: users.username,
  displayName: users.displayName,
  bio: users.bio,
  publicKey: users.publicKey,
};

export const usersRouter = createRouter({
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
      return db
        .select(publicUserCols)
        .from(users)
        .where(
          and(
            ne(users.id, ctx.user!.id),
            eq(users.disabled, false),
            codeId !== null ? eq(users.id, codeId) : or(like(users.username, q), like(users.displayName, q)),
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
