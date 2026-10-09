import { describe, expect, it } from "vitest";
import { toEmergentConversationView, toEmergentMessageView } from "./emergentUiCompatibility";
import type { ConversationSummary } from "@contracts/types";
import type { LocalMessage } from "./localdb";

describe("Emergent presentation-only compatibility", () => {
  it("maps group summaries without exposing wrapped encryption keys", () => {
    const raw: ConversationSummary = {
      id: 12, type: "group", name: "Team", createdAt: new Date(0),
      members: [], wrappedKey: "secret-wrapped-key", wrappedBy: 1,
    };
    const view = toEmergentConversationView(raw, 2);
    expect(view).toMatchObject({ id: "12", type: "group", name: "Team", unreadCount: 2 });
    expect(JSON.stringify(view)).not.toContain("secret-wrapped-key");
  });

  it("maps decrypted local text to display props without mutating its archive", () => {
    const raw: LocalMessage = {
      mid: 24, conversationId: 12, senderId: 7, senderName: "Peer",
      outgoing: false, payload: { type: "text", text: "hello" }, createdAt: 123,
    };
    expect(toEmergentMessageView(raw)).toMatchObject({
      id: "24", conversationId: "12", senderId: "7", text: "hello",
    });
    expect(raw.payload).toEqual({ type: "text", text: "hello" });
  });

  it("does not leak attachment bytes into text presentation", () => {
    const raw: LocalMessage = {
      mid: 25, conversationId: 12, senderId: 7, senderName: "Peer",
      outgoing: false, payload: { type: "image", mime: "image/png",
        name: "image.png", dataB64: "PRIVATE_BASE64_DATA" }, createdAt: 123,
    };
    expect(toEmergentMessageView(raw).text).toBeNull();
    expect(JSON.stringify(toEmergentMessageView(raw))).not.toContain("PRIVATE_BASE64_DATA");
  });
});
