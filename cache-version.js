// Centralized cache version management for VINE PWA
// Update this single value when you need to bust caches across the app
const CACHE_VERSION = '36';

// Generate timestamp-based build ID for development (can be overridden in production)
const BUILD_ID = typeof BUILD_TIMESTAMP !== 'undefined' ? BUILD_TIMESTAMP : Date.now();

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.VINE_CACHE_VERSION = CACHE_VERSION;
  window.VINE_BUILD_ID = BUILD_ID;
}

// Export for service worker
if (typeof self !== 'undefined' && typeof window === 'undefined') {
  self.VINE_CACHE_VERSION = CACHE_VERSION;
  self.VINE_BUILD_ID = BUILD_ID;
}
