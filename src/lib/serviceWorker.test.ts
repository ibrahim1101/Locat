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
