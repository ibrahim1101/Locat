import { messagePayloadSchema } from "@contracts/messagePayload";
import type { MessagePayload, ConversationSummary } from "@contracts/types";
/** Copy content only; a fresh message reference and destination encryption are applied by sendPayload. */
export function forwardPayload(payload: MessagePayload): MessagePayload {
  const original = messagePayloadSchema.parse(payload);
  const content = { ...original };
  delete content.messageRef;
  delete content.replyTo;
  return { ...content, forwarded: true };
}
export function forwardDestinations(conversations: ConversationSummary[], myId: number, hidden: Set<number>, blocked: Set<number>) {
  return conversations.filter(conv => !conv.archived && !conv.rotationRequired && !hidden.has(conv.id) &&
    conv.members.some(member => member.id === myId) &&
    !(conv.type === "direct" && conv.members.some(member => member.id !== myId && blocked.has(member.id))));
}
