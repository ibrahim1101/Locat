import { parseUserCode } from "@contracts/userCode";
import { avatarSchema } from "@contracts/avatar";
import { z } from "zod";
import { like, eq, ne, and, or, inArray, notInArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users, userBlocks, contactRelationships } from "@db/schema";
import { keyFingerprint } from "./crypto";
import { onlineUserIds } from "./hub";
import { limit } from "./rateLimit";

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
  contacts: authedQuery.query(async ({ ctx }) => {
    const me = ctx.user!.id;
    const rows = await getDb().select().from(contactRelationships).where(and(
      eq(contactRelationships.status, "accepted"),
      or(eq(contactRelationships.userLowId, me), eq(contactRelationships.userHighId, me)),
    ));
    const ids = rows.map(row => row.userLowId === me ? row.userHighId : row.userLowId);
    if (!ids.length) return [];
    return getDb().select(publicUserCols).from(users).where(and(inArray(users.id, ids), eq(users.disabled, false)));
  }),
  contactRequests: authedQuery.query(async ({ ctx }) => {
    const me = ctx.user!.id;
    const rows = await getDb().select().from(contactRelationships).where(and(
      eq(contactRelationships.status, "pending"),
      or(eq(contactRelationships.userLowId, me), eq(contactRelationships.userHighId, me)),
    ));
    const ids = rows.map(row => row.userLowId === me ? row.userHighId : row.userLowId);
    const people = ids.length ? await getDb().select(publicUserCols).from(users).where(inArray(users.id, ids)) : [];
    const byId = new Map(people.map(person => [person.id, person]));
    return rows.flatMap(row => {
      const peerId = row.userLowId === me ? row.userHighId : row.userLowId;
      const user = byId.get(peerId);
      return user ? [{ id: row.id, direction: row.requestedById === me ? "outgoing" as const : "incoming" as const,
        createdAt: row.createdAt, user }] : [];
    });
  }),
  requestContact: authedQuery.input(z.object({ userId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const me = ctx.user!.id;
    if (input.userId === me) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot add yourself" });
    limit(`contact-request:${me}`, 30, 60 * 60 * 1000);
    const low = Math.min(me, input.userId), high = Math.max(me, input.userId);
    return getDb().transaction(async tx => {
      const [target] = await tx.select({ id: users.id }).from(users)
        .where(and(eq(users.id, input.userId), eq(users.disabled, false))).limit(1);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      const [blocked] = await tx.select({ id: userBlocks.id }).from(userBlocks).where(or(
        and(eq(userBlocks.blockerId, me), eq(userBlocks.blockedId, input.userId)),
        and(eq(userBlocks.blockerId, input.userId), eq(userBlocks.blockedId, me)),
      )).limit(1);
      if (blocked) throw new TRPCError({ code: "FORBIDDEN", message: "Contact is unavailable" });
      await tx.select({ id: users.id }).from(users).where(eq(users.id, low)).for("update");
      const [existing] = await tx.select().from(contactRelationships).where(and(
        eq(contactRelationships.userLowId, low), eq(contactRelationships.userHighId, high),
      )).limit(1);
      if (existing?.status === "accepted") return { status: "accepted" as const };
      if (existing?.requestedById === me) return { status: "pending" as const };
      if (existing) {
        await tx.update(contactRelationships).set({ status: "accepted", updatedAt: new Date() })
          .where(eq(contactRelationships.id, existing.id));
        return { status: "accepted" as const };
      }
      await tx.insert(contactRelationships).values({ userLowId: low, userHighId: high, requestedById: me });
      return { status: "pending" as const };
    });
  }),
  respondContact: authedQuery.input(z.object({ requestId: z.number().int().positive(), accept: z.boolean() }))
    .mutation(async ({ ctx, input }) => getDb().transaction(async tx => {
      const [row] = await tx.select().from(contactRelationships)
        .where(eq(contactRelationships.id, input.requestId)).for("update");
      if (!row || row.status !== "pending" || row.requestedById === ctx.user!.id ||
        (row.userLowId !== ctx.user!.id && row.userHighId !== ctx.user!.id))
        throw new TRPCError({ code: "NOT_FOUND", message: "Contact request not found" });
      if (input.accept) {
        const peerId = row.userLowId === ctx.user!.id ? row.userHighId : row.userLowId;
        const [blocked] = await tx.select({ id: userBlocks.id }).from(userBlocks).where(or(
          and(eq(userBlocks.blockerId, ctx.user!.id), eq(userBlocks.blockedId, peerId)),
          and(eq(userBlocks.blockerId, peerId), eq(userBlocks.blockedId, ctx.user!.id)),
        )).limit(1);
        if (blocked) throw new TRPCError({ code: "FORBIDDEN", message: "Contact is unavailable" });
        await tx.update(contactRelationships).set({ status: "accepted", updatedAt: new Date() })
          .where(eq(contactRelationships.id, row.id));
      }
      else await tx.delete(contactRelationships).where(eq(contactRelationships.id, row.id));
      return { status: input.accept ? "accepted" as const : "declined" as const };
    })),
  removeContact: authedQuery.input(z.object({ userId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const me = ctx.user!.id, low = Math.min(me, input.userId), high = Math.max(me, input.userId);
    const result = await getDb().delete(contactRelationships).where(and(
      eq(contactRelationships.userLowId, low), eq(contactRelationships.userHighId, high),
      or(eq(contactRelationships.requestedById, me), eq(contactRelationships.status, "accepted")),
    ));
    return { removed: result[0].affectedRows > 0 };
  }),
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
    const low = Math.min(ctx.user!.id, input.userId), high = Math.max(ctx.user!.id, input.userId);
    await db.delete(contactRelationships).where(and(eq(contactRelationships.userLowId, low), eq(contactRelationships.userHighId, high)));
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
