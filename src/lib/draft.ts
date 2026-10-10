// Drafts are ephemeral and never written to persistent browser storage.
// The map survives React navigation inside this tab, but not a page reload.
// Each entry is scoped to the authenticated user and conversation.
const MAX_DRAFT = 4096;
const drafts = new Map<string, string>();
const LEGACY_PREFIX = "locat-draft:";

export function draftStorageKey(conversationId: number, userId: number): string {
  return `locat-draft:${userId}:${conversationId}`;
}

export function loadDraft(conversationId: number, userId: number): string {
  return drafts.get(draftStorageKey(conversationId, userId)) ?? "";
}

export function saveDraft(conversationId: number, userId: number, value: string): void {
  const key = draftStorageKey(conversationId, userId);
  const capped = value.slice(0, MAX_DRAFT);
  if (capped) drafts.set(key, capped);
  else drafts.delete(key);
}

export function clearDraft(conversationId: number, userId: number): void {
  drafts.delete(draftStorageKey(conversationId, userId));
}

/** Erase in-memory drafts on sign-out/account transitions. */
export function clearAllDrafts(): void {
  drafts.clear();
}

/**
 * Best-effort cleanup of plaintext legacy drafts created by earlier builds.
 * Run on startup and logout. No legacy content is imported into memory.
 */
export function purgeLegacyDrafts(storage: Pick<Storage, "length" | "key" | "removeItem"> | undefined =
  typeof localStorage === "undefined" ? undefined : localStorage): void {
  if (!storage) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(LEGACY_PREFIX)) keys.push(key);
    }
    for (const key of keys) storage.removeItem(key);
  } catch {
    // Browsers can disable storage access. Never block chat initialization.
  }
}
