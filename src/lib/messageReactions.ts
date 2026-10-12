import type { ReactionEmoji } from "@contracts/messagePayload";
export type ReactionState = Record<string, { emoji: ReactionEmoji | null; mid: number }>;
/** Server relay IDs order changes; sender identity comes from relay metadata, never payload. */
export function mergeReactions(a: ReactionState = {}, b: ReactionState = {}): ReactionState {
  const result = { ...a };
  for (const [actor, state] of Object.entries(b)) {
    if (!result[actor] || state.mid > result[actor].mid) result[actor] = state;
  }
  return result;
}
export function reactionSummary(state: ReactionState = {}, myId: number) {
  const counts = new Map<ReactionEmoji, number>();
  for (const value of Object.values(state)) if (value.emoji) counts.set(value.emoji, (counts.get(value.emoji) ?? 0) + 1);
  return [...counts].map(([emoji, count]) => ({ emoji, count, mine: state[String(myId)]?.emoji === emoji }));
}
