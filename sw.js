// Import centralized cache version
importScripts('./cache-version.js');

const CACHE_NAME = `lukas-hort-v${self.VINE_CACHE_VERSION || '35'}`;
const urlsToCache = [
  '/',
  '/index.html',
  '/lukas-logo.png',
  '/style.css',
  '/script.js',
  '/chemicals.js',
  '/plants.js',
  '/plant-utils.js',
  '/plants.json',
  '/cache-version.js',
  '/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Cormorant:wght@400;500;600;700&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const req = event.request;
  const url = new URL(req.url);

  // For navigation requests, always try network first
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(cached => cached || caches.match('/index.html')))
    );
    return;
  }

  // For local assets, strip query parameters for cache matching
  // This allows cache-busting URLs to match cached resources
  if (url.origin === self.location.origin) {
    // Create a URL without query params for cache lookup
    const cacheUrl = url.pathname;
    
    event.respondWith(
      // Try to match without query params first
      caches.match(cacheUrl).then(cached => {
        if (cached) return cached;
        
        // If not in cache, fetch with original URL (including query params)
        return fetch(req).then(res => {
          // Only cache successful responses
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(cache => {
              // Store without query params for future cache-busting
              cache.put(cacheUrl, copy);
            });
          }
          return res;
        }).catch(err => {
          console.error('Fetch failed:', err);
          // Try to match the full URL as fallback
          return caches.match(req);
        });
      })
    );
  } else {
    // For external resources, use standard caching
    event.respondWith(
      caches.match(req).then(cached => {
        return cached || fetch(req).then(res => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          }
          return res;
        });
      })
    );
  }
});
