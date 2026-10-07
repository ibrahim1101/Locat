import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/state/auth";
import { Button } from "@/components/ui/button";
import { stopDeviceNotifications, setNotificationAccount, notificationUnavailableReason, readyNotificationWorker } from "@/lib/notifications";

export function Notifications() {
  const { state } = useAuth();
  const config = trpc.push.configuration.useQuery();
  const subscribe = trpc.push.subscribe.useMutation(),
    unsubscribe = trpc.push.unsubscribe.useMutation(),
    test = trpc.push.test.useMutation();
  const [feedback, setFeedback] = useState(""),
    [busy, setBusy] = useState(false);
  const unavailableReason = notificationUnavailableReason({
    secure: window.isSecureContext,
    serviceWorker: "serviceWorker" in navigator,
    pushManager: "PushManager" in window,
    notification: "Notification" in window,
    permission: "Notification" in window ? Notification.permission : undefined,
  });
  async function perform(task: () => Promise<void>) {
    setBusy(true);
    setFeedback("");
    try {
      await task();
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "Could not change notifications."
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-3 rounded-xl border p-3">
      <h3 className="text-sm font-medium">Background notifications</h3>
      <p className="text-xs text-secondary">
        Optional alerts say “New messages on Locat” without contact names or
        message previews. Your browser's push provider handles delivery. On
        iPhone, install Locat on the Home Screen first.
      </p>
      {unavailableReason ? (
        <p className="text-xs text-secondary">
          {unavailableReason}
        </p>
      ) : !config.data?.publicKey ? (
        <p className="text-xs text-secondary">
          The server owner must configure push keys before enabling
          notifications.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void perform(async () => {
                if (state.status !== "ready" || !config.data?.publicKey) return;
                if ((await Notification.requestPermission()) !== "granted")
                  throw new Error(
                    "Notification permission was not granted. You can change it in browser settings."
                  );
                const registration = await readyNotificationWorker(navigator.serviceWorker);
                const bytes = Uint8Array.from(
                  atob(
                    config.data.publicKey.replace(/-/g, "+").replace(/_/g, "/")
                  ),
                  c => c.charCodeAt(0)
                );
                let subscription =
                  await registration.pushManager.getSubscription();
                if (
                  subscription &&
                  subscription.options.applicationServerKey &&
                  new Uint8Array(
                    subscription.options.applicationServerKey
                  ).toString() !== bytes.toString()
                ) {
                  await subscription.unsubscribe();
                  subscription = null;
                }
                subscription ??= await registration.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: bytes,
                });
                const json = subscription.toJSON();
                if (!json.endpoint || !json.keys?.auth || !json.keys?.p256dh)
                  throw new Error("Browser did not provide notification keys.");
                await setNotificationAccount(registration, state.user.id);
                await subscribe.mutateAsync({
                  endpoint: json.endpoint,
                  keys: { auth: json.keys.auth, p256dh: json.keys.p256dh },
                });
                setFeedback(
                  "Notifications enabled for this account and browser. You can now send a test."
                );
              })
            }
          >
            Enable
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void perform(async () => {
                const registration =
                  await navigator.serviceWorker.getRegistration();
                const subscription =
                  await registration?.pushManager.getSubscription();
                if (subscription)
                  await unsubscribe.mutateAsync({
                    endpoint: subscription.endpoint,
                  });
                await stopDeviceNotifications();
                setFeedback("Notifications disabled on this browser.");
              })
            }
          >
            Disable
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void perform(async () => {
                await test.mutateAsync();
                setFeedback(
                  "Test requested. Delivery depends on your browser and network."
                );
              })
            }
          >
            Send test
          </Button>
        </div>
      )}
      {feedback && (
        <p role="status" className="text-xs">
          {feedback}
        </p>
      )}
    </section>
  );
}
