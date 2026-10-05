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
`);
