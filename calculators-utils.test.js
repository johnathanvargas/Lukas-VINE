#!/usr/bin/env node
/**
 * Unit tests for calculator utility functions
 * Run with: node calculators-utils.test.js
 */

const {
  calculateMix,
  calculateGranular,
  formatMixResultsHTML,
  formatGranularResultsHTML,
  FL_OZ_TO_ML,
  SPRAY_VOLUME_PER_1000_SQFT
} = require('./calculators-utils.js');

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

function assertEquals(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`Expected ${expected} but got ${actual}. ${message}`);
  }
}

function assertTruthy(value, message = '') {
  if (!value) {
    throw new Error(`Expected truthy value. ${message}`);
  }
}

console.log('🧪 Calculator Utilities Test Suite\n');
console.log('='.repeat(60));

// Test Mix Calculator
console.log('\n🧪 Mix Calculator Tests:');

test('calculateMix returns error for invalid tank size', () => {
  const result = calculateMix(0, []);
  assertTruthy(result.error, 'Should have error');
});

test('calculateMix returns error for no chemicals', () => {
  const result = calculateMix(25, []);
  assertTruthy(result.error, 'Should have error');
});

test('calculateMix calculates correctly for valid inputs', () => {
  const chemicals = [
    { id: 'chem1', name: 'Test Chemical', defaultRatePerGallon: 2.5, mixRate: '2.5 fl oz/gal' }
  ];
  const result = calculateMix(25, chemicals);
  
  assertEquals(result.tankSize, 25);
  assertEquals(result.estimatedCoverageSqFt, 25000);
  assertEquals(result.mixItems.length, 1);
  assertEquals(result.mixItems[0].flOz, 62.5); // 2.5 * 25
  assertEquals(Math.round(result.mixItems[0].ml), 1848); // 62.5 * 29.57
});

test('calculateMix handles chemicals without stored rates', () => {
  const chemicals = [
    { id: 'chem1', name: 'Test Chemical', mixRate: 'See label' }
  ];
  const result = calculateMix(25, chemicals);
  
  assertEquals(result.mixItems.length, 1);
  assertEquals(result.mixItems[0].hasStoredRate, false);
  assertTruthy(result.mixItems[0].labelRate);
});

test('calculateMix handles multiple chemicals', () => {
  const chemicals = [
    { id: 'chem1', name: 'Chemical 1', defaultRatePerGallon: 2.0 },
    { id: 'chem2', name: 'Chemical 2', defaultRatePerGallon: 1.5 }
  ];
  const result = calculateMix(10, chemicals);
  
  assertEquals(result.mixItems.length, 2);
  assertEquals(result.mixItems[0].flOz, 20); // 2.0 * 10
  assertEquals(result.mixItems[1].flOz, 15); // 1.5 * 10
});

test('calculateMix coverage calculation is correct', () => {
  const chemicals = [{ id: 'chem1', name: 'Test', defaultRatePerGallon: 1.0 }];
  const result = calculateMix(50, chemicals);
  
  assertEquals(result.estimatedCoverageSqFt, 50000); // 50 gallons * 1000 sq ft per gallon
  assertEquals(result.sprayVolume, SPRAY_VOLUME_PER_1000_SQFT);
});

// Test Granular Calculator
console.log('\n🧪 Granular Calculator Tests:');

test('calculateGranular returns error for invalid area', () => {
  const result = calculateGranular(0, 5);
  assertTruthy(result.error);
});

test('calculateGranular returns error for invalid rate', () => {
  const result = calculateGranular(5000, 0);
  assertTruthy(result.error);
});

test('calculateGranular returns error for NaN rate', () => {
  const result = calculateGranular(5000, NaN);
  assertTruthy(result.error);
});

test('calculateGranular calculates correctly for valid inputs', () => {
  const result = calculateGranular(5000, 4, 'Test Granular Product');
  
  assertEquals(result.areaSqFt, 5000);
  assertEquals(result.ratePerThousandSqFt, 4);
  assertEquals(result.areaThousands, 5); // 5000 / 1000
  assertEquals(result.totalLbs, 20); // 5 * 4
  assertEquals(result.productName, 'Test Granular Product');
});

test('calculateGranular handles fractional areas correctly', () => {
  const result = calculateGranular(2500, 3.5);
  
  assertEquals(result.areaThousands, 2.5); // 2500 / 1000
  assertEquals(result.totalLbs, 8.75); // 2.5 * 3.5
});

test('calculateGranular works without product name', () => {
  const result = calculateGranular(1000, 2);
  
  assertEquals(result.productName, '');
  assertEquals(result.totalLbs, 2); // 1 * 2
});

// Test HTML formatters
console.log('\n🧪 HTML Formatter Tests:');

test('formatMixResultsHTML handles error results', () => {
  const result = { error: 'Test error' };
  const html = formatMixResultsHTML(result);
  assertEquals(html, 'Test error');
});

test('formatMixResultsHTML formats valid results', () => {
  const result = {
    tankSize: 25,
    sprayVolume: 1,
    estimatedCoverageSqFt: 25000,
    mixItems: [
      { name: 'Chemical 1', flOz: 50, ml: 1478.5, ratePerGallon: 2, hasStoredRate: true }
    ]
  };
  const html = formatMixResultsHTML(result);
  assertTruthy(html.includes('25 gallons'));
  assertTruthy(html.includes('25000 sq ft'));
  assertTruthy(html.includes('Chemical 1'));
});

test('formatGranularResultsHTML handles error results', () => {
  const result = { error: 'Test error' };
  const html = formatGranularResultsHTML(result);
  assertEquals(html, 'Test error');
});

test('formatGranularResultsHTML formats valid results', () => {
  const result = {
    productName: 'Test Product',
    areaSqFt: 5000,
    areaThousands: 5,
    ratePerThousandSqFt: 4,
    totalLbs: 20
  };
  const html = formatGranularResultsHTML(result);
  assertTruthy(html.includes('Test Product'));
  assertTruthy(html.includes('5000 sq ft'));
  assertTruthy(html.includes('20.00 lbs'));
});

// Test constants
console.log('\n🧪 Constants Tests:');

test('FL_OZ_TO_ML constant is correct', () => {
  assertEquals(FL_OZ_TO_ML, 29.57);
});

test('SPRAY_VOLUME_PER_1000_SQFT constant is correct', () => {
  assertEquals(SPRAY_VOLUME_PER_1000_SQFT, 1);
});

// Summary
console.log('\n' + '='.repeat(60));
console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('✅ All calculator tests passed!\n');
  process.exit(0);
} else {
  console.log('⚠️  Some tests failed. Please review the errors above.\n');
  process.exit(1);
}
