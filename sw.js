// Service worker of the installed web app (GitHub Pages): the game keeps working offline once it has been
// played. Every file the game loads (same origin, and the Google Fonts) goes into the cache on the way; the cached
// copy answers at once while a fresh one is fetched for the next start (stale-while-revalidate). A new CACHE name
// (bump it when the list of files changes a lot) drops the old cache. Registered by js/main.js only when the page
// has its manifest (index.html on https), never for the single-file builds.
const CACHE = 'acai-fever-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const cacheable = (url) => url.origin === self.location.origin || /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!cacheable(url)) return;
  event.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    const fresh = fetch(req).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    });
    if (hit) {
      event.waitUntil(fresh.catch(() => undefined));
      return hit;
    }
    return fresh.catch(() => (req.mode === 'navigate' ? cache.match('./index.html') : Response.error()));
  }));
});
