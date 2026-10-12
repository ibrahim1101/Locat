import { createHash } from "node:crypto";
import { and, asc, eq, lt, lte, ne, or, sql } from "drizzle-orm";
import { getDb } from "./queries/connection";
import { contactRelationships, conversationMembers, conversations, messageDeliveries,
  messages, scheduledMessages, sendReceipts, userBlocks, users } from "@db/schema";
import { emitToUsers, onlineUserIds } from "./hub";
import { notifyUsers } from "./push";
import type { RelayEvent } from "@contracts/types";

export type ScheduledFailureCode = "account_disabled" | "membership_changed" | "destination_unavailable" | "key_epoch_changed";

type SelectDatabase = Pick<ReturnType<typeof getDb>, "select">;
type ScheduledDestination = Pick<typeof scheduledMessages.$inferSelect, "senderId" | "conversationId" | "groupEpoch">;
export async function scheduledDestinationFailure(tx: SelectDatabase, row: ScheduledDestination): Promise<ScheduledFailureCode | null> {
  const [sender] = await tx.select({ disabled: users.disabled }).from(users).where(eq(users.id, row.senderId)).limit(1);
  if (!sender || sender.disabled) return "account_disabled";
  const [conversation] = await tx.select().from(conversations).where(eq(conversations.id, row.conversationId)).limit(1);
  const [membership] = await tx.select({ id: conversationMembers.id }).from(conversationMembers).where(and(
    eq(conversationMembers.conversationId, row.conversationId), eq(conversationMembers.userId, row.senderId))).limit(1);
  if (!conversation || !membership) return "membership_changed";
  if (conversation.type === "group") {
    if (conversation.rotationRequired || row.groupEpoch !== conversation.groupEpoch) return "key_epoch_changed";
    return null;
  }
  const [peer] = await tx.select({ id: conversationMembers.userId }).from(conversationMembers).where(and(
    eq(conversationMembers.conversationId, row.conversationId), sql`${conversationMembers.userId} <> ${row.senderId}`)).limit(1);
  if (!peer) return "destination_unavailable";
  const [blocked] = await tx.select({ id: userBlocks.id }).from(userBlocks).where(or(
    and(eq(userBlocks.blockerId, row.senderId), eq(userBlocks.blockedId, peer.id)),
    and(eq(userBlocks.blockerId, peer.id), eq(userBlocks.blockedId, row.senderId)))).limit(1);
  const low = Math.min(row.senderId, peer.id), high = Math.max(row.senderId, peer.id);
  const [contact] = await tx.select({ id: contactRelationships.id }).from(contactRelationships).where(and(
    eq(contactRelationships.userLowId, low), eq(contactRelationships.userHighId, high),
    eq(contactRelationships.status, "accepted"))).limit(1);
  return blocked || !contact ? "destination_unavailable" : null;
}

/**
 * Atomically releases due ciphertext. Every row is locked and revalidated,
 * making this safe across restarts and multiple server workers.
 */
export async function releaseScheduledMessages(now = new Date(), limit = 25): Promise<number> {
  const db = getDb();
  await db.delete(scheduledMessages).where(and(ne(scheduledMessages.state, "pending"),
    lt(scheduledMessages.updatedAt, new Date(now.getTime() - 7 * 86400000))));
  const candidates = await db.select({ id: scheduledMessages.id }).from(scheduledMessages)
    .where(and(eq(scheduledMessages.state, "pending"), lte(scheduledMessages.deliverAt, now)))
    .orderBy(asc(scheduledMessages.deliverAt)).limit(limit);
  let released = 0;
  for (const candidate of candidates) {
    const result = await db.transaction(async tx => {
      const [row] = await tx.select().from(scheduledMessages).where(eq(scheduledMessages.id, candidate.id)).for("update");
      if (!row || row.state !== "pending" || row.deliverAt > now) return null;
      const envelope = row.envelope;
      if (!envelope) {
        await tx.update(scheduledMessages).set({ state: "failed", failureCode: "destination_unavailable", updatedAt: now })
          .where(eq(scheduledMessages.id, row.id));
        return null;
      }
      const failure = await scheduledDestinationFailure(tx, row);
      if (failure) {
        await tx.update(scheduledMessages).set({ state: "failed", failureCode: failure, envelope: null, updatedAt: now })
          .where(eq(scheduledMessages.id, row.id));
        return null;
      }
      const [existing] = await tx.select().from(sendReceipts).where(and(
        eq(sendReceipts.senderId, row.senderId), eq(sendReceipts.clientMessageId, row.clientMessageId))).limit(1);
      if (existing) {
        if (existing.conversationId !== row.conversationId || existing.envelopeHash !== row.envelopeHash)
          throw new Error("Scheduled retry receipt mismatch");
        await tx.update(scheduledMessages).set({ state: "delivered", messageId: existing.messageId, envelope: null, updatedAt: now })
          .where(eq(scheduledMessages.id, row.id));
        return null;
      }
      const createdAt = new Date(Math.floor(now.getTime() / 1000) * 1000);
      const [{ id: messageId }] = await tx.insert(messages).values({ conversationId: row.conversationId,
        senderId: row.senderId, envelope, clientMessageId: row.clientMessageId, createdAt }).$returningId();
      const members = await tx.select({ userId: conversationMembers.userId }).from(conversationMembers)
        .where(eq(conversationMembers.conversationId, row.conversationId));
      const deliveryIds = new Map<number, number>();
      for (const member of members) {
        const [{ id }] = await tx.insert(messageDeliveries).values({ messageId, recipientId: member.userId }).$returningId();
        deliveryIds.set(member.userId, id);
      }
      await tx.insert(sendReceipts).values({ senderId: row.senderId, clientMessageId: row.clientMessageId,
        messageId, conversationId: row.conversationId, envelopeHash: row.envelopeHash, createdAt });
      await tx.update(scheduledMessages).set({ state: "delivered", messageId, envelope: null, updatedAt: now })
        .where(eq(scheduledMessages.id, row.id));
      const [sender] = await tx.select({ displayName: users.displayName }).from(users).where(eq(users.id, row.senderId));
      return { row, envelope, messageId, createdAt, recipients: members.map(member => member.userId), deliveryIds,
        senderName: sender?.displayName ?? "Locat user" };
    });
    if (!result) continue;
    released++;
    for (const recipientId of result.recipients.filter(id => onlineUserIds().includes(id))) {
      const event: RelayEvent = { type: "message", deliveryId: result.deliveryIds.get(recipientId)!,
        messageId: result.messageId, conversationId: result.row.conversationId, senderId: result.row.senderId,
        senderName: result.senderName, envelope: result.envelope, createdAt: result.createdAt };
      emitToUsers([recipientId], event);
    }
    void notifyUsers(result.recipients.filter(id => id !== result.row.senderId)).catch(() => {});
  }
  return released;
}

export const scheduledEnvelopeHash = (envelope: string) => createHash("sha256").update(envelope).digest("hex");
