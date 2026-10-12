import type { MessageReply } from "@contracts/messagePayload";
import { messageReference, type LocalMessage } from "./localdb";
/** Resolve only within the visible, current conversation; never quote hidden/deleted content. */
export function replyPreview(reference: MessageReply, messages: LocalMessage[], conversationId: number) {
  const original = messages.find(m => m.conversationId === conversationId && m.senderId === reference.senderId &&
    messageReference(m) === reference.target);
  if (!original || original.hidden) return { label: "Original message unavailable", text: "", mid: undefined };
  if (original.deleted) return { label: "Message deleted", text: "", mid: undefined };
  const text = original.payload.type === "text" ? original.payload.text.slice(0, 160) :
    original.payload.type === "location" ? "Shared location" : original.payload.type === "voice" ? "Voice message" : original.payload.name;
  return { label: original.senderName, text, mid: original.mid };
}
