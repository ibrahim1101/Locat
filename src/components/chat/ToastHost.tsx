import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Bell, X } from "lucide-react";
import { FOREGROUND_TOAST_EVENT, type ForegroundToast } from "@/lib/foregroundNotify";

const MAX_VISIBLE = 3;
const AUTO_DISMISS_MS = 6_000;

/**
 * Renders in-app toast alerts for foreground events (new message, Sentinel
 * alert). Toasts are privacy-shaped by the dispatcher: message toasts show
 * only the sender display name; Sentinel toasts show no incident details.
 * Tapping a toast navigates to the owning route.
 */
export function ToastHost({ onOpenConversation }: { onOpenConversation?: (conversationId: number) => void }) {
  const [toasts, setToasts] = useState<ForegroundToast[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<ForegroundToast>).detail;
      setToasts((current) => [...current.slice(-(MAX_VISIBLE - 1)), detail]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((t) => t.id !== detail.id));
      }, AUTO_DISMISS_MS);
    };
    window.addEventListener(FOREGROUND_TOAST_EVENT, onToast);
    return () => window.removeEventListener(FOREGROUND_TOAST_EVENT, onToast);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="toast-host"
      className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex flex-col items-center gap-2 px-3 pt-safe"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          data-testid={`toast-${toast.category}`}
          className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-border/60 bg-card/95 p-3 shadow-xl backdrop-blur"
        >
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
            data-testid={`toast-open-${toast.category}`}
            onClick={() => {
              setToasts((current) => current.filter((t) => t.id !== toast.id));
              if (toast.category === "messages" && toast.conversationId !== undefined && onOpenConversation) {
                onOpenConversation(toast.conversationId);
              } else {
                navigate(toast.route);
              }
            }}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 ember-text">
              <Bell className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{toast.title}</span>
              <span className="block truncate text-xs text-secondary">{toast.body}</span>
            </span>
          </button>
          <button
            type="button"
            aria-label="Dismiss notification"
            data-testid={`toast-dismiss-${toast.category}`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-secondary hover:bg-accent"
            onClick={() => setToasts((current) => current.filter((t) => t.id !== toast.id))}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
