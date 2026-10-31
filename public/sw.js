const CACHE_NAME = 'autofeast-offline-v3';

const ONNX_WASM_FILES = [
  '/wasm/ort-wasm-simd-threaded.asyncify.mjs',
  '/wasm/ort-wasm-simd-threaded.asyncify.wasm',
  '/wasm/ort-wasm-simd-threaded.jsep.mjs',
  '/wasm/ort-wasm-simd-threaded.jsep.wasm',
  '/wasm/ort-wasm-simd-threaded.jspi.mjs',
  '/wasm/ort-wasm-simd-threaded.jspi.wasm',
  '/wasm/ort-wasm-simd-threaded.mjs',
  '/wasm/ort-wasm-simd-threaded.wasm'
];

const CORE_ASSETS = [
  '/',
  '/index.html',
  ...ONNX_WASM_FILES
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      let tfCache = null;
      try {
        tfCache = await caches.open('transformers-cache');
      } catch (_) {}

      // Robust individual asset precaching: one failure never aborts others
      await Promise.allSettled(
        CORE_ASSETS.map(async (assetPath) => {
          try {
            const absoluteUrl = new URL(assetPath, self.location.origin).href;
            const res = await fetch(assetPath, { cache: 'reload' });
            if (res && (res.status === 200 || res.status === 0)) {
              await cache.put(assetPath, res.clone());
              await cache.put(absoluteUrl, res.clone());

              // For ONNX WASM assets, mirror to transformers-cache so transformers.js loadAndCacheFile matches immediately
              if (tfCache && assetPath.startsWith('/wasm/')) {
                await tfCache.put(assetPath, res.clone());
                await tfCache.put(absoluteUrl, res.clone());
              }
              console.log(`[SW Precache]: Cached ${assetPath}`);
            } else {
              console.warn(`[SW Precache]: Failed status ${res.status} for ${assetPath}`);
            }
          } catch (err) {
            console.warn(`[SW Precache]: Fetch error for ${assetPath}:`, err);
          }
        })
      );

      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          // Do not delete transformers-cache (which stores Whisper model weights & WASM binaries)
          if (key !== CACHE_NAME && key !== 'transformers-cache') {
            console.log(`[SW Activate]: Purging obsolete cache: ${key}`);
            return caches.delete(key);
          }
        })
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // For /assets/ and /wasm/ files: Strict Cache-First, then Network, caching response
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/wasm/')) {
    event.respondWith(
      (async () => {
        // 1. Try matching against CACHE_NAME and all open caches
        const cached = (await caches.match(request)) || (await caches.match(url.pathname));
        if (cached) {
          return cached;
        }

        // 2. Check transformers-cache explicitly
        try {
          const tfCache = await caches.open('transformers-cache');
          const tfMatch = (await tfCache.match(request)) || (await tfCache.match(url.pathname));
          if (tfMatch) return tfMatch;
        } catch (_) {}

        // 3. Fallback to network only if online, and cache the result
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && (networkResponse.status === 200 || networkResponse.status === 0)) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, networkResponse.clone());
            await cache.put(url.pathname, networkResponse.clone());

            if (url.pathname.startsWith('/wasm/')) {
              try {
                const tfCache = await caches.open('transformers-cache');
                await tfCache.put(request, networkResponse.clone());
                await tfCache.put(url.pathname, networkResponse.clone());
              } catch (_) {}
            }
          }
          return networkResponse;
        } catch (netErr) {
          console.error(`[SW Diagnostic]: Missing offline asset in cache: ${request.url}`);
          throw netErr;
        }
      })()
    );
    return;
  }

  // For navigation requests (HTML pages): Network-First, fallback to cached HTML
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(async (networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(async () => {
          return (
            (await caches.match(request)) ||
            (await caches.match('/')) ||
            (await caches.match('/index.html'))
          );
        })
    );
    return;
  }

  // Default GET requests: Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then(async (networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            url.origin === self.location.origin
          ) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
