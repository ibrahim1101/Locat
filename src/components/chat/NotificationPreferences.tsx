import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
  loadPrefs,
  PREFS_EVENT,
  updatePrefs,
} from "@/lib/notificationPrefs";

/**
 * Device-local notification preferences. Sits beneath the push subscribe
 * controls in Settings & backups. These toggles never leave the device and
 * never travel to the server; they only shape what the local Notification
 * API and the service worker surface.
 */
export function NotificationPreferences() {
  const [prefs, setPrefs] = useState(() => loadPrefs());

  useEffect(() => {
    const refresh = () => setPrefs(loadPrefs());
    window.addEventListener(PREFS_EVENT, refresh);
    // StorageEvent fires when another tab updates the same account's prefs.
    const onStorage = (event: StorageEvent) => {
      if (event.key === "locat-notification-prefs-v1" || event.key === null) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(PREFS_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  function setCategory(id: NotificationCategory, value: boolean) {
    const next = updatePrefs({ categories: { ...prefs.categories, [id]: value } });
    setPrefs(next);
  }

  const quiet = prefs.quietHours;
  const quietActive = quiet.enabled;

  return (
    <section
      className="emergent-locat-surface space-y-3 rounded-xl p-4"
      data-testid="notification-prefs"
    >
      <div>
        <h3 className="text-sm font-medium">Notification preferences</h3>
        <p className="text-xs text-secondary">
          These settings stay on this device. The server never sees message
          contents in push payloads; your Locat shell decides when to alert.
        </p>
      </div>

      <label className="flex items-center justify-between gap-2 text-sm">
        Show in-app alerts while Locat is open
        <input
          type="checkbox"
          data-testid="notif-foreground"
          checked={prefs.foregroundAlerts}
          onChange={(e) => setPrefs(updatePrefs({ foregroundAlerts: e.target.checked }))}
        />
      </label>

      <fieldset className="space-y-2" data-testid="notif-categories">
        <legend className="text-xs font-medium uppercase tracking-wide text-secondary">
          Categories
        </legend>
        {NOTIFICATION_CATEGORIES.map((cat) => (
          <label key={cat.id} className="flex items-start justify-between gap-2 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{cat.label}</span>
              <span className="block text-xs text-secondary">{cat.description}</span>
            </span>
            <input
              type="checkbox"
              data-testid={`notif-category-${cat.id}`}
              checked={prefs.categories[cat.id]}
              onChange={(e) => setCategory(cat.id, e.target.checked)}
            />
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-2" data-testid="notif-quiet-hours">
        <legend className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-secondary">
          {quietActive ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
          Quiet hours
        </legend>
        <label className="flex items-center justify-between gap-2 text-sm">
          Silence notifications on a schedule
          <input
            type="checkbox"
            data-testid="notif-quiet-enabled"
            checked={quiet.enabled}
            onChange={(e) => setPrefs(updatePrefs({ quietHours: { ...quiet, enabled: e.target.checked } }))}
          />
        </label>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            From
            <select
              aria-label="Quiet hours start"
              data-testid="notif-quiet-start"
              className="emergent-locat-control min-h-11 rounded-xl p-2"
              disabled={!quiet.enabled}
              value={quiet.startHour}
              onChange={(e) => setPrefs(updatePrefs({ quietHours: { ...quiet, startHour: Number.parseInt(e.target.value, 10) } }))}
            >
              {Array.from({ length: 24 }, (_, hour) => (
                <option key={hour} value={hour}>{formatHour(hour)}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            Until
            <select
              aria-label="Quiet hours end"
              data-testid="notif-quiet-end"
              className="emergent-locat-control min-h-11 rounded-xl p-2"
              disabled={!quiet.enabled}
              value={quiet.endHour}
              onChange={(e) => setPrefs(updatePrefs({ quietHours: { ...quiet, endHour: Number.parseInt(e.target.value, 10) } }))}
            >
              {Array.from({ length: 24 }, (_, hour) => (
                <option key={hour} value={hour}>{formatHour(hour)}</option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>

      <MutedConversationsSummary count={prefs.mutedConversationIds.length} />
    </section>
  );
}

function MutedConversationsSummary({ count }: { count: number }) {
  return (
    <div
      className="flex items-start justify-between gap-2 border-t border-border/50 pt-3 text-xs text-secondary"
      data-testid="muted-conversations-summary"
    >
      <span>
        {count === 0
          ? "No conversations are muted on this device."
          : `${count} conversation${count === 1 ? "" : "s"} muted on this device.`}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        data-testid="muted-conversations-help"
        onClick={() =>
          window.alert(
            "Open any conversation and tap the bell icon in the header to mute or unmute it. Muted conversations still deliver — only notifications are silenced on this device.",
          )
        }
      >
        How?
      </Button>
    </div>
  );
}

function formatHour(hour: number): string {
  const h = hour % 24;
  const date = new Date();
  date.setHours(h, 0, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
