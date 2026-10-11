import { expect, it } from "vitest";
import { conversationFromLink } from "./conversationLink";
import type { ConversationSummary } from "@contracts/types";
const conversation = { id: 4, archived: false, members: [{ id: 7 }] } as ConversationSummary;
it("opens only current visible member conversations from deep links", () => {
  expect(conversationFromLink("?conversation=4", [conversation], 7, new Set())).toBe(4);
  for (const value of ["-4", "0", "4x", "4.0", "9007199254740992", "8"]) expect(conversationFromLink(`?conversation=${value}`, [conversation], 7, new Set())).toBeNull();
  expect(conversationFromLink("?conversation=4", [conversation], 8, new Set())).toBeNull();
  expect(conversationFromLink("?conversation=4", [conversation], 7, new Set([4]))).toBeNull();
  expect(conversationFromLink("?conversation=4", [{ ...conversation, archived: true }], 7, new Set())).toBeNull();
});
