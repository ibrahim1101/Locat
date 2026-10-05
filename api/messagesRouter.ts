import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { eq, and, inArray, asc } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  conversationMembers,
  messages,
  messageDeliveries,
  users,
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
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const me = ctx.user!.id;
      await requireMembership(input.conversationId, me);

      const [{ id: messageId }] = await db
        .insert(messages)
        .values({
          conversationId: input.conversationId,
          senderId: me,
          envelope: input.envelope,
        })
        .$returningId();

      const members = await db
        .select({ userId: conversationMembers.userId })
        .from(conversationMembers)
        .where(eq(conversationMembers.conversationId, input.conversationId));
      // Every member gets a delivery row — including the sender, so the
      // sender's *other devices* receive their own messages too (the
      // originating device dedupes by message id).
      const recipients = members.map((m) => m.userId);

      const deliveryIds = new Map<number, number>();
      for (const recipientId of recipients) {
        const [{ id }] = await db
          .insert(messageDeliveries)
          .values({ messageId, recipientId })
          .$returningId();
        deliveryIds.set(recipientId, id);
      }

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
          createdAt: new Date(),
        };
        emitToUsers([recipientId], event);
      }

      return { messageId };
    }),

  /**
   * Fetch everything still queued for me (offline backlog). The client
   * decrypts + stores locally, then calls ack() so the relay deletes it.
   */
  sync: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const me = ctx.user!.id;
    const rows = await db
      .select({
        deliveryId: messageDeliveries.id,
        messageId: messages.id,
        conversationId: messages.conversationId,
        senderId: messages.senderId,
        senderName: users.displayName,
        envelope: messages.envelope,
        createdAt: messages.createdAt,
      })
      .from(messageDeliveries)
      .innerJoin(messages, eq(messageDeliveries.messageId, messages.id))
      .innerJoin(users, eq(messages.senderId, users.id))
      .where(eq(messageDeliveries.recipientId, me))
      .orderBy(asc(messages.id))
      .limit(500);
    return rows;
  }),

  /** Acknowledge delivery — the relay deletes what it no longer needs. */
  ack: authedQuery
    .input(z.object({ messageIds: z.array(z.number().int().positive()).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const me = ctx.user!.id;
      await db
        .delete(messageDeliveries)
        .where(
          and(
            eq(messageDeliveries.recipientId, me),
            inArray(messageDeliveries.messageId, input.messageIds),
          ),
        );

      // delete messages whose deliveries are all gone — nothing is kept
      let purged = 0;
      for (const messageId of input.messageIds) {
        const remaining = await db
          .select({ id: messageDeliveries.id })
          .from(messageDeliveries)
          .where(eq(messageDeliveries.messageId, messageId))
          .limit(1);
        if (remaining.length === 0) {
          await db.delete(messages).where(eq(messages.id, messageId));
          purged++;
        }
      }
      return { purged };
    }),

  /** Realtime stream: new messages + presence, over tRPC SSE subscriptions. */
  subscribe: authedQuery.subscription(({ ctx }) => {
    const me = ctx.user!.id;
    return observable<RelayEvent>((emit) => {
      emit.next({ type: "presence", online: onlineUserIds() });
      const unsubscribe = hubSubscribe(me, (event) => emit.next(event));
      return unsubscribe;
    });
  }),
});
