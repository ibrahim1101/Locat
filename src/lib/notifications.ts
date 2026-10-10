export type NotificationEnvironment = {
  secure: boolean;
  serviceWorker: boolean;
  pushManager: boolean;
  notification: boolean;
  permission?: NotificationPermission;
};

export function notificationUnavailableReason(environment: NotificationEnvironment): string | null {
  if (!environment.secure) return "Notifications require a trusted HTTPS connection. Open your server's HTTPS address; do not bypass certificate errors.";
  if (!environment.serviceWorker) return "This browser or browsing mode does not support service workers. Try a regular browser window; private browsing may restrict notifications.";
  if (!environment.pushManager || !environment.notification) return "Web Push is unavailable in this browser or installation mode. On iPhone/iPad, install Locat on the Home Screen first. Firefox on Android can use notifications in a regular HTTPS tab; installation is not required.";
  if (environment.permission === "denied") return "Notifications are blocked for this site. Allow them in the browser's site settings and check the browser's Android notification permission, then reopen Locat.";
  return null;
}

export async function readyNotificationWorker(container: Pick<ServiceWorkerContainer, "ready">, timeoutMs = 10_000): Promise<ServiceWorkerRegistration> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const registration = await Promise.race([
      container.ready,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Notification service worker did not become ready. Close all Locat tabs, reopen your HTTPS address, and try again.")), timeoutMs);
      }),
    ]);
    if (!registration.active || !registration.pushManager) throw new Error("This installation cannot enable Web Push. Reopen Locat in a supported HTTPS browser window.");
    return registration;
  } finally { clearTimeout(timer); }
}

export async function setNotificationAccount(registration: ServiceWorkerRegistration, userId: number): Promise<void> {
  const worker = registration.active;
  if (!worker) throw new Error("Notification setup is not ready. Close and reopen Locat, then try again.");
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); reject(new Error("Notification setup timed out. Close and reopen Locat, then try again.")); }, 10_000);
    channel.port1.onmessage = event => {
      clearTimeout(timer); channel.port1.close();
      if (event.data?.saved) resolve(); else reject(new Error("Could not save notification settings."));
    };
    worker.postMessage({ type: "locat-push-account", userId }, [channel.port2]);
  });
}

export async function stopDeviceNotifications(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;
  await setNotificationAccount(registration, 0);
  for (const notification of await registration.getNotifications()) notification.close();
  await (await registration.pushManager.getSubscription())?.unsubscribe();
}

/**
 * Mirror the device-local notification preferences (categories + quiet hours)
 * into the service worker so background pushes honour the same rules. The
 * message body never contains conversation ids, names or message content.
 */
export async function syncNotificationPrefs(
  registration: ServiceWorkerRegistration,
  prefs: { categories: Record<string, boolean>; quietHours: { enabled: boolean; startHour: number; endHour: number } },
): Promise<void> {
  const worker = registration.active;
  if (!worker) return;
  await new Promise<void>((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); resolve(); }, 5_000);
    channel.port1.onmessage = () => {
      clearTimeout(timer);
      channel.port1.close();
      resolve();
    };
    worker.postMessage({ type: "locat-push-prefs", prefs }, [channel.port2]);
  });
}
