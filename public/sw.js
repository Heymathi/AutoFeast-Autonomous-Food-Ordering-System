const CACHE_NAME = 'autofeast-offline-v2';

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/wasm/ort-wasm-simd-threaded.asyncify.mjs',
  '/wasm/ort-wasm-simd-threaded.asyncify.wasm',
  '/wasm/ort-wasm-simd-threaded.jsep.mjs',
  '/wasm/ort-wasm-simd-threaded.jsep.wasm',
  '/wasm/ort-wasm-simd-threaded.jspi.mjs',
  '/wasm/ort-wasm-simd-threaded.jspi.wasm',
  '/wasm/ort-wasm-simd-threaded.mjs',
  '/wasm/ort-wasm-simd-threaded.wasm'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS).catch((err) => {
        console.warn('[SW]: Failed to precache some assets during install:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          // Do not delete transformers-cache (which stores HuggingFace Whisper model weights)
          if (key !== CACHE_NAME && key !== 'transformers-cache') {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // For /assets/ and /wasm/ files: Cache-First, then Network, caching response
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/wasm/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // For navigation requests (HTML pages): Network-First, fallback to cached HTML
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || caches.match('/') || caches.match('/index.html');
          });
        })
    );
    return;
  }

  // Default GET requests: Stale-While-Revalidate or Network fallback to Cache
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && url.origin === self.location.origin) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return networkResponse;
      }).catch(() => cached);

      return cached || fetchPromise;
    })
  );
});

