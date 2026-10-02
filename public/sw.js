// Paisa Ledger service worker.
// - On install: downloads every app file (from precache-manifest.json) so the app opens fully offline.
// - Online: always fetches fresh files first (no stale code after an update), falling back to the cache offline.
// - Never touches Firebase/Google requests (Firestore keeps its own offline copy of your data).
const CACHE = 'paisa-ledger-v3';

self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch('./precache-manifest.json', { cache: 'no-store' });
        const { files } = await res.json();
        // Add one by one so a single missing file can't block the whole install.
        await Promise.all(files.map((f) => cache.add(new Request(f, { cache: 'reload' })).catch(() => undefined)));
      } catch {
        await cache.addAll(['./', './index.html']).catch(() => undefined);
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const key = req.mode === 'navigate' ? './' : req;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(key, copy));
        }
        return res;
      })
      .catch(async () => (await caches.match(key, { ignoreSearch: req.mode === 'navigate' })) || (await caches.match('./index.html')) || Response.error()),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((cs) => (cs[0] ? cs[0].focus() : self.clients.openWindow('./'))));
});
