/**
 * Presentation-only bridge for the Emergent Locat UI kit.
 * This module must never handle keys, ciphertext, delivery ACKs, or persistence.
 * Security-critical operations stay in the existing Chat and auth state flows.
 */
import type { ConversationSummary, MessagePayload } from "@contracts/types";
import type { LocalMessage } from "./localdb";

export interface EmergentConversationView {
  id: string;
  type: "direct" | "group";
  name?: string;
  unreadCount: number;
  lastActivityAt: number;
}

export interface EmergentMessageView {
  id: string;
  conversationId: string;
  senderId: string;
  outgoing: boolean;
  text: string | null;
  createdAt: number;
}

/** Stable display mapping; does not persist, decrypt, or send messages. */
export function toEmergentConversationView(
  conversation: ConversationSummary,
  unreadCount = 0,
): EmergentConversationView {
  return {
    id: String(conversation.id),
    type: conversation.type === "group" ? "group" : "direct",
    name: conversation.name ?? undefined,
    unreadCount: Math.max(0, Math.trunc(unreadCount)),
    lastActivityAt: 0, // Supplied by the UI's local message timeline, never guessed from server.
  };
}

export function toEmergentMessageView(message: LocalMessage): EmergentMessageView {
  const payload: MessagePayload = message.payload;
  return {
    id: String(message.mid),
    conversationId: String(message.conversationId),
    senderId: String(message.senderId),
    outgoing: message.outgoing,
    text: payload.type === "text" ? payload.text : null,
    createdAt: message.createdAt,
  };
}
