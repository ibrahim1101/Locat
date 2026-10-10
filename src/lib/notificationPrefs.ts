// Client-side notification preferences for Locat 2.0.
//
// Web Push payloads from the server never contain plaintext message content
// (see docs/NOTIFICATIONS.md). These preferences shape what the device does
// with each incoming event: which categories alert the user, which
// conversations are muted on this device, and when quiet hours silence the
// bar entirely. They never travel to the server.
//
// Pure logic lives here so the rules can be unit-tested without React.

export type NotificationCategory =
  | "messages"
  | "sentinel"
  | "sessions"
  | "transfers"
  | "system";

export const NOTIFICATION_CATEGORIES: ReadonlyArray<{
  id: NotificationCategory;
  label: string;
  description: string;
}> = [
  {
    id: "messages",
    label: "Direct and group messages",
    description: "New text, voice, image or file messages in your conversations.",
  },
  {
    id: "sentinel",
    label: "Sentinel security alerts",
    description: "Severity alerts from Sentinel-connected cybersecurity feeds.",
  },
  {
    id: "sessions",
    label: "Session and device changes",
    description: "New sign-ins, revoked devices and identity-key events.",
  },
  {
    id: "transfers",
    label: "File transfers",
    description: "Encrypted file transfer failures and completions through Link.",
  },
  {
    id: "system",
    label: "System and sync alerts",
    description: "Backup reminders, sync warnings and important server notices.",
  },
];

export type QuietHours = {
  enabled: boolean;
  /** Hour of day in 24h local time (0–23). */
  startHour: number;
  endHour: number;
};

export type NotificationPrefs = {
  version: 1;
  foregroundAlerts: boolean;
  categories: Record<NotificationCategory, boolean>;
  mutedConversationIds: number[];
  quietHours: QuietHours;
};

export const DEFAULT_PREFS: NotificationPrefs = {
  version: 1,
  foregroundAlerts: true,
  categories: {
    messages: true,
    sentinel: true,
    sessions: true,
    transfers: true,
    system: true,
  },
  mutedConversationIds: [],
  quietHours: { enabled: false, startHour: 22, endHour: 7 },
};

const STORAGE_KEY = "locat-notification-prefs-v1";
export const PREFS_EVENT = "locat-notification-prefs-change";

export type PrefsStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): PrefsStorage | undefined {
  return typeof localStorage === "undefined" ? undefined : localStorage;
}

export function loadPrefs(storage: PrefsStorage | undefined = defaultStorage()): NotificationPrefs {
  if (!storage) return { ...DEFAULT_PREFS };
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
    return mergeWithDefaults(parsed);
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(
  next: NotificationPrefs,
  storage: PrefsStorage | undefined = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Best-effort; a muted-conversation list that cannot persist still
    // mutes for the lifetime of the current tab.
  }
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent(PREFS_EVENT));
    } catch {
      // CustomEvent may be unavailable in server-rendered contexts.
    }
  }
}

export function updatePrefs(
  patch: Partial<NotificationPrefs>,
  storage: PrefsStorage | undefined = defaultStorage(),
): NotificationPrefs {
  const current = loadPrefs(storage);
  const next = mergeWithDefaults({ ...current, ...patch });
  savePrefs(next, storage);
  return next;
}

export function toggleMutedConversation(
  conversationId: number,
  storage: PrefsStorage | undefined = defaultStorage(),
): NotificationPrefs {
  const current = loadPrefs(storage);
  const set = new Set(current.mutedConversationIds);
  if (set.has(conversationId)) set.delete(conversationId);
  else set.add(conversationId);
  return updatePrefs({ mutedConversationIds: Array.from(set).sort((a, b) => a - b) }, storage);
}

export function isConversationMuted(
  conversationId: number,
  prefs: NotificationPrefs,
): boolean {
  return prefs.mutedConversationIds.includes(conversationId);
}

function mergeWithDefaults(partial: Partial<NotificationPrefs>): NotificationPrefs {
  const categories: Record<NotificationCategory, boolean> = {
    ...DEFAULT_PREFS.categories,
    ...(partial.categories ?? {}),
  };
  const quietHours: QuietHours = {
    ...DEFAULT_PREFS.quietHours,
    ...(partial.quietHours ?? {}),
  };
  return {
    version: 1,
    foregroundAlerts: partial.foregroundAlerts ?? DEFAULT_PREFS.foregroundAlerts,
    categories,
    mutedConversationIds: (partial.mutedConversationIds ?? []).filter(
      (id): id is number => Number.isFinite(id),
    ),
    quietHours: clampQuietHours(quietHours),
  };
}

function clampQuietHours(quiet: QuietHours): QuietHours {
  return {
    enabled: Boolean(quiet.enabled),
    startHour: clampHour(quiet.startHour, DEFAULT_PREFS.quietHours.startHour),
    endHour: clampHour(quiet.endHour, DEFAULT_PREFS.quietHours.endHour),
  };
}

function clampHour(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const int = Math.trunc(value);
  if (int < 0) return 0;
  if (int > 23) return 23;
  return int;
}

/**
 * Returns true when a particular event, in a particular conversation (if
 * any), should surface as a user-visible notification. Separate from the
 * actual delivery mechanism — the caller decides whether to render a
 * foreground toast or hand off to the service worker.
 */
export function shouldNotify(
  event: { category: NotificationCategory; conversationId?: number },
  prefs: NotificationPrefs,
  now: Date = new Date(),
): boolean {
  if (!prefs.categories[event.category]) return false;
  if (event.conversationId !== undefined && isConversationMuted(event.conversationId, prefs)) {
    return false;
  }
  if (prefs.quietHours.enabled && inQuietHours(now, prefs.quietHours)) return false;
  return true;
}

export function inQuietHours(now: Date, quiet: QuietHours): boolean {
  if (!quiet.enabled) return false;
  const hour = now.getHours();
  const minute = now.getMinutes();
  const minutes = hour * 60 + minute;
  const start = quiet.startHour * 60;
  const end = quiet.endHour * 60;
  if (start === end) return false; // 0-length window is "off".
  if (start < end) return minutes >= start && minutes < end; // Same-day window.
  return minutes >= start || minutes < end; // Overnight window.
}
