// Foreground notification dispatcher: while Locat is open and unlocked, an
// incoming event becomes a small in-app toast instead of (or in addition to)
// an OS notification. All routing decisions reuse the device-local
// preferences from notificationPrefs.ts — category toggles, quiet hours and
// per-conversation mute apply identically in the foreground.

import { loadPrefs, shouldNotify, type NotificationCategory } from "./notificationPrefs";

export const FOREGROUND_TOAST_EVENT = "locat-foreground-toast";

export type ForegroundToast = {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  /** Route to open when the toast is tapped (e.g. /messages or /sentinel). */
  route: string;
  conversationId?: number;
};

/**
 * Pure decision helper (unit-tested): decides whether a foreground toast is
 * appropriate right now. The caller is responsible for knowing the document
 * visibility; everything else comes from device-local prefs.
 */
export function shouldShowForegroundToast(
  event: { category: NotificationCategory; conversationId?: number },
  context: {
    /** The conversation the user is currently reading, if any. */
    activeConversationId?: number | null;
    documentVisible: boolean;
    now?: Date;
  },
): boolean {
  if (!context.documentVisible) return false;
  // Reading the very conversation that received the message already shows
  // the bubble — a toast would duplicate it.
  if (
    event.category === "messages" &&
    event.conversationId !== undefined &&
    event.conversationId === context.activeConversationId
  ) {
    return false;
  }
  const prefs = loadPrefs();
  if (!prefs.foregroundAlerts) return false;
  return shouldNotify(event, prefs, context.now ?? new Date());
}

/** Fire the toast event. Returns false when the decision layer suppressed it. */
export function dispatchForegroundToast(
  toast: Omit<ForegroundToast, "id">,
  context: {
    activeConversationId?: number | null;
    documentVisible: boolean;
    now?: Date;
  },
): boolean {
  if (
    !shouldShowForegroundToast(
      { category: toast.category, conversationId: toast.conversationId },
      context,
    )
  ) {
    return false;
  }
  const event = new CustomEvent<ForegroundToast>(FOREGROUND_TOAST_EVENT, {
    detail: { ...toast, id: crypto.randomUUID() },
  });
  window.dispatchEvent(event);
  return true;
}

type BadgeNavigator = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

/**
 * Update the OS / installed-PWA app badge with the unread count. No-op on
 * platforms without the Badging API.
 */
export function updateAppBadge(unreadCount: number, nav: BadgeNavigator | undefined = typeof navigator === "undefined" ? undefined : navigator): void {
  if (!nav?.setAppBadge) return;
  void (unreadCount > 0 ? nav.setAppBadge(unreadCount) : (nav.clearAppBadge?.() ?? nav.setAppBadge(0))).catch(() => {});
}
