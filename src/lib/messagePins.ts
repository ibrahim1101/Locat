import type { PinState } from "@contracts/messagePayload";
import type { LocalMessage } from "./localdb";
export function projectPin(message: LocalMessage, state?: PinState): LocalMessage {
  if (!state || (message.pin && message.pin.mid >= state.mid)) return message;
  return { ...message, pin: state };
}
export function visiblePins(messages: LocalMessage[], conversationId: number) {
  return messages.filter(m => m.conversationId === conversationId && m.pin?.pinned && !m.hidden && !m.deleted)
    .sort((a, b) => b.pin!.mid - a.pin!.mid);
}
