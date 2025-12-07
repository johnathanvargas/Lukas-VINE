// plant-utils.js
// Utility helpers for working with plantsMaster in Lukas SMS

(function () {
  function ensureArray(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }

  function getAllPlantsSync() {
    return Array.isArray(window.plantsMaster) ? window.plantsMaster : [];
  }

  async function getAllPlants() {
    if (window.loadPlants) {
      return await window.loadPlants();
    }
    return getAllPlantsSync();
  }

  function getPlantByIdSync(plantId) {
    if (!plantId) return null;
    return getAllPlantsSync().find(p => p.plantId === plantId) || null;
  }

  async function getPlantById(plantId) {
    if (!plantId) return null;
    const plants = await getAllPlants();
    return plants.find(p => p.plantId === plantId) || null;
  }

  function searchPlantsSync(term) {
    const t = (term || '').trim().toLowerCase();
    const plants = getAllPlantsSync();
    if (!t) return plants;

    return plants.filter(p => {
      const common = (p.commonName || '').toLowerCase();
      const botanical = (p.botanicalName || '').toLowerCase();
      const synonyms = ensureArray(p.synonyms).join(' ').toLowerCase();
      return (
        common.includes(t) ||
        botanical.includes(t) ||
        synonyms.includes(t)
      );
    });
  }

  async function searchPlants(term) {
    const t = (term || '').trim().toLowerCase();
    const plants = await getAllPlants();
    if (!t) return plants;

    return plants.filter(p => {
      const common = (p.commonName || '').toLowerCase();
      const botanical = (p.botanicalName || '').toLowerCase();
      const synonyms = ensureArray(p.synonyms).join(' ').toLowerCase();
      return (
        common.includes(t) ||
        botanical.includes(t) ||
        synonyms.includes(t)
      );
    });
  }


  function getDiagnosticProfileSync(plantId) {
    const plant = getPlantByIdSync(plantId);
    if (!plant) return null;

    return {
      plantId: plant.plantId,
      commonName: plant.commonName || null,
      botanicalName: plant.botanicalName || null,
      commonPests: ensureArray(plant.commonPests),
      commonDiseases: ensureArray(plant.commonDiseases),
      commonAbioticIssues: ensureArray(plant.commonAbioticIssues),
      symptomPatterns: Array.isArray(plant.symptomPatterns) ? plant.symptomPatterns : [],
      heatTolerance: plant.heatTolerance || null,
      coldTolerance: plant.coldTolerance || null,
      droughtTolerance: plant.droughtTolerance || null,
      saltTolerance: plant.saltTolerance || null,
      petSafety: plant.petSafety || null,
      pollinatorValue: plant.pollinatorValue || null,
      deerResistance: plant.deerResistance || null
    };
  }

  async function getDiagnosticProfile(plantId) {
    if (!plantId) return null;
    const plant = await getPlantById(plantId);
    if (!plant) return null;
    return getDiagnosticProfileSync(plantId);
  }

  function findBestPlantMatchSync(term) {
    const t = (term || '').trim().toLowerCase();
    if (!t) return null;

    const plants = getAllPlantsSync();
    if (!plants.length) return null;

    const exact = plants.find(p => {
      const common = (p.commonName || '').toLowerCase();
      const botanical = (p.botanicalName || '').toLowerCase();
      return common === t || botanical === t;
    });

    if (exact) return exact;

    const matches = searchPlantsSync(term);
    return matches.length ? matches[0] : null;
  }

  function filterPlantsByCategorySync(category) {
    const c = (category || '').trim().toLowerCase();
    if (!c) return getAllPlantsSync();
    return getAllPlantsSync().filter(p => {
      const cats = (p.categories || []).map(x => String(x).toLowerCase());
      return cats.includes(c);
    });
  }

  async function filterPlantsByCategory(category) {
    const c = (category || '').trim().toLowerCase();
    const plants = await getAllPlants();
    if (!c) return plants;
    return plants.filter(p => {
      const cats = (p.categories || []).map(x => String(x).toLowerCase());
      return cats.includes(c);
    });
  }

  function getDropdownOptionsSync() {
    return getAllPlantsSync()
      .slice()
      .sort((a, b) => {
        const an = (a.commonName || '').toLowerCase();
        const bn = (b.commonName || '').toLowerCase();
        if (an < bn) return -1;
        if (an > bn) return 1;
        return 0;
      })
      .map(p => ({
        value: p.plantId,
        label: p.commonName || p.botanicalName || p.plantId
      }));
  }

  async function getDropdownOptions() {
    const plants = await getAllPlants();
    return plants
      .slice()
      .sort((a, b) => {
        const an = (a.commonName || '').toLowerCase();
        const bn = (b.commonName || '').toLowerCase();
        if (an < bn) return -1;
        if (an > bn) return 1;
        return 0;
      })
      .map(p => ({
        value: p.plantId,
        label: p.commonName || p.botanicalName || p.plantId
      }));
  }

  function getNativePlantsSync() {
    return getAllPlantsSync().filter(p => !!p.isNative);
  }

  function getEdiblePlantsSync() {
    return getAllPlantsSync().filter(p => !!p.isEdible);
  }

  function getHouseplantsSync() {
    return getAllPlantsSync().filter(p => !!p.isHouseplant);
  }

  // Expose a single namespace on window
  window.PlantUtils = {
    getAllPlantsSync,
    getAllPlants,
    getPlantByIdSync,
    getPlantById,
    searchPlantsSync,
    searchPlants,
    filterPlantsByCategorySync,
    filterPlantsByCategory,
    getDropdownOptionsSync,
    getDropdownOptions,
    getNativePlantsSync,
    getEdiblePlantsSync,
    getHouseplantsSync,
    getDiagnosticProfileSync,
    getDiagnosticProfile,
    findBestPlantMatchSync
  };
})();