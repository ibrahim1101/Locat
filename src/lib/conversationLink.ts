import type { ConversationSummary } from "@contracts/types";
/** Deep links only open a live member conversation visible in the ordinary list. */
export function conversationFromLink(search: string, conversations: ConversationSummary[], userId: number, hidden: Set<number>): number | null {
  const raw = new URLSearchParams(search).get("conversation");
  if (!raw || !/^[1-9][0-9]*$/.test(raw)) return null;
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || hidden.has(id)) return null;
  const conversation = conversations.find(c => c.id === id && !c.archived && c.members.some(member => member.id === userId));
  return conversation?.id ?? null;
}
