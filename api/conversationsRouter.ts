import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, inArray, sql, asc } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  conversations,
  conversationMembers,
  users,
  groupKeys,
  messageDeliveries,
  messages,
} from "@db/schema";
import { emitToUsers } from "./hub";
import { limit } from "./rateLimit";
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

    const convIds = memberships.map(m => m.conversationId);
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

    const currentRows = await db
      .select({ key: groupKeys })
      .from(groupKeys)
      .innerJoin(
        conversations,
        and(
          eq(groupKeys.conversationId, conversations.id),
          eq(groupKeys.epoch, conversations.groupEpoch)
        )
      )
      .where(
        and(
          inArray(groupKeys.conversationId, convIds),
          eq(groupKeys.userId, me)
        )
      );
    const currentKeys = currentRows.map(row => row.key);
    return convs.map((c): ConversationSummary => {
      const mine = memberships.find(m => m.conversationId === c.id);
      return {
        id: c.id,
        createdBy: c.createdBy,
        groupEpoch: c.groupEpoch,
        rotationRequired: c.rotationRequired,
        wrapperPublicKey:
          currentKeys.find(
            k => k.conversationId === c.id && k.epoch === c.groupEpoch
          )?.wrapperPublicKey ?? null,
        type: c.type,
        name: c.name,
        createdAt: c.createdAt,
        members: allMembers
          .filter(m => m.member.conversationId === c.id)
          .map(m => m.user),
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
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot chat with yourself",
        });
      }
      const other = await db.query.users.findFirst({
        where: eq(users.id, input.userId),
      });
      if (!other)
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      return db.transaction(async tx => {
        // Lock the same user row for both directions of this pair, so simultaneous
        // creation requests cannot both miss the existing conversation.
        await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, Math.min(me, input.userId)))
          .for("update");
        const mine = await tx
          .select()
          .from(conversationMembers)
          .where(eq(conversationMembers.userId, me));
        const convIds = mine.map(m => m.conversationId);
        if (convIds.length > 0) {
          const shared = await tx
            .select({ id: conversations.id })
            .from(conversationMembers)
            .innerJoin(
              conversations,
              eq(conversationMembers.conversationId, conversations.id)
            )
            .where(
              and(
                eq(conversationMembers.userId, input.userId),
                inArray(conversations.id, convIds),
                eq(conversations.type, "direct")
              )
            )
            .limit(1);
          if (shared[0])
            return { conversationId: shared[0].id, created: false };
        }
        const [{ id }] = await tx
          .insert(conversations)
          .values({ type: "direct", createdBy: me })
          .$returningId();
        await tx.insert(conversationMembers).values([
          { conversationId: id, userId: me },
          { conversationId: id, userId: input.userId },
        ]);
        return { conversationId: id, created: true };
      });
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
              wrappedKey: z.string().min(1).max(16000),
              publicKey: z.string().max(16000).optional(),
            })
          )
          .min(1)
          .max(51),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const me = ctx.user!.id;
      limit(`group-create:${me}`, 30, 3600000);
      const memberIds = [...new Set([me, ...input.memberIds])];

      const found = await db
        .select({
          id: users.id,
          publicKey: users.publicKey,
          disabled: users.disabled,
        })
        .from(users)
        .where(inArray(users.id, memberIds));
      if (found.length !== memberIds.length || found.some(u => u.disabled)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown member" });
      }

      if (
        input.wrappedKeys.some(
          k =>
            k.publicKey &&
            found.find(u => u.id === k.userId)?.publicKey !== k.publicKey
        )
      )
        throw new TRPCError({
          code: "CONFLICT",
          message: "A member key changed. Refresh before creating the group.",
        });
      const wrapped = new Map(
        input.wrappedKeys.map(w => [w.userId, w.wrappedKey])
      );
      for (const id of memberIds) {
        if (!wrapped.get(id)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Missing wrapped key for a member",
          });
        }
      }

      const convId = await db.transaction(async tx => {
        const locked = await tx
          .select({
            id: users.id,
            publicKey: users.publicKey,
            disabled: users.disabled,
          })
          .from(users)
          .where(inArray(users.id, memberIds))
          .orderBy(asc(users.id))
          .for("update");
        if (
          locked.some(
            u =>
              u.disabled ||
              found.find(old => old.id === u.id)?.publicKey !== u.publicKey
          ) ||
          locked.find(u => u.id === me)?.publicKey !== ctx.user.publicKey
        )
          throw new TRPCError({
            code: "CONFLICT",
            message: "A member key changed. Refresh before creating the group.",
          });
        const [{ id }] = await tx
          .insert(conversations)
          .values({ type: "group", name: input.name, createdBy: me })
          .$returningId();
        await tx.insert(conversationMembers).values(
          memberIds.map(userId => ({
            conversationId: id,
            userId,
            wrappedKey: wrapped.get(userId)!,
            wrappedBy: me,
          }))
        );
        await tx.insert(groupKeys).values(
          memberIds.map(userId => ({
            conversationId: id,
            userId,
            epoch: 1,
            wrappedKey: wrapped.get(userId)!,
            wrapperPublicKey: ctx.user.publicKey,
          }))
        );
        return id;
      });
      return { conversationId: convId };
    }),
  groupKey: authedQuery
    .input(
      z.object({
        conversationId: z.number().int().positive(),
        epoch: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const member = await db.query.conversationMembers.findFirst({
        where: and(
          eq(conversationMembers.conversationId, input.conversationId),
          eq(conversationMembers.userId, ctx.user.id)
        ),
      });
      if (!member) throw new TRPCError({ code: "FORBIDDEN" });
      const key = await db.query.groupKeys.findFirst({
        where: and(
          eq(groupKeys.conversationId, input.conversationId),
          eq(groupKeys.userId, ctx.user.id),
          eq(groupKeys.epoch, input.epoch)
        ),
      });
      if (!key)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "This device has no key for that group version.",
        });
      return {
        wrappedKey: key.wrappedKey,
        wrapperPublicKey: key.wrapperPublicKey,
      };
    }),
  updateGroup: authedQuery
    .input(
      z.object({
        conversationId: z.number().int().positive(),
        expectedEpoch: z.number().int().positive(),
        name: z.string().trim().min(1).max(64),
        memberIds: z.array(z.number().int().positive()).min(1).max(51),
        wrappedKeys: z
          .array(
            z.object({
              userId: z.number().int().positive(),
              publicKey: z.string().min(1).max(16000),
              wrappedKey: z.string().min(1).max(16000),
            })
          )
          .min(1)
          .max(51),
      })
    )
    .mutation(async ({ ctx, input }) => {
      limit(`group-manage:${ctx.user.id}`, 30, 3600000);
      const affected = await getDb().transaction(async tx => {
        const [conv] = await tx
          .select()
          .from(conversations)
          .where(eq(conversations.id, input.conversationId))
          .for("update");
        if (!conv || conv.type !== "group" || conv.createdBy !== ctx.user.id)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only the group owner can change membership.",
          });
        if (conv.groupEpoch !== input.expectedEpoch)
          throw new TRPCError({
            code: "CONFLICT",
            message: "Group changed. Refresh before saving.",
          });
        const ids = [...new Set(input.memberIds)];
        if (!ids.includes(ctx.user.id))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Transfer ownership before leaving the group.",
          });
        const found = await tx
          .select({
            id: users.id,
            disabled: users.disabled,
            publicKey: users.publicKey,
          })
          .from(users)
          .where(inArray(users.id, ids))
          .orderBy(asc(users.id))
          .for("update");
        if (found.length !== ids.length || found.some(u => u.disabled))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "All selected accounts must be active.",
          });
        if (
          found.find(u => u.id === ctx.user.id)?.publicKey !==
          ctx.user.publicKey
        )
          throw new TRPCError({
            code: "CONFLICT",
            message: "Your identity changed. Sign in again.",
          });
        if (
          input.wrappedKeys.some(
            k => found.find(u => u.id === k.userId)?.publicKey !== k.publicKey
          )
        )
          throw new TRPCError({
            code: "CONFLICT",
            message: "A member key changed. Refresh before saving.",
          });
        const wrapped = new Map(
          input.wrappedKeys.map(k => [k.userId, k.wrappedKey])
        );
        if (wrapped.size !== ids.length || ids.some(id => !wrapped.has(id)))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Provide a wrapped new key for each member.",
          });
        const old = await tx
          .select()
          .from(conversationMembers)
          .where(eq(conversationMembers.conversationId, conv.id));
        const removed = old
          .filter(m => !ids.includes(m.userId))
          .map(m => m.userId);
        if (removed.length) {
          const queued = await tx
            .select({ id: messages.id })
            .from(messages)
            .where(eq(messages.conversationId, conv.id));
          if (queued.length)
            await tx.delete(messageDeliveries).where(
              and(
                inArray(
                  messageDeliveries.messageId,
                  queued.map(m => m.id)
                ),
                inArray(messageDeliveries.recipientId, removed)
              )
            );
        }
        await tx
          .delete(conversationMembers)
          .where(eq(conversationMembers.conversationId, conv.id));
        const epoch = conv.groupEpoch + 1;
        await tx.insert(conversationMembers).values(
          ids.map(userId => ({
            conversationId: conv.id,
            userId,
            wrappedKey: wrapped.get(userId)!,
            wrappedBy: ctx.user.id,
            joinedAt:
              old.find(m => m.userId === userId)?.joinedAt ?? new Date(),
          }))
        );
        await tx.insert(groupKeys).values(
          ids.map(userId => ({
            conversationId: conv.id,
            userId,
            epoch,
            wrappedKey: wrapped.get(userId)!,
            wrapperPublicKey: ctx.user.publicKey,
          }))
        );
        await tx.execute(
          sql`DELETE m FROM messages m LEFT JOIN message_deliveries d ON d.message_id=m.id WHERE m.conversation_id=${conv.id} AND d.id IS NULL`
        );
        await tx
          .update(conversations)
          .set({ name: input.name, groupEpoch: epoch, rotationRequired: false })
          .where(eq(conversations.id, conv.id));
        return [...new Set([...old.map(m => m.userId), ...ids])];
      });
      emitToUsers(affected, { type: "conversations-changed" });
      return { ok: true };
    }),
  transferGroup: authedQuery
    .input(
      z.object({
        conversationId: z.number().int().positive(),
        ownerId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const affected = await getDb().transaction(async tx => {
        const [conv] = await tx
          .select()
          .from(conversations)
          .where(eq(conversations.id, input.conversationId))
          .for("update");
        if (!conv || conv.type !== "group" || conv.createdBy !== ctx.user.id)
          throw new TRPCError({ code: "FORBIDDEN" });
        const members = await tx
          .select()
          .from(conversationMembers)
          .where(eq(conversationMembers.conversationId, conv.id));
        if (!members.some(m => m.userId === input.ownerId))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "New owner must be a current member.",
          });
        const newOwner = await tx
          .select({ disabled: users.disabled })
          .from(users)
          .where(eq(users.id, input.ownerId));
        if (newOwner[0]?.disabled)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "The new owner must be active.",
          });
        await tx
          .update(conversations)
          .set({ createdBy: input.ownerId })
          .where(eq(conversations.id, conv.id));
        return members.map(m => m.userId);
      });
      emitToUsers(affected, { type: "conversations-changed" });
      return { ok: true };
    }),
  leaveGroup: authedQuery
    .input(z.object({ conversationId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const affected = await getDb().transaction(async tx => {
        const [conv] = await tx
          .select()
          .from(conversations)
          .where(eq(conversations.id, input.conversationId))
          .for("update");
        if (!conv || conv.type !== "group")
          throw new TRPCError({ code: "NOT_FOUND" });
        const members = await tx
          .select()
          .from(conversationMembers)
          .where(eq(conversationMembers.conversationId, conv.id));
        if (conv.createdBy === ctx.user.id) {
          if (members.length === 1 && members[0].userId === ctx.user.id) {
            await tx.delete(conversations).where(eq(conversations.id, conv.id));
            return [ctx.user.id];
          }
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Transfer ownership before leaving.",
          });
        }
        if (!members.some(m => m.userId === ctx.user.id))
          throw new TRPCError({ code: "FORBIDDEN" });
        await tx
          .delete(conversationMembers)
          .where(
            and(
              eq(conversationMembers.conversationId, conv.id),
              eq(conversationMembers.userId, ctx.user.id)
            )
          );
        const queued = await tx
          .select({ id: messages.id })
          .from(messages)
          .where(eq(messages.conversationId, conv.id));
        if (queued.length)
          await tx.delete(messageDeliveries).where(
            and(
              inArray(
                messageDeliveries.messageId,
                queued.map(m => m.id)
              ),
              eq(messageDeliveries.recipientId, ctx.user.id)
            )
          );
        await tx.execute(
          sql`DELETE m FROM messages m LEFT JOIN message_deliveries d ON d.message_id=m.id WHERE m.conversation_id=${conv.id} AND d.id IS NULL`
        );
        await tx
          .update(conversations)
          .set({ rotationRequired: true })
          .where(eq(conversations.id, conv.id));
        return members.map(m => m.userId);
      });
      emitToUsers(affected, { type: "conversations-changed" });
      return { ok: true };
    }),
});
