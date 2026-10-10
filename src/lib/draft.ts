// Composer drafts are stored on-device so switching conversations, closing the
// app, or jumping to the ecosystem home never loses what the user was typing.
// Drafts are not E2E encrypted at rest, matching the rest of local history.
//
// Keys are per-conversation and per-browser; nothing is uploaded to the server.
// Empty drafts are removed to avoid filling localStorage with blank entries.

const PREFIX = "locat-draft:";
const MAX_DRAFT = 4096; // Guard against runaway textareas and quota errors.

export function draftStorageKey(conversationId: number): string {
  return `${PREFIX}${conversationId}`;
}

export function loadDraft(
  conversationId: number,
  storage: Pick<Storage, "getItem"> | undefined = typeof localStorage === "undefined" ? undefined : localStorage,
): string {
  if (!storage) return "";
  try {
    return storage.getItem(draftStorageKey(conversationId)) ?? "";
  } catch {
    return "";
  }
}

export function saveDraft(
  conversationId: number,
  value: string,
  storage: Pick<Storage, "setItem" | "removeItem"> | undefined = typeof localStorage === "undefined" ? undefined : localStorage,
): void {
  if (!storage) return;
  const trimmed = value.length > MAX_DRAFT ? value.slice(0, MAX_DRAFT) : value;
  try {
    if (trimmed.length === 0) storage.removeItem(draftStorageKey(conversationId));
    else storage.setItem(draftStorageKey(conversationId), trimmed);
  } catch {
    // Private windows and quota-exceeded failures are swallowed: a lost draft
    // is better than a crashed composer, and the UI already has in-memory state.
  }
}

export function clearDraft(
  conversationId: number,
  storage: Pick<Storage, "removeItem"> | undefined = typeof localStorage === "undefined" ? undefined : localStorage,
): void {
  if (!storage) return;
  try {
    storage.removeItem(draftStorageKey(conversationId));
  } catch {
    // Best effort — matches saveDraft.
  }
}
