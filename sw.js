// Service worker of the installed web app (GitHub Pages): the game keeps working offline once it has been
// played. Every file the game loads (same origin, and the Google Fonts) goes into the cache on the way.
// The game's own files come from the network first (revalidated, past the browser's HTTP cache) and from the cache
// only offline: answering from the cache first mixed two versions after an update – a new script with an old
// stylesheet laid the phone's kitchen out wrong. The fonts never change: the cached copy answers at once.
// A new CACHE name drops the old cache. Registered by js/main.js only when the page has its manifest (index.html on
// https), never for the single-file builds.
const CACHE = 'acai-fever-v2';
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

const isFont = (url) => /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
const cacheable = (url) => url.origin === self.location.origin || isFont(url);

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!cacheable(url)) return;
  event.respondWith(caches.open(CACHE).then(async (cache) => {
    // (a navigation's request takes no options; the browser revalidates the page itself)
    const fresh = fetch(req, isFont(url) || req.mode === 'navigate' ? undefined : { cache: 'no-cache' }).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    });
    const cached = () => cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    if (isFont(url)) {
      const hit = await cached();
      if (hit) {
        event.waitUntil(fresh.catch(() => undefined));
        return hit;
      }
      return fresh;
    }
    return fresh.catch(async () => (await cached()) || (req.mode === 'navigate' ? cache.match('./index.html') : Response.error()));
  }));
});
