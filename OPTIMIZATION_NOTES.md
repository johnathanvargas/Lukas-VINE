# Performance Optimization Notes

## Current Performance Bottlenecks

### Large Static Assets
The VINE PWA currently loads several large assets synchronously on initial page load, which significantly impacts startup time and Lighthouse performance scores:

- **Icon images** (`icon-96.png`, `icon-192.png`, `icon-512.png`): Combined ~829 KB
- **plants.json**: ~1.5 MB of plant diagnostic data
- **JavaScript data files**: chemicals.js, plants.js, plant-utils.js loaded synchronously

These assets block the initial paint and delay time-to-interactive, resulting in poor First Contentful Paint (FCP) and Largest Contentful Paint (LCP) metrics.

## Implemented Improvements

This branch implements safe, non-destructive lazy-loading for large data assets:

1. **Idle-prefetch loader**: Scripts now load asynchronously with `requestIdleCallback` to avoid blocking first paint
2. **Runtime guards**: Data-dependent functions now check if assets are loaded and trigger on-demand loading when needed
3. **Loading UI**: Users see friendly loading messages when data is still being fetched

## Recommended Follow-up Optimizations

### 1. Optimize Icon Images

The PWA icons are currently uncompressed PNGs totaling ~829 KB. Compress and optimize them:

```bash
# Install imagemagick and cwebp for image optimization
sudo apt-get install imagemagick webp

# Compress PNG icons (lossless)
pngquantize icon-96.png --ext .png --force --quality 80-95
pngquantize icon-192.png --ext .png --force --quality 80-95
pngquantize icon-512.png --ext .png --force --quality 80-95

# Or convert to WebP for better compression
cwebp -q 85 icon-96.png -o icon-96.webp
cwebp -q 85 icon-192.png -o icon-192.webp
cwebp -q 85 icon-512.png -o icon-512.webp
```

**Expected savings**: 60-80% file size reduction

### 2. Host plants.json Externally

The 1.5 MB `plants.json` file should be hosted on a CDN or external server and fetched at runtime:

```javascript
// In plant-utils.js or plants.js, fetch from CDN instead of bundling
async function loadPlantData() {
  const response = await fetch('https://cdn.example.com/plants.json');
  const plantData = await response.json();
  return plantData;
}
```

**Benefits**: 
- Reduces initial bundle size
- Enables caching and versioning
- Allows updates without redeploying the entire app

### 3. Use Git LFS for Binary Files

Track large binary files (Excel files, images) with Git LFS to keep the repository lightweight:

```bash
# Install Git LFS
git lfs install

# Track Excel and large image files
git lfs track "*.xlsx"
git lfs track "*.png"
git lfs track "*.jpg"

# Commit .gitattributes
git add .gitattributes
git commit -m "Add Git LFS tracking for binary files"
```

### 4. Strengthen Service Worker Precaching

Update `sw.js` to intelligently precache only critical assets:

```javascript
const CACHE_NAME = 'vine-v1';
const CRITICAL_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/icon-192.png'  // Only precache one optimized icon
];

// Lazy-cache large data files on first use
const LAZY_ASSETS = [
  '/chemicals.js',
  '/plants.js',
  '/plant-utils.js'
];
```

### 5. Add Build Pipeline

Implement a build step using esbuild or webpack to:

- Minify JavaScript files
- Bundle modules efficiently
- Tree-shake unused code
- Generate source maps

```bash
# Install esbuild
npm install --save-dev esbuild

# Add build script to package.json
{
  "scripts": {
    "build": "esbuild script.js --bundle --minify --outfile=dist/script.min.js"
  }
}
```

### 6. Implement Code Splitting

Split large JavaScript files into smaller chunks that load on-demand:

```javascript
// Use dynamic imports for heavy features
async function loadDiagnostics() {
  const { renderDiagnostics } = await import('./diagnostics.js');
  renderDiagnostics();
}
```

## Testing Recommendations

After implementing optimizations, measure improvements with:

- **Lighthouse**: Run audits in Chrome DevTools
- **WebPageTest**: Test on real devices and networks
- **Bundle analysis**: Use `webpack-bundle-analyzer` or similar

## Expected Improvements

Implementing these recommendations should result in:

- **50-70% reduction** in initial bundle size
- **2-3x faster** first paint and time-to-interactive
- **Lighthouse score** improvements from ~60 to 90+
- **Better offline experience** with smarter caching

## Resources

- [Web.dev Performance Best Practices](https://web.dev/performance/)
- [Git LFS Documentation](https://git-lfs.github.com/)
- [PWA Optimization Guide](https://web.dev/pwa/)
- [Image Optimization Guide](https://web.dev/fast/#optimize-your-images)
