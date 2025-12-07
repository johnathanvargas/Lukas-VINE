// plants.js
// Loader for Lukas SMS plant master data (plants.json)

(function () {
  async function loadPlants() {
    if (window.plantsMaster && Array.isArray(window.plantsMaster)) {
      return window.plantsMaster;
    }
    const response = await fetch('plants.json', { cache: 'no-store' });
    if (!response.ok) {
      console.error('Failed to load plants.json', response.status, response.statusText);
      window.plantsMaster = [];
      return window.plantsMaster;
    }
    const data = await response.json();
    window.plantsMaster = Array.isArray(data) ? data : [];
    return window.plantsMaster;
  }

  // expose on window
  window.loadPlants = loadPlants;
})();