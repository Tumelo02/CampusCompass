// Bump version to invalidate old caches when shipping shell changes.
const VERSION = 'v7';
const STATIC_CACHE = 'campuscompass-static-' + VERSION;
const RUNTIME_CACHE = 'campuscompass-runtime-' + VERSION;

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/favicon-32.png',
  '/timetable/bundle.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(CORE_ASSETS).catch(() => {})
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never cache the visibility API or admin assets — they need to be live.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin')) {
    return;
  }

  // Network-first for HTML so users always see the latest UI when online.
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((m) => m || caches.match('/index.html')))
    );
    return;
  }

  // Cache-first for static assets and timetable data.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // Refresh in the background so updates land on the next visit.
        fetch(req)
          .then((res) => {
            if (res && res.status === 200) {
              caches.open(RUNTIME_CACHE).then((c) => c.put(req, res.clone())).catch(() => {});
            }
          })
          .catch(() => {});
        return cached;
      }
      return fetch(req).then((res) => {
        if (res && res.status === 200 && url.origin === location.origin) {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
    })
  );
});
