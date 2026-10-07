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
