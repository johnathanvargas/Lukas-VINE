#!/usr/bin/env node
/**
 * VINE App Manual Test Script
 * This script helps verify that all app features are working correctly
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 VINE App Test Suite\n');
console.log('='.repeat(60));

let passed = 0;
let failed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`✓ ${description}`);
    passed++;
  } catch (e) {
    console.log(`✗ ${description}`);
    console.log(`  Error: ${e.message}`);
    failed++;
  }
}

// Test 1: Essential files exist
console.log('\n📁 File Existence Tests:');
test('index.html exists', () => {
  if (!fs.existsSync('./index.html')) throw new Error('Missing index.html');
});

test('script.js exists', () => {
  if (!fs.existsSync('./script.js')) throw new Error('Missing script.js');
});

test('style.css exists', () => {
  if (!fs.existsSync('./style.css')) throw new Error('Missing style.css');
});

test('sw.js exists', () => {
  if (!fs.existsSync('./sw.js')) throw new Error('Missing sw.js');
});

test('cache-version.js exists', () => {
  if (!fs.existsSync('./cache-version.js')) throw new Error('Missing cache-version.js');
});

test('manifest.json exists', () => {
  if (!fs.existsSync('./manifest.json')) throw new Error('Missing manifest.json');
});

test('chemicals.js exists', () => {
  if (!fs.existsSync('./chemicals.js')) throw new Error('Missing chemicals.js');
});

test('plants.js exists', () => {
  if (!fs.existsSync('./plants.js')) throw new Error('Missing plants.js');
});

test('plant-utils.js exists', () => {
  if (!fs.existsSync('./plant-utils.js')) throw new Error('Missing plant-utils.js');
});

// Test 2: Icon files
console.log('\n🖼️  Icon Tests:');
const iconSizes = ['96', '128', '192', '512'];
iconSizes.forEach(size => {
  test(`icon-${size}.png exists`, () => {
    if (!fs.existsSync(`./icon-${size}.png`)) 
      throw new Error(`Missing icon-${size}.png`);
  });
});

// Test 3: Manifest validation
console.log('\n📱 PWA Manifest Tests:');
test('manifest.json is valid JSON', () => {
  const manifest = JSON.parse(fs.readFileSync('./manifest.json', 'utf8'));
  if (!manifest.name) throw new Error('Missing name in manifest');
  if (!manifest.icons) throw new Error('Missing icons in manifest');
});

test('All manifest icons reference existing files', () => {
  const manifest = JSON.parse(fs.readFileSync('./manifest.json', 'utf8'));
  manifest.icons.forEach(icon => {
    const iconPath = icon.src.startsWith('./') ? icon.src.slice(2) : icon.src;
    if (!fs.existsSync(iconPath)) {
      throw new Error(`Manifest references missing icon: ${icon.src}`);
    }
  });
});

// Test 4: Service Worker validation
console.log('\n⚙️  Service Worker Tests:');
test('sw.js imports cache-version.js', () => {
  const sw = fs.readFileSync('./sw.js', 'utf8');
  if (!sw.includes('importScripts(\'./cache-version.js\')')) {
    throw new Error('sw.js should import cache-version.js');
  }
});

test('sw.js uses centralized cache version', () => {
  const sw = fs.readFileSync('./sw.js', 'utf8');
  if (!sw.includes('VINE_CACHE_VERSION')) {
    throw new Error('sw.js should use VINE_CACHE_VERSION');
  }
});

test('sw.js has install event listener', () => {
  const sw = fs.readFileSync('./sw.js', 'utf8');
  if (!sw.includes("addEventListener('install'")) {
    throw new Error('sw.js missing install event listener');
  }
});

test('sw.js has activate event listener', () => {
  const sw = fs.readFileSync('./sw.js', 'utf8');
  if (!sw.includes("addEventListener('activate'")) {
    throw new Error('sw.js missing activate event listener');
  }
});

test('sw.js has fetch event listener', () => {
  const sw = fs.readFileSync('./sw.js', 'utf8');
  if (!sw.includes("addEventListener('fetch'")) {
    throw new Error('sw.js missing fetch event listener');
  }
});

// Test 5: Cache management
console.log('\n💾 Cache Management Tests:');
test('cache-version.js defines CACHE_VERSION', () => {
  const cacheVersion = fs.readFileSync('./cache-version.js', 'utf8');
  if (!cacheVersion.includes('CACHE_VERSION')) {
    throw new Error('cache-version.js should define CACHE_VERSION');
  }
});

test('No hardcoded version numbers in index.html', () => {
  const html = fs.readFileSync('./index.html', 'utf8');
  // Check for old-style version numbers (should not exist after our fix)
  if (html.match(/\?v=176440000\d/)) {
    throw new Error('Found hardcoded version numbers in index.html');
  }
});

// Test 6: HTML structure
console.log('\n🏗️  HTML Structure Tests:');
test('index.html has service worker registration', () => {
  const html = fs.readFileSync('./index.html', 'utf8');
  if (!html.includes('serviceWorker')) {
    throw new Error('index.html should register service worker');
  }
});

test('index.html has cache control meta tags', () => {
  const html = fs.readFileSync('./index.html', 'utf8');
  if (!html.includes('Cache-Control')) {
    throw new Error('index.html should have cache control meta tags');
  }
});

test('index.html loads cache-version.js', () => {
  const html = fs.readFileSync('./index.html', 'utf8');
  if (!html.includes('cache-version.js')) {
    throw new Error('index.html should load cache-version.js');
  }
});

// Test 7: JavaScript validation
console.log('\n🔧 JavaScript Tests:');
test('script.js has ensureChemicalsAvailable function', () => {
  const script = fs.readFileSync('./script.js', 'utf8');
  if (!script.includes('function ensureChemicalsAvailable')) {
    throw new Error('script.js missing ensureChemicalsAvailable function');
  }
});

test('script.js has ensurePlantsAvailable function', () => {
  const script = fs.readFileSync('./script.js', 'utf8');
  if (!script.includes('function ensurePlantsAvailable')) {
    throw new Error('script.js missing ensurePlantsAvailable function');
  }
});

test('script.js has improved service worker update handler', () => {
  const script = fs.readFileSync('./script.js', 'utf8');
  if (!script.includes('controllerchange')) {
    throw new Error('script.js missing service worker update handler');
  }
});

// Test 8: Documentation
console.log('\n📚 Documentation Tests:');
test('CACHE_MANAGEMENT.md exists', () => {
  if (!fs.existsSync('./CACHE_MANAGEMENT.md')) {
    throw new Error('Missing CACHE_MANAGEMENT.md');
  }
});

test('.gitignore exists', () => {
  if (!fs.existsSync('./.gitignore')) {
    throw new Error('Missing .gitignore');
  }
});

test('.gitignore excludes node_modules', () => {
  const gitignore = fs.readFileSync('./.gitignore', 'utf8');
  if (!gitignore.includes('node_modules')) {
    throw new Error('.gitignore should exclude node_modules');
  }
});

// Summary
console.log('\n' + '='.repeat(60));
console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('✅ All tests passed! App is ready for testing.\n');
  process.exit(0);
} else {
  console.log('⚠️  Some tests failed. Please review the errors above.\n');
  process.exit(1);
}
