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
  publicKey: users.publicKey,
};

export const usersRouter = createRouter({
  /** Search the user directory by username or display name. */
  search: authedQuery
    .input(z.object({ q: z.string().min(1).max(64) }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const q = `%${input.q.replace(/[%_]/g, "")}%`;
      return db
        .select(publicUserCols)
        .from(users)
        .where(
          and(
            ne(users.id, ctx.user!.id),
            eq(users.disabled, false),
            or(like(users.username, q), like(users.displayName, q)),
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
