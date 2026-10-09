import { describe, expect, it } from "vitest";
import { notificationUnavailableReason, readyNotificationWorker } from "./notifications";

describe("notification availability diagnostics", () => {
  const supported = { secure: true, serviceWorker: true, pushManager: true, notification: true, permission: "granted" as const };

  it("accepts a fully supported notification environment", () => {
    expect(notificationUnavailableReason(supported)).toBeNull();
  });

  it("explains insecure origins before checking other capabilities", () => {
    expect(notificationUnavailableReason({ ...supported, secure: false })).toMatch(/HTTPS/);
  });

  it("explains missing service workers", () => {
    expect(notificationUnavailableReason({ ...supported, serviceWorker: false })).toMatch(/service workers/);
  });

  it("explains unsupported web push and browser notification APIs", () => {
    expect(notificationUnavailableReason({ ...supported, pushManager: false })).toMatch(/Web Push/);
    expect(notificationUnavailableReason({ ...supported, notification: false })).toMatch(/Web Push/);
  });

  it("explains denied notification permission", () => {
    expect(notificationUnavailableReason({ ...supported, permission: "denied" })).toMatch(/blocked/);
  });
});

describe("notification service worker readiness", () => {
  it("accepts an active worker with push support", async () => {
    const registration = { active: {}, pushManager: {} } as ServiceWorkerRegistration;
    await expect(readyNotificationWorker({ ready: Promise.resolve(registration) })).resolves.toBe(registration);
  });

  it("rejects an inactive worker", async () => {
    const registration = { active: null, pushManager: {} } as unknown as ServiceWorkerRegistration;
    await expect(readyNotificationWorker({ ready: Promise.resolve(registration) })).rejects.toThrow(/cannot enable Web Push/);
  });

  it("rejects a worker without push support", async () => {
    const registration = { active: {}, pushManager: null } as unknown as ServiceWorkerRegistration;
    await expect(readyNotificationWorker({ ready: Promise.resolve(registration) })).rejects.toThrow(/cannot enable Web Push/);
  });
});
