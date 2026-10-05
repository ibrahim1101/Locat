import { notifyUsers } from "./push";
import { createHash } from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { limit } from "./rateLimit";
import { observable } from "@trpc/server/observable";
import { eq, and, asc, gt, lt, inArray, sql } from "drizzle-orm";
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
} from "@db/schema";
import { subscribe as hubSubscribe, emitToUsers, onlineUserIds } from "./hub";
import type { RelayEvent } from "@contracts/types";

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
      emit.next({ type: "presence", online: onlineUserIds() });
      const unsubscribe = hubSubscribe(me, (event) => emit.next(event));
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
