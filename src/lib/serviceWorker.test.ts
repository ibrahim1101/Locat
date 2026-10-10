import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { IDBFactory } from "fake-indexeddb";
import { expect, it, vi } from "vitest";

it("acknowledges saved account settings and shows opted-in pushes even with a visible window", async () => {
  const builder = readFileSync("scripts/build-offline.mjs", "utf8");
  const source = builder.slice(builder.indexOf("`", builder.indexOf("await writeFile")) + 1, builder.lastIndexOf("`"))
    .replace("${hash}", "fixture").replace("${JSON.stringify(shell)}", "[]");
  const handlers: Record<string, (event: unknown) => void> = {};
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const self = { addEventListener: (name: string, handler: (event: unknown) => void) => { handlers[name] = handler; },
    registration: { showNotification }, clients: { matchAll: async () => [{ visibilityState: "visible" }] } };
  runInNewContext(source, { self, indexedDB: new IDBFactory(), URL });
  let pending: Promise<unknown> = Promise.resolve();
  const waitUntil = (promise: Promise<unknown>) => { pending = promise; };
  const acknowledge = vi.fn();
  handlers.message({ data: { type: "locat-push-account", userId: 42 }, ports: [{ postMessage: acknowledge }], waitUntil });
  await pending; expect(acknowledge).toHaveBeenCalledWith({ saved: true });
  handlers.push({ data: { json: () => ({ type: "new-message", userId: 42 }) }, waitUntil });
  await pending; expect(showNotification).toHaveBeenCalledTimes(1);
  handlers.push({ data: { json: () => ({ type: "new-message", userId: 43 }) }, waitUntil });
  await pending; expect(showNotification).toHaveBeenCalledTimes(1);
  handlers.message({ data: { type: "locat-push-account", userId: 0 }, ports: [], waitUntil });
  await pending;
  handlers.push({ data: { json: () => ({ type: "new-message", userId: 42 }) }, waitUntil });
  await pending; expect(showNotification).toHaveBeenCalledTimes(1);
});

function bootWorker() {
  const builder = readFileSync("scripts/build-offline.mjs", "utf8");
  const source = builder.slice(builder.indexOf("`", builder.indexOf("await writeFile")) + 1, builder.lastIndexOf("`"))
    .replace("${hash}", "fixture").replace("${JSON.stringify(shell)}", "[]");
  const handlers: Record<string, (event: unknown) => void> = {};
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const openWindow = vi.fn().mockResolvedValue(undefined);
  const focus = vi.fn().mockResolvedValue(undefined);
  const navigate = vi.fn().mockResolvedValue(undefined);
  const self = {
    addEventListener: (name: string, handler: (event: unknown) => void) => { handlers[name] = handler; },
    registration: { showNotification },
    location: { origin: "https://locat.example" },
    clients: {
      matchAll: async () => [{ url: "https://locat.example/messages", visibilityState: "visible", focus, navigate }],
      openWindow,
    },
  };
  runInNewContext(source, { self, indexedDB: new IDBFactory(), URL });
  let pending: Promise<unknown> = Promise.resolve();
  const waitUntil = (promise: Promise<unknown>) => { pending = promise; };
  return { handlers, showNotification, openWindow, focus, navigate, waitUntil, flush: () => pending };
}

it("routes sentinel alerts to the Sentinel page with a category-specific body", async () => {
  const { handlers, showNotification, navigate, flush, waitUntil } = bootWorker();
  handlers.message({ data: { type: "locat-push-account", userId: 7 }, ports: [], waitUntil });
  await flush();
  handlers.push({ data: { json: () => ({ type: "sentinel-alert", userId: 7 }) }, waitUntil });
  await flush();
  expect(showNotification).toHaveBeenCalledTimes(1);
  const [title, options] = showNotification.mock.calls[0] as [string, { body: string; data: { url: string }; tag: string }];
  expect(title).toBe("Locat");
  expect(options.body).toBe("New Sentinel security alert");
  expect(options.data.url).toBe("/sentinel");
  expect(options.tag).toBe("locat-sentinel");
  // Tapping the notification navigates the focused window to /sentinel.
  handlers.notificationclick({ notification: { close: vi.fn(), data: { url: "/sentinel" } }, waitUntil });
  await flush();
  expect(navigate).toHaveBeenCalledWith("/sentinel");
});

it("honours mirrored category toggles and quiet hours for background pushes", async () => {
  const { handlers, showNotification, flush, waitUntil } = bootWorker();
  handlers.message({ data: { type: "locat-push-account", userId: 9 }, ports: [], waitUntil });
  await flush();
  // Disable the sentinel category; alert pushes must be suppressed.
  handlers.message({
    data: { type: "locat-push-prefs", prefs: { categories: { sentinel: false }, quietHours: { enabled: false, startHour: 22, endHour: 7 } } },
    ports: [], waitUntil,
  });
  await flush();
  handlers.push({ data: { json: () => ({ type: "sentinel-alert", userId: 9 }) }, waitUntil });
  await flush();
  expect(showNotification).not.toHaveBeenCalled();
  // Messages still arrive (category enabled by absence of an explicit off).
  handlers.push({ data: { json: () => ({ type: "new-message", userId: 9 }) }, waitUntil });
  await flush();
  expect(showNotification).toHaveBeenCalledTimes(1);
  // Enable quiet hours spanning "now" and everything is suppressed.
  const hour = new Date().getHours();
  handlers.message({
    data: { type: "locat-push-prefs", prefs: { categories: {}, quietHours: { enabled: true, startHour: hour, endHour: (hour + 2) % 24 } } },
    ports: [], waitUntil,
  });
  await flush();
  handlers.push({ data: { json: () => ({ type: "new-message", userId: 9 }) }, waitUntil });
  await flush();
  expect(showNotification).toHaveBeenCalledTimes(1);
});

it("ignores unknown push payload types", async () => {
  const { handlers, showNotification, flush, waitUntil } = bootWorker();
  handlers.message({ data: { type: "locat-push-account", userId: 3 }, ports: [], waitUntil });
  await flush();
  handlers.push({ data: { json: () => ({ type: "marketing", userId: 3 }) }, waitUntil });
  await flush();
  expect(showNotification).not.toHaveBeenCalled();
});
