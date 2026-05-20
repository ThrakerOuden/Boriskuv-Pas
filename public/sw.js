const CACHE_NAME = 'boriskuv-pas-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

// An empty fetch event handler is sufficient to satisfy the PWA installability requirements
// while preventing any issues with network fetch hijacking or caching stale resources.
self.addEventListener('fetch', (event) => {
  // Do nothing, let browser handle the request naturally from network
});
