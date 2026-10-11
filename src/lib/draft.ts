// Plaintext draft cache lives only in memory. encryptedDraft.ts persists authenticated
// ciphertext separately. The optional server scope isolates matching account and
// conversation IDs on different native server connections.
const MAX_DRAFT = 4096;
const drafts = new Map<string, string>();
const LEGACY_PREFIX = "locat-draft:";

export function draftStorageKey(conversationId: number, userId: number, scope = ""): string {
  return `locat-draft:${scope ? `${scope}:` : ""}${userId}:${conversationId}`;
}

export function loadDraft(conversationId: number, userId: number, scope = ""): string {
  return drafts.get(draftStorageKey(conversationId, userId, scope)) ?? "";
}

export function saveDraft(conversationId: number, userId: number, value: string, scope = ""): void {
  const key = draftStorageKey(conversationId, userId, scope);
  const capped = value.slice(0, MAX_DRAFT);
  if (capped) drafts.set(key, capped);
  else drafts.delete(key);
}

export function clearDraft(conversationId: number, userId: number, scope = ""): void {
  drafts.delete(draftStorageKey(conversationId, userId, scope));
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
