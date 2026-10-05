/* global self, caches, fetch, URL, Response */

// Replaced with a content fingerprint and the complete built asset list by Vite.
const BUILD_ID = 'development';
const SHELL = ['/', '/manifest.webmanifest', '/icons/rivenbloom-icon.svg'];
const CACHE_PREFIX = 'rivenbloom-shell-';
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_ID}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)));
});
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin)
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Precached files are public, immutable within this build, and have no origin-specific body.
      const cached = await cache.match(event.request, {
        ignoreVary: SHELL.includes(new URL(event.request.url).pathname),
      });
      if (cached !== undefined) return cached;
      try {
        const response = await fetch(event.request);
        if (response.ok && response.type === 'basic') {
          await cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        if (event.request.mode === 'navigate') return (await cache.match('/')) ?? Response.error();
        return Response.error();
      }
    })(),
  );
});
