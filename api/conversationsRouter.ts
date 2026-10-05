import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, inArray } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  conversations,
  conversationMembers,
  users,
} from "@db/schema";
import type { ConversationSummary } from "@contracts/types";

export const conversationsRouter = createRouter({
  /** All conversations the current user belongs to, with members + my wrapped key. */
  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const me = ctx.user!.id;

    const memberships = await db
      .select()
      .from(conversationMembers)
      .where(eq(conversationMembers.userId, me));
    if (memberships.length === 0) return [] as ConversationSummary[];

    const convIds = memberships.map((m) => m.conversationId);
    const convs = await db
      .select()
      .from(conversations)
      .where(inArray(conversations.id, convIds));

    const allMembers = await db
      .select({
        member: conversationMembers,
        user: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          publicKey: users.publicKey,
        },
      })
      .from(conversationMembers)
      .innerJoin(users, eq(conversationMembers.userId, users.id))
      .where(inArray(conversationMembers.conversationId, convIds));

    return convs.map((c): ConversationSummary => {
      const mine = memberships.find((m) => m.conversationId === c.id);
      return {
        id: c.id,
        type: c.type,
        name: c.name,
        createdAt: c.createdAt,
        members: allMembers
          .filter((m) => m.member.conversationId === c.id)
          .map((m) => m.user),
        wrappedKey: mine?.wrappedKey ?? null,
        wrappedBy: mine?.wrappedBy ?? null,
      };
    });
  }),

  /** Get or create a 1:1 conversation with another user. */
  createDirect: authedQuery
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const me = ctx.user!.id;
      if (input.userId === me) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot chat with yourself" });
      }
      const other = await db.query.users.findFirst({
        where: eq(users.id, input.userId),
      });
      if (!other) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      // find an existing direct conversation shared by both users
      const myMemberships = await db
        .select()
        .from(conversationMembers)
        .where(eq(conversationMembers.userId, me));
      const myConvIds = myMemberships.map((m) => m.conversationId);
      if (myConvIds.length > 0) {
        const shared = await db
          .select({ conversationId: conversationMembers.conversationId })
          .from(conversationMembers)
          .where(
            and(
              eq(conversationMembers.userId, input.userId),
              inArray(conversationMembers.conversationId, myConvIds),
            ),
          );
        for (const s of shared) {
          const conv = await db.query.conversations.findFirst({
            where: and(
              eq(conversations.id, s.conversationId),
              eq(conversations.type, "direct"),
            ),
          });
          if (conv) return { conversationId: conv.id, created: false };
        }
      }

      const [{ id }] = await db
        .insert(conversations)
        .values({ type: "direct", createdBy: me })
        .$returningId();
      await db.insert(conversationMembers).values([
        { conversationId: id, userId: me },
        { conversationId: id, userId: input.userId },
      ]);
      return { conversationId: id, created: true };
    }),

  /**
   * Create a group. The creator generates the group key client-side and
   * uploads it wrapped individually for every member (wrappedKeys).
   */
  createGroup: authedQuery
    .input(
      z.object({
        name: z.string().min(1).max(64),
        memberIds: z.array(z.number().int().positive()).min(1).max(50),
        wrappedKeys: z
          .array(
            z.object({
              userId: z.number().int().positive(),
              wrappedKey: z.string().min(1),
            }),
          )
          .min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const me = ctx.user!.id;
      const memberIds = [...new Set([me, ...input.memberIds])];

      const found = await db
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.id, memberIds));
      if (found.length !== memberIds.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown member" });
      }

      const wrapped = new Map(input.wrappedKeys.map((w) => [w.userId, w.wrappedKey]));
      for (const id of memberIds) {
        if (!wrapped.get(id)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Missing wrapped key for a member",
          });
        }
      }

      const [{ id: convId }] = await db
        .insert(conversations)
        .values({ type: "group", name: input.name, createdBy: me })
        .$returningId();
      await db.insert(conversationMembers).values(
        memberIds.map((userId) => ({
          conversationId: convId,
          userId,
          wrappedKey: wrapped.get(userId)!,
          wrappedBy: me,
        })),
      );
      return { conversationId: convId };
    }),
});
