import { describe, expect, it, vi } from 'vitest';
import { notificationUnavailableReason, readyNotificationWorker } from './notifications';
import { allowedPushEndpoint, endpointHash } from '../../api/push';
describe('push destination validation', () => {
  it('allows browser providers and rejects local, arbitrary, and deceptive destinations', () => {
    for (const url of ['https://fcm.googleapis.com/fcm/send/token','https://updates.push.services.mozilla.com/wpush/v2/token','https://web.push.apple.com/token','https://wns2.notify.windows.com/token']) expect(allowedPushEndpoint(url)).toBe(true);
    for (const url of ['http://fcm.googleapis.com/token','https://127.0.0.1/token','https://localhost/token','https://fcm.googleapis.com.evil.example/token','https://user:password@fcm.googleapis.com/token','https://fcm.googleapis.com:3000/token','https://evil.example/token','not-a-url']) expect(allowedPushEndpoint(url)).toBe(false);
  });
  it('uses stable endpoint identifiers without storing them in logs', () => {
    expect(endpointHash('https://fcm.googleapis.com/token')).toHaveLength(64);
    expect(endpointHash('one')).not.toBe(endpointHash('two'));
  });
});

describe('notification capability and service-worker setup', () => {
  const available = { secure: true, serviceWorker: true, pushManager: true, notification: true };
  it('uses capabilities rather than requiring browser installation', () => {
    expect(notificationUnavailableReason(available)).toBeNull();
    expect(notificationUnavailableReason({ ...available, permission: 'granted' })).toBeNull();
    expect(notificationUnavailableReason({ ...available, secure: false })).toContain('HTTPS');
    expect(notificationUnavailableReason({ ...available, serviceWorker: false })).toContain('private browsing');
    expect(notificationUnavailableReason({ ...available, pushManager: false })).toContain('Home Screen');
    expect(notificationUnavailableReason({ ...available, notification: false })).toContain('Web Push');
    expect(notificationUnavailableReason({ ...available, permission: 'denied' })).toContain('site settings');
  });
  it('accepts an active push worker and rejects incomplete registrations', async () => {
    const worker = { active: {}, pushManager: {} } as ServiceWorkerRegistration;
    await expect(readyNotificationWorker({ ready: Promise.resolve(worker) })).resolves.toBe(worker);
    await expect(readyNotificationWorker({ ready: Promise.resolve({ active: null } as ServiceWorkerRegistration) })).rejects.toThrow('supported HTTPS');
  });
  it('bounds readiness waits and clears timers on failure', async () => {
    vi.useFakeTimers();
    try {
      const pending = readyNotificationWorker({ ready: new Promise(() => {}) }, 100);
      const assertion = expect(pending).rejects.toThrow('did not become ready');
      await vi.advanceTimersByTimeAsync(100);
      await assertion;
      expect(vi.getTimerCount()).toBe(0);
      await expect(readyNotificationWorker({ ready: Promise.reject(new Error('worker failed')) })).rejects.toThrow('worker failed');
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
});
