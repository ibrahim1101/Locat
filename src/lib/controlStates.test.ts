import { describe, expect, it } from "vitest";
import { messageComposerState } from "./controlStates";

const available = {
  hiddenMessages: false,
  archived: false,
  rotationRequired: false,
  blocked: false,
};

describe("messageComposerState", () => {
  it("enables composition when the conversation is available", () => {
    expect(messageComposerState({ ...available, draft: " hello " })).toMatchObject({
      composerVisible: true,
      unavailableReason: null,
      canAttach: true,
      canType: true,
      canSend: true,
      sendReason: null,
    });
  });

  it("explains why an empty message cannot be sent", () => {
    expect(messageComposerState({ ...available, draft: "  " })).toMatchObject({
      canAttach: true,
      canType: true,
      canSend: false,
      sendReason: "Write a message before sending.",
    });
  });

  it.each([
    ["hidden messages", { hiddenMessages: true }, "Return to messages"],
    ["an archived conversation", { archived: true }, "Archived"],
    ["pending key rotation", { rotationRequired: true }, "rotate the group key"],
  ])("replaces the composer for %s", (_label, change, reason) => {
    const state = messageComposerState({ ...available, ...change, draft: "hello" });
    expect(state.composerVisible).toBe(false);
    expect(state.canAttach).toBe(false);
    expect(state.canType).toBe(false);
    expect(state.canSend).toBe(false);
    expect(state.unavailableReason).toContain(reason);
  });

  it("keeps blocked controls visible but consistently disables them", () => {
    expect(
      messageComposerState({ ...available, blocked: true, draft: "hello" })
    ).toMatchObject({
      composerVisible: true,
      canAttach: false,
      canType: false,
      canSend: false,
      unavailableReason: "Direct messaging is unavailable while this contact is blocked.",
    });
  });
});
