import { notifyUsers } from "./push";
import { createHash } from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { limit } from "./rateLimit";
import { observable } from "@trpc/server/observable";
import { eq, and, asc, desc, gt, lt, inArray, sql, or } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  conversations,
  conversationMembers,
  messages,
  messageDeliveries,
  users,
  sendReceipts,
  sessions,
  userBlocks,
  contactRelationships,
  scheduledMessages,
} from "@db/schema";
import { subscribe as hubSubscribe, emitToUsers, onlineUserIds, visibleOnlineUserIds, heartbeat } from "./hub";
import type { RelayEvent } from "@contracts/types";
import { releaseScheduledMessages, scheduledDestinationFailure, scheduledEnvelopeHash, scheduledDirectKeyContext } from "./scheduledMessages";

/** Envelopes are opaque ciphertext; cap at ~6MB of base64 (≈4MB media). */
const envelopeSchema = z.string().min(2).max(6_000_000);

async function requireMembership(conversationId: number, userId: number) {
  const db = getDb();
  const rows = await db
    .select()
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, userId),
      ),
    )
    .limit(1);
  if (rows.length === 0) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not a member" });
  }
}

export const messagesRouter = createRouter({
  schedule: authedQuery.input(z.object({
    conversationId: z.number().int().positive(), envelope: envelopeSchema,
    clientMessageId: z.string().uuid(), deliverAt: z.coerce.date(),
  })).mutation(async ({ ctx, input }) => {
    const db = getDb(), me = ctx.user!.id, now = Date.now();
    const deliverAt = new Date(Math.floor(input.deliverAt.getTime() / 1000) * 1000);
    const hash = scheduledEnvelopeHash(input.envelope);
    const [existing] = await db.select().from(scheduledMessages).where(and(
      eq(scheduledMessages.senderId, me), eq(scheduledMessages.clientMessageId, input.clientMessageId))).limit(1);
    if (existing) {
      if (existing.conversationId !== input.conversationId || existing.envelopeHash !== hash ||
          existing.deliverAt.getTime() !== deliverAt.getTime())
        throw new TRPCError({ code: "CONFLICT", message: "Scheduled retry does not match the original" });
      return { id: existing.id, state: existing.state, deliverAt: existing.deliverAt };
    }
    if (deliverAt.getTime() < now + 30_000 || deliverAt.getTime() > now + 30 * 86400000)
      throw new TRPCError({ code: "BAD_REQUEST", message: "Schedule messages from 30 seconds to 30 days ahead" });
    await requireMembership(input.conversationId, me);
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, input.conversationId)).limit(1);
    if (!conversation) throw new TRPCError({ code: "NOT_FOUND" });
    let groupEpoch: number | null = null;
    if (conversation.type === "group") {
      try { groupEpoch = JSON.parse(input.envelope).groupEpoch; } catch { /* rejected below */ }
      if (!Number.isInteger(groupEpoch) || groupEpoch !== conversation.groupEpoch || conversation.rotationRequired)
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Group encryption changed. Refresh before scheduling." });
    }
    const destinationFailure = await scheduledDestinationFailure(db, { senderId: me,
      conversationId: input.conversationId, groupEpoch });
    if (destinationFailure) throw new TRPCError({ code: "FORBIDDEN", message: "Conversation is no longer available" });
    limit(`schedule:${me}`, 120, 60000);
    const id = await db.transaction(async tx => {
      await tx.select({ id: conversations.id }).from(conversations).where(eq(conversations.id, input.conversationId)).for("update");
      const keyContext = await scheduledDirectKeyContext(tx, input.conversationId);
      if (await scheduledDestinationFailure(tx, { senderId: me, conversationId: input.conversationId, groupEpoch }))
        throw new TRPCError({ code: "FORBIDDEN", message: "Conversation is no longer available" });
      const [receipt] = await tx.select({ id: sendReceipts.id }).from(sendReceipts).where(and(
        eq(sendReceipts.senderId, me), eq(sendReceipts.clientMessageId, input.clientMessageId))).limit(1).for("update");
      if (receipt) throw new TRPCError({ code: "CONFLICT", message: "Retry ID already belongs to a sent message" });
      const [{ count, bytes }] = await tx.select({ count: sql<number>`COUNT(*)`,
        bytes: sql<number>`COALESCE(SUM(OCTET_LENGTH(${scheduledMessages.envelope})), 0)` }).from(scheduledMessages)
        .where(and(eq(scheduledMessages.senderId, me), eq(scheduledMessages.state, "pending")));
      if (Number(count) >= 100 || Number(bytes) + Buffer.byteLength(input.envelope) > 100_000_000)
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Scheduled message storage limit reached" });
      const [created] = await tx.insert(scheduledMessages).values({ senderId: me, conversationId: input.conversationId,
        clientMessageId: input.clientMessageId, envelope: input.envelope, envelopeHash: hash,
        groupEpoch, directKeyContext: conversation.type === "direct" ? keyContext : null, deliverAt }).$returningId();
      return created.id;
    }).catch(async error => {
      const [concurrent] = await db.select().from(scheduledMessages).where(and(
        eq(scheduledMessages.senderId, me), eq(scheduledMessages.clientMessageId, input.clientMessageId))).limit(1);
      if (!concurrent) throw error;
      if (concurrent.conversationId !== input.conversationId || concurrent.envelopeHash !== hash ||
          concurrent.deliverAt.getTime() !== deliverAt.getTime())
        throw new TRPCError({ code: "CONFLICT", message: "Scheduled retry does not match the original" });
      return { id: concurrent.id, state: concurrent.state, deliverAt: concurrent.deliverAt };
    });
    if (typeof id !== "number") return id;
    return { id, state: "pending" as const, deliverAt };
  }),

  scheduled: authedQuery.query(async ({ ctx }) => {
    await releaseScheduledMessages();
    return getDb().select({ id: scheduledMessages.id, conversationId: scheduledMessages.conversationId,
      clientMessageId: scheduledMessages.clientMessageId, deliverAt: scheduledMessages.deliverAt,
      state: scheduledMessages.state, messageId: scheduledMessages.messageId, failureCode: scheduledMessages.failureCode })
      .from(scheduledMessages).where(eq(scheduledMessages.senderId, ctx.user!.id))
      .orderBy(sql`CASE WHEN ${scheduledMessages.state} = 'pending' THEN 0 ELSE 1 END`,
        sql`CASE WHEN ${scheduledMessages.state} = 'pending' THEN ${scheduledMessages.deliverAt} END ASC`,
        desc(scheduledMessages.updatedAt)).limit(150);
  }),

  cancelScheduled: authedQuery.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const result = await getDb().update(scheduledMessages).set({ state: "cancelled", envelope: null, updatedAt: new Date() }).where(and(
      eq(scheduledMessages.id, input.id), eq(scheduledMessages.senderId, ctx.user!.id), eq(scheduledMessages.state, "pending")));
    if (result[0].affectedRows !== 1) throw new TRPCError({ code: "CONFLICT", message: "Scheduled message is no longer cancellable" });
    return { cancelled: true };
  }),

  /** Presence heartbeat works over normal authenticated HTTP on Android and web. */
  presence: authedQuery.query(async ({ ctx }) => {
    heartbeat(ctx.user!.id);
    return { online: await visibleOnlineUserIds(ctx.user!.id) };
  }),

  /**
   * Send an encrypted envelope. The relay stores it transiently, pushes it
   * to online recipients immediately, and deletes it once every recipient
   * has acknowledged delivery.
   */
  send: authedQuery
    .input(
      z.object({
        conversationId: z.number().int().positive(),
        envelope: envelopeSchema,
        clientMessageId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const me = ctx.user!.id;
      await requireMembership(input.conversationId, me);
      const [directPeer] = await db.select({ id: conversationMembers.userId }).from(conversationMembers)
        .innerJoin(conversations, eq(conversationMembers.conversationId, conversations.id))
        .where(and(eq(conversationMembers.conversationId, input.conversationId), eq(conversations.type, "direct"),
          sql`${conversationMembers.userId} <> ${me}`)).limit(1);
      if (directPeer) {
        const [blocked] = await db.select({ id: userBlocks.id }).from(userBlocks).where(or(
          and(eq(userBlocks.blockerId, me), eq(userBlocks.blockedId, directPeer.id)),
          and(eq(userBlocks.blockerId, directPeer.id), eq(userBlocks.blockedId, me)),
        )).limit(1);
        if (blocked) throw new TRPCError({ code: "FORBIDDEN", message: "Direct contact is blocked" });
        const low = Math.min(me, directPeer.id), high = Math.max(me, directPeer.id);
        const [contact] = await db.select({ id: contactRelationships.id }).from(contactRelationships).where(and(
          eq(contactRelationships.userLowId, low), eq(contactRelationships.userHighId, high),
          eq(contactRelationships.status, "accepted"),
        )).limit(1);
        if (!contact) throw new TRPCError({ code: "FORBIDDEN", message: "Direct contact is no longer accepted" });
      }

      const [reserved] = await db.select({ id: scheduledMessages.id }).from(scheduledMessages).where(and(
        eq(scheduledMessages.senderId, me), eq(scheduledMessages.clientMessageId, input.clientMessageId))).limit(1);
      if (reserved) throw new TRPCError({ code: "CONFLICT", message: "Retry ID belongs to a scheduled message" });
      const envelopeHash = createHash("sha256").update(input.envelope).digest("hex");
      await db.delete(sendReceipts).where(lt(sendReceipts.createdAt, new Date(Date.now() - 7 * 86400000)));
      const findExisting = async () => {
        const [existing] = await db.select().from(sendReceipts).where(and(
          eq(sendReceipts.senderId, me), eq(sendReceipts.clientMessageId, input.clientMessageId),
        )).limit(1);
        if (existing && (existing.conversationId !== input.conversationId || existing.envelopeHash !== envelopeHash)) {
          throw new TRPCError({ code: "CONFLICT", message: "Message retry does not match the original" });
        }
        return existing;
      };
      const existing = await findExisting();
      if (existing) return { messageId: existing.messageId, createdAt: existing.createdAt };
      limit(`send:${me}`, 1200, 60000);
      // Commit the envelope and every delivery together. Never publish before commit.
      const { messageId, recipients, deliveryIds, createdAt } = await db.transaction(async (tx) => {
        const [conversation] = await tx.select().from(conversations).where(eq(conversations.id,input.conversationId)).for("update");
        const [membership] = await tx.select({id:conversationMembers.id}).from(conversationMembers).where(and(eq(conversationMembers.conversationId,input.conversationId),eq(conversationMembers.userId,me)));
        if(!conversation || !membership) throw new TRPCError({code:"FORBIDDEN",message:"Not a member"});
        if(conversation.type === "group") {
          let epoch = 1;
          try { epoch = JSON.parse(input.envelope).groupEpoch ?? 1; } catch { throw new TRPCError({code:"BAD_REQUEST",message:"Invalid group envelope"}); }
          if(conversation.rotationRequired || epoch !== conversation.groupEpoch) throw new TRPCError({code:"PRECONDITION_FAILED",message:"Group encryption changed. Refresh and retry after the owner rotates the key."});
        }
        await tx.select({ id: users.id }).from(users).where(eq(users.id, me)).for("update");
        const [scheduled] = await tx.select({ id: scheduledMessages.id }).from(scheduledMessages).where(and(
          eq(scheduledMessages.senderId, me), eq(scheduledMessages.clientMessageId, input.clientMessageId))).limit(1).for("update");
        if (scheduled) throw new TRPCError({ code: "CONFLICT", message: "Retry ID belongs to a scheduled message" });
        const [queued] = await tx.select({ bytes: sql<number>`COALESCE(SUM(OCTET_LENGTH(${messages.envelope})), 0)` }).from(messages).where(eq(messages.senderId, me));
        if (Number(queued.bytes) + Buffer.byteLength(input.envelope) > 100_000_000) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Your undelivered queue is full. Wait for recipients to connect." });
        const createdAt = new Date(Math.floor(Date.now() / 1000) * 1000);
        const [{ id: messageId }] = await tx.insert(messages).values({
          conversationId: input.conversationId, senderId: me,
          envelope: input.envelope, createdAt, clientMessageId: input.clientMessageId,
        }).$returningId();
        const members = await tx.select({ userId: conversationMembers.userId })
          .from(conversationMembers)
          .where(eq(conversationMembers.conversationId, input.conversationId));
        const recipients = members.map((m) => m.userId);
        const deliveryIds = new Map<number, number>();
        for (const recipientId of recipients) {
          const [{ id }] = await tx.insert(messageDeliveries)
            .values({ messageId, recipientId }).$returningId();
          deliveryIds.set(recipientId, id);
        }
        await tx.insert(sendReceipts).values({ senderId: me, clientMessageId: input.clientMessageId,
          messageId, conversationId: input.conversationId, envelopeHash, createdAt });
        return { messageId, recipients, deliveryIds, createdAt };
      }).catch(async (error: unknown) => {
        // A concurrent retry may have committed the same receipt first.
        const receipt = await findExisting();
        if (!receipt) throw error;
        return { messageId: receipt.messageId, createdAt: receipt.createdAt,
          recipients: [] as number[], deliveryIds: new Map<number, number>() };
      });

      // push to online recipients right away
      const online = recipients.filter((id) => onlineUserIds().includes(id));
      for (const recipientId of online) {
        const event: RelayEvent = {
          type: "message",
          deliveryId: deliveryIds.get(recipientId)!,
          messageId,
          conversationId: input.conversationId,
          senderId: me,
          senderName: ctx.user!.displayName,
          envelope: input.envelope,
          createdAt,
        };
        emitToUsers([recipientId], event);
      }

      void notifyUsers(recipients.filter(id => id !== me)).catch(() => {});
      return { messageId, createdAt };
    }),

  /**
   * Fetch everything still queued for me (offline backlog). The client
   * decrypts + stores locally, then calls ack() so the relay deletes it.
   */
  sync: authedQuery
    .input(z.object({ after: z.number().int().nonnegative().default(0) }).optional())
    .query(async ({ ctx, input }) => {
    const db = getDb();
    const me = ctx.user!.id;
    // Read only IDs and sizes first: do not load dozens of large media envelopes.
    const candidates = await db.select({ messageId: messages.id,
      bytes: sql<number>`OCTET_LENGTH(${messages.envelope})` })
      .from(messageDeliveries).innerJoin(messages, eq(messageDeliveries.messageId, messages.id))
      .where(and(eq(messageDeliveries.recipientId, me), gt(messages.id, input?.after ?? 0)))
      .orderBy(asc(messages.id)).limit(51);
    const ids: number[] = [];
    let bytes = 0;
    for (const row of candidates.slice(0, 50)) {
      if (ids.length > 0 && bytes + Number(row.bytes) > 8_000_000) break;
      ids.push(row.messageId);
      bytes += Number(row.bytes);
    }
    const items = ids.length === 0 ? [] : await db.select({
      deliveryId: messageDeliveries.id, messageId: messages.id,
      conversationId: messages.conversationId, senderId: messages.senderId,
      senderName: users.displayName, envelope: messages.envelope, createdAt: messages.createdAt,
    }).from(messageDeliveries)
      .innerJoin(messages, eq(messageDeliveries.messageId, messages.id))
      .innerJoin(users, eq(messages.senderId, users.id))
      .where(and(eq(messageDeliveries.recipientId, me), inArray(messages.id, ids)))
      .orderBy(asc(messages.id));
    return { items, nextCursor: candidates.length > ids.length ? ids.at(-1)! : null };
  }),

  /** Acknowledge delivery — the relay deletes what it no longer needs. */
  ack: authedQuery
    .input(z.object({ messageIds: z.array(z.number().int().positive()).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const me = ctx.user!.id;
      if (input.messageIds.length === 0) return { purged: 0 };
      // Same lock order for concurrent acknowledgements; only touch owned deliveries.
      const ids = [...new Set(input.messageIds)].sort((a, b) => a - b);
      const purged = await db.transaction(async (tx) => {
        let purged = 0;
        for (const id of ids) {
          const [message] = await tx.select({ id: messages.id }).from(messages)
            .where(eq(messages.id, id)).for("update");
          if (!message) continue;
          const [owned] = await tx.select({ id: messageDeliveries.id }).from(messageDeliveries)
            .where(and(eq(messageDeliveries.messageId, id), eq(messageDeliveries.recipientId, me)));
          if (!owned) continue;
          await tx.delete(messageDeliveries).where(eq(messageDeliveries.id, owned.id));
          const [remaining] = await tx.select({ id: messageDeliveries.id }).from(messageDeliveries)
            .where(eq(messageDeliveries.messageId, id)).limit(1);
          if (!remaining) { await tx.delete(messages).where(eq(messages.id, id)); purged++; }
        }
        return purged;
      });
      return { purged };
    }),

  /** Realtime stream: new messages + presence, over tRPC SSE subscriptions. */
  subscribe: authedQuery.subscription(({ ctx }) => {
    const me = ctx.user!.id;
    return observable<RelayEvent>((emit) => {
      const unsubscribe = hubSubscribe(me, (event) => emit.next(event));
      void visibleOnlineUserIds(me).then(online => emit.next({ type: "presence", online }))
        .catch(() => emit.error(new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not load presence" })));
      const timer = setInterval(() => {
        if (!ctx.sessionToken) return;
        void getDb().select({ token: sessions.token }).from(sessions).innerJoin(users, eq(sessions.userId, users.id))
          .where(and(eq(sessions.token, ctx.sessionToken), eq(users.disabled, false), gt(sessions.expiresAt, new Date())))
          .then((rows) => { if (!rows.length) { emit.error(new TRPCError({ code: "UNAUTHORIZED", message: "Session ended. Sign in again." })); unsubscribe(); clearInterval(timer); } })
          .catch(() => { emit.error(new TRPCError({ code: "INTERNAL_SERVER_ERROR" })); unsubscribe(); clearInterval(timer); });
      }, 30000);
      return () => { clearInterval(timer); unsubscribe(); };
    });
  }),
});
