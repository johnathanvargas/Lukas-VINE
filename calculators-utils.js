/**
 * Calculators Utility Module
 * Pure calculation functions for Mix Calculator and Granular Helper
 * All functions are pure (no side effects) for testability
 */

// Constants
const FL_OZ_TO_ML = 29.57;
const SPRAY_VOLUME_PER_1000_SQFT = 1; // Fixed assumption: 1 gallon per 1,000 sq ft

/**
 * Calculate mix amounts for a tank based on chemicals and tank size
 * @param {number} tankSizeGallons - Tank size in gallons
 * @param {Array} chemicalsData - Array of chemical objects with id, name, defaultRatePerGallon, mixRate
 * @returns {Object} - Calculation results including coverage and mix items
 */
function calculateMix(tankSizeGallons, chemicalsData) {
  if (!tankSizeGallons || tankSizeGallons <= 0) {
    return { error: "Enter a valid tank size in gallons." };
  }

  if (!Array.isArray(chemicalsData) || chemicalsData.length === 0) {
    return { error: "Select at least one chemical." };
  }

  const sprayVolume = SPRAY_VOLUME_PER_1000_SQFT;
  const estimatedCoverageSqFt = tankSizeGallons * 1000;

  const mixItems = [];

  chemicalsData.forEach(chem => {
    if (typeof chem.defaultRatePerGallon !== "number" || chem.defaultRatePerGallon <= 0) {
      mixItems.push({
        id: chem.id,
        name: chem.name,
        labelRate: chem.mixRate || "Check the product label for exact rates.",
        hasStoredRate: false
      });
      return;
    }

    const flOz = chem.defaultRatePerGallon * tankSizeGallons;
    const ml = flOz * FL_OZ_TO_ML;

    mixItems.push({
      id: chem.id,
      name: chem.name,
      ratePerGallon: chem.defaultRatePerGallon,
      flOz,
      ml,
      hasStoredRate: true
    });
  });

  return {
    tankSize: tankSizeGallons,
    sprayVolume,
    estimatedCoverageSqFt,
    mixItems,
    mixText: mixItems
      .filter(item => item.hasStoredRate)
      .map(item => `${item.name}: ${item.flOz.toFixed(2)} fl oz (~${item.ml.toFixed(0)} mL) at ${item.ratePerGallon} fl oz/gal`)
      .join('\n')
  };
}

/**
 * Calculate granular product needed based on area and application rate
 * @param {number} areaSqFt - Area to treat in square feet
 * @param {number} ratePerThousandSqFt - Application rate in lbs per 1,000 sq ft
 * @param {string} productName - Optional product name for display
 * @returns {Object} - Calculation results
 */
function calculateGranular(areaSqFt, ratePerThousandSqFt, productName = '') {
  if (!areaSqFt || areaSqFt <= 0) {
    return { error: 'Enter a valid area in square feet.' };
  }

  if (!ratePerThousandSqFt || ratePerThousandSqFt <= 0 || isNaN(ratePerThousandSqFt)) {
    return { error: 'No stored application rate for the selected product. Please refer to the product label.' };
  }

  const areaThousands = areaSqFt / 1000;
  const totalLbs = areaThousands * ratePerThousandSqFt;

  return {
    productName,
    areaSqFt,
    areaThousands,
    ratePerThousandSqFt,
    totalLbs
  };
}

/**
 * Format mix calculation results as HTML
 * @param {Object} results - Results from calculateMix
 * @returns {string} - HTML string
 */
function formatMixResultsHTML(results) {
  if (results.error) {
    return results.error;
  }

  let html = `
    <p><strong>Tank size:</strong> ${results.tankSize} gallons</p>
    <p><strong>Spray volume:</strong> ${results.sprayVolume} gal per 1,000 sq ft</p>
    <p><strong>Estimated coverage:</strong> ${results.estimatedCoverageSqFt.toFixed(0)} sq ft</p>
  `;

  html += `<p><strong>Chemicals and amounts:</strong></p><ul>`;

  results.mixItems.forEach(item => {
    if (!item.hasStoredRate) {
      html += `<li>${item.name}: ${item.labelRate}</li>`;
    } else {
      html += `<li>
        ${item.name}: ${item.flOz.toFixed(2)} fl oz (≈ ${item.ml.toFixed(0)} mL)
        at ${item.ratePerGallon} fl oz per gal.
      </li>`;
    }
  });

  html += `</ul>`;

  return html;
}

/**
 * Format granular calculation results as HTML
 * @param {Object} results - Results from calculateGranular
 * @returns {string} - HTML string
 */
function formatGranularResultsHTML(results) {
  if (results.error) {
    return results.error;
  }

  let html = '';
  if (results.productName) {
    html += `<p><strong>Product:</strong> ${results.productName}</p>`;
  }
  html += `
    <p><strong>Area:</strong> ${results.areaSqFt.toFixed(0)} sq ft (${results.areaThousands.toFixed(2)} × 1,000 sq ft)</p>
    <p><strong>Rate:</strong> ${results.ratePerThousandSqFt} lbs per 1,000 sq ft</p>
    <p><strong>Total product needed:</strong> ${results.totalLbs.toFixed(2)} lbs</p>
  `;

  return html;
}

// Export functions for use in main script
if (typeof window !== 'undefined') {
  window.CalculatorUtils = {
    calculateMix,
    calculateGranular,
    formatMixResultsHTML,
    formatGranularResultsHTML,
    FL_OZ_TO_ML,
    SPRAY_VOLUME_PER_1000_SQFT
  };
}

// For Node.js testing environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calculateMix,
    calculateGranular,
    formatMixResultsHTML,
    formatGranularResultsHTML,
    FL_OZ_TO_ML,
    SPRAY_VOLUME_PER_1000_SQFT
  };
}
