export type ComposerStateInput = {
  hiddenMessages: boolean;
  archived: boolean;
  rotationRequired: boolean;
  blocked: boolean;
  draft: string;
};

export function messageComposerState(input: ComposerStateInput) {
  const unavailableReason = input.hiddenMessages
    ? "Return to messages to compose a reply."
    : input.archived
      ? "Archived · you are no longer a member. History stays on this device."
      : input.rotationRequired
        ? "Sending paused · the owner must rotate the group key in Group details."
        : input.blocked
          ? "Direct messaging is unavailable while this contact is blocked."
          : null;
  const composerVisible =
    !input.hiddenMessages && !input.archived && !input.rotationRequired;
  const canCompose = composerVisible && !input.blocked;
  const hasText = input.draft.trim().length > 0;

  return {
    composerVisible,
    unavailableReason,
    canAttach: canCompose,
    canType: canCompose,
    canSend: canCompose && hasText,
    sendReason: unavailableReason ?? (hasText ? null : "Write a message before sending."),
  };
}
