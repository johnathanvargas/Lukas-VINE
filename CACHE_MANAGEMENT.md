# Cache Management Guide for VINE PWA

## Overview
VINE uses a Progressive Web App (PWA) architecture with a service worker for offline functionality and improved performance. This document explains how caching works and how to manage it effectively.

## Cache Architecture

### 1. Service Worker Cache (sw.js)
The service worker provides offline functionality by caching essential assets. It uses a versioned cache name that changes when you update the app.

**Current Cache Strategy:**
- **Cache-First for Assets**: Local JavaScript, CSS, and images are served from cache first, then updated in background
- **Network-First for Navigation**: HTML pages always try network first, falling back to cache if offline
- **Smart Query Param Handling**: URLs with version query parameters (e.g., `?v=123`) match cached resources without those params

### 2. Cache Version Management
The cache version is centralized in `cache-version.js`:

```javascript
const CACHE_VERSION = '35';
```

**To update the cache version:**
1. Edit `cache-version.js` and increment `CACHE_VERSION`
2. This will force all users to download fresh assets on next visit
3. Old caches are automatically deleted

### 3. Browser Cache Control
The HTML file includes meta tags to prevent aggressive browser caching during development:

```html
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
<meta http-equiv="Pragma" content="no-cache">
<meta http-equiv="Expires" content="0">
```

**Note**: These are helpful during development but can be removed in production builds.

## Cache Busting Strategy

### Development Mode
During development, timestamp-based cache busting is used automatically:
- `script.js?v=1733622000000`
- `style.css?v=1733622000001`

This ensures you always get the latest version during development.

### Production Mode
For production deployments:
1. Update `CACHE_VERSION` in `cache-version.js`
2. The service worker will create a new cache
3. Old caches are automatically cleaned up
4. Users get fresh content on next visit

## Common Cache Issues and Solutions

### Issue: Users seeing old content after deploy

**Solution 1: Increment Cache Version**
```javascript
// In cache-version.js
const CACHE_VERSION = '36'; // Was '35'
```

**Solution 2: Clear Service Worker**
Users can manually clear by:
1. Opening DevTools (F12)
2. Application tab → Service Workers
3. Click "Unregister"
4. Reload page

### Issue: Development changes not showing

**Solutions:**
1. Hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
2. DevTools → Application → Clear storage → Clear site data
3. DevTools → Network → Disable cache (checkbox)

### Issue: Service worker stuck in "waiting" state

**Solution:**
```javascript
// The service worker uses skipWaiting() to activate immediately
self.skipWaiting();
```

This is already implemented in `sw.js`.

## Testing Cache Behavior

### Test Offline Functionality
1. Open DevTools → Network tab
2. Select "Offline" from throttling dropdown
3. Reload the page
4. Verify app still works

### Test Service Worker Updates
1. Make a change to a cached file
2. Increment `CACHE_VERSION` in `cache-version.js`
3. Reload the page
4. Verify new content appears

### Test Cache Busting
1. Check Network tab in DevTools
2. Verify assets have `?v=` parameters
3. Verify 200 (from ServiceWorker) or 200 OK responses

## Best Practices

### ✅ DO:
- Increment `CACHE_VERSION` for every production deploy
- Test offline functionality before deploying
- Monitor service worker registration errors
- Use cache-busting for JavaScript/CSS in development
- Keep `urlsToCache` updated with critical assets

### ❌ DON'T:
- Hardcode version numbers throughout the codebase
- Cache user data (use localStorage/IndexedDB instead)
- Forget to test cache updates
- Deploy without incrementing cache version
- Add non-essential large files to `urlsToCache`

## Troubleshooting Commands

### Force Clear All Caches (Development Only)
```javascript
// Run in browser console
caches.keys().then(keys => {
  keys.forEach(key => caches.delete(key));
  console.log('All caches cleared');
});
```

### Check Current Cache Version
```javascript
// Run in browser console
caches.keys().then(keys => console.log('Active caches:', keys));
```

### Unregister Service Worker
```javascript
// Run in browser console
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => reg.unregister());
  console.log('Service workers unregistered');
});
```

## File Structure

```
/
├── cache-version.js      # Centralized cache version management
├── sw.js                 # Service worker with caching logic
├── index.html            # Main HTML with cache meta tags
├── script.js             # Main app logic with dynamic loading
├── style.css             # Styles
├── chemicals.js          # Chemical database
├── plants.js             # Plant data loader
└── plant-utils.js        # Plant utilities
```

## Service Worker Lifecycle

1. **Install**: Downloads and caches assets listed in `urlsToCache`
2. **Activate**: Removes old caches, claims clients
3. **Fetch**: Intercepts requests, serves from cache or network
4. **Update**: Detects changes, installs new version in background

## Performance Tips

1. **Minimize Cache Size**: Only cache essential assets
2. **Use CDN for Large Files**: Don't cache multi-MB files in service worker
3. **Lazy Load Data**: Load large datasets (plants.json) on-demand
4. **Optimize Images**: Compress icons (currently 800KB each!)
5. **Enable Compression**: Use gzip/brotli on server

## Monitoring

Check these metrics regularly:
- Service worker registration success rate
- Cache hit ratio
- Offline functionality
- Time to first paint
- JavaScript load times

## Resources

- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [PWA Caching Strategies](https://web.dev/offline-cookbook/)
- [Cache API](https://developer.mozilla.org/en-US/docs/Web/API/Cache)
- [Workbox](https://developers.google.com/web/tools/workbox) - Advanced service worker library
