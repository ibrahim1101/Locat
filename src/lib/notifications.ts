export async function stopDeviceNotifications(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;
  registration.active?.postMessage({ type: 'locat-push-account', userId: 0 });
  for (const notification of await registration.getNotifications()) notification.close();
  await (await registration.pushManager.getSubscription())?.unsubscribe();
}
