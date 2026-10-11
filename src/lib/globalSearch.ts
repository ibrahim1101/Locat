import type { ConversationSummary } from "@contracts/types";
import type { LocalMessage } from "./localdb";
export type LocalSearchResult = { conversationId: number; conversationName: string; mid: number; senderName: string; createdAt: number; snippet: string; type: "text" | "file" | "image" };
export function visibleConversations(userId: number, conversations: ConversationSummary[], hidden: number[]): ConversationSummary[] {
  const excluded = new Set(hidden);
  return conversations.filter(conversation => !conversation.archived && !excluded.has(conversation.id) && conversation.members.some(member => member.id === userId));
}
export function conversationTitle(conversation: ConversationSummary, userId: number): string {
  return conversation.name || conversation.members.filter(member => member.id !== userId).map(member => member.displayName || member.username).join(", ") || "Conversation";
}
export function searchLocalMessages(userId: number, conversations: ConversationSummary[], hidden: number[], messages: LocalMessage[], query: string, limit = 100): LocalSearchResult[] {
  const term = query.trim().slice(0, 200).toLocaleLowerCase();
  if (term.length < 2) return [];
  const allowed = new Map(visibleConversations(userId, conversations, hidden).map(conversation => [conversation.id, conversation]));
  const results: LocalSearchResult[] = [];
  for (const message of messages) {
    const conversation = allowed.get(message.conversationId);
    if (!conversation || message.deleted || message.hidden) continue;
    const payload = message.payload;
    const text = payload.type === "text" ? payload.text : payload.type === "file" || payload.type === "image" ? payload.name : "";
    const index = text.toLocaleLowerCase().indexOf(term);
    if (index < 0 || !["text", "file", "image"].includes(payload.type)) continue;
    const start = Math.max(0, index - 60);
    results.push({ conversationId: conversation.id, conversationName: conversationTitle(conversation, userId), mid: message.mid, senderName: message.senderName, createdAt: message.createdAt, snippet: `${start ? "…" : ""}${text.slice(start, start + 200)}${text.length > start + 200 ? "…" : ""}`, type: payload.type as LocalSearchResult["type"] });
  }
  return results.sort((a, b) => b.createdAt - a.createdAt || b.mid - a.mid).slice(0, Math.max(0, Math.min(100, limit)));
}
