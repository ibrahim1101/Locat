import { expect, it } from "vitest";
import type { ConversationSummary } from "@contracts/types";
import type { LocalMessage } from "./localdb";
import { searchLocalMessages, visibleConversations } from "./globalSearch";
const conversation = (id: number, member = true): ConversationSummary => ({ id, type: "group", name: `Chat ${id}`, createdAt: new Date(), members: member ? [{ id: 1, displayName: "Self" }] as ConversationSummary["members"] : [], wrappedKey: null, wrappedBy: null });
const message = (mid: number, conversationId = 1): LocalMessage => ({ mid, conversationId, senderId: 1, senderName: "Self", outgoing: true, payload: { type: "text", text: "Private orange message" }, createdAt: mid });
it("fails closed for unauthorized archived hidden conversations and hidden/deleted messages", () => {
  const conversations = [conversation(1), conversation(2), conversation(3, false), { ...conversation(4), archived: true }];
  const rows = [message(1), message(2, 2), message(3, 3), message(4, 4), { ...message(5), hidden: true }, { ...message(6), deleted: true }];
  expect(searchLocalMessages(1, conversations, [2], rows, "orange").map(result => result.mid)).toEqual([1]);
  expect(searchLocalMessages(99, conversations, [], rows, "orange")).toEqual([]);
  expect(visibleConversations(1, conversations, [2]).map(row => row.id)).toEqual([1]);
});
it("matches text and attachment filenames locally with bounded newest-first results", () => {
  const rows = [message(1), { ...message(2), payload: { type: "file" as const, name: "orange.pdf", mime: "application/pdf", dataB64: "", size: 1 } }];
  expect(searchLocalMessages(1, [conversation(1)], [], rows, "ORANGE").map(row => row.mid)).toEqual([2, 1]);
  expect(searchLocalMessages(1, [conversation(1)], [], rows, "o")).toEqual([]);
  expect(searchLocalMessages(1, [conversation(1)], [], rows, "orange", 1)).toHaveLength(1);
  expect(searchLocalMessages(1, [conversation(1)], [], rows, "orange", 0)).toEqual([]);
});
