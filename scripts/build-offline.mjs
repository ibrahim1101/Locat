import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../dist/public/', import.meta.url);
const assets = (await readdir(new URL('assets/', root))).map(name => `/assets/${name}`);
const shell = ['/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', ...assets];
const hash = createHash('sha256').update(await readFile(new URL('index.html', root))).digest('hex').slice(0,16);
await writeFile(new URL('sw.js', root), `
const CACHE = 'locat-shell-${hash}';
const SHELL = ${JSON.stringify(shell)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith('locat-shell-') && name !== CACHE) await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  // Only the static shell is cached. Credentials and API responses never enter Cache Storage.
  if (event.request.mode === 'navigate') {
    event.respondWith(caches.open(CACHE).then(cache => cache.match('/index.html')).then(cached => cached || fetch(event.request)));
  } else if (SHELL.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(url.pathname)).then(cached => cached || fetch(event.request)));
  }
});
async function pushAccount(value) {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('locat-notification-settings', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('settings');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('settings', value === undefined ? 'readonly' : 'readwrite');
      const store = transaction.objectStore('settings');
      const request = value === undefined ? store.get('account') : store.put(value, 'account');
      let result;
      request.onsuccess = () => result = request.result;
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}
self.addEventListener('message', event => {
  if (event.data?.type === 'locat-push-account' && Number.isSafeInteger(event.data.userId) && event.data.userId >= 0) {
    event.waitUntil(pushAccount(event.data.userId).then(() => event.ports[0]?.postMessage({ saved: true })));
  }
});
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let payload;
    try { payload = event.data?.json(); } catch { return; }
    if (payload?.type !== 'new-message' || !payload.userId || payload.userId !== await pushAccount()) return;
    // Firefox counts silent pushes against its quota. Every valid opted-in push displays an alert.
    await self.registration.showNotification('Locat', { body: 'New messages on Locat', icon: '/icon-192.png', badge: '/icon-192.png', tag: 'locat-inbox', data: { url: '/' } });
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) if (new URL(client.url).origin === self.location.origin) { await client.focus(); return; }
    await self.clients.openWindow('/');
  })());
});
`);
