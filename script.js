// PWA Install Prompt
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const installBtn = document.getElementById('installBtn');
  if (installBtn) {
    installBtn.style.display = 'inline-block';
  }
});

// Listen for service worker updates and provide user notification
if ('serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Prevent multiple reloads
    if (refreshing) return;
    refreshing = true;
    
    // Show a less disruptive notification that an update is available
    console.log('Service worker updated. New content is available.');
    
    // Only auto-reload if user hasn't entered any data
    // Check if there are unsaved changes in localStorage
    const hasLogs = localStorage.getItem('treatmentLogs') || localStorage.getItem('scoutingLogs');
    
    if (!hasLogs) {
      // Safe to reload - no user data to lose
      window.location.reload();
    } else {
      // Let user know update is ready but don't force reload
      const updateBanner = document.createElement('div');
      updateBanner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#33a9dc;color:white;padding:12px;text-align:center;z-index:10000;box-shadow:0 2px 4px rgba(0,0,0,0.2);';
      updateBanner.innerHTML = 'New version available! <button onclick="window.location.reload()" style="background:white;color:#33a9dc;border:none;padding:6px 12px;margin-left:12px;border-radius:4px;cursor:pointer;font-weight:600;">Refresh Now</button>';
      document.body.insertBefore(updateBanner, document.body.firstChild);
    }
  });
}

// Lazy-load helper functions for on-demand loading of data assets
function _loadScript(src) {
  return new Promise((resolve, reject) => {
    // Add cache buster for development
    const cacheBustSrc = src.includes('?') ? src : src + '?v=' + Date.now();
    
    // Check if already loaded (check base URL without query params)
    const baseUrl = src.split('?')[0];
    if (document.querySelector(`script[src^="${baseUrl}"]`)) {
      resolve(src);
      return;
    }
    const s = document.createElement('script');
    s.src = cacheBustSrc;
    s.async = true;
    s.onload = () => resolve(src);
    s.onerror = (e) => reject(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}

function ensureChemicalsAvailable() {
  if (typeof window.chemicals !== 'undefined' && Array.isArray(window.chemicals)) {
    return Promise.resolve();
  }
  return _loadScript('./chemicals.js');
}

function ensurePlantsAvailable() {
  if (typeof window.PlantUtils !== 'undefined') {
    return Promise.resolve();
  }
  return _loadScript('./plants.js')
    .then(() => {
      if (typeof window.PlantUtils === 'undefined') {
        return _loadScript('./plant-utils.js').catch(()=>{});
      }
    })
    .catch(()=>{});
}

function showLoadingTarget(el, message = 'Loading…') {
  if (!el) return;
  el.innerHTML = `<p class="muted">${message}</p>`;
}

function installPWA() {
  if (!deferredPrompt) {
    alert('App is already installed or installation is not available on this device.');
    return;
  }
  
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then((choiceResult) => {
    if (choiceResult.outcome === 'accepted') {
      console.log('User accepted the install prompt');
    }
    deferredPrompt = null;
    const installBtn = document.getElementById('installBtn');
    if (installBtn) {
      installBtn.style.display = 'none';
    }
  });
}

// Favorites (persisted in localStorage)
let favoriteChemicalIds = loadFavoriteChemicalIds();

// For Mix Calculator dynamic rows
let mixChemicalOptionsHTML = "";
let mixChemRowCount = 0;
// Array of {id, name} objects used for filtering mix options
let mixChemicalOptionsData = [];

// Queue for sending chemicals from the library into the Mix Calculator
let pendingMixChemicalIds = [];

/**
 * Add a chemical to the Mix Calculator queue. This function enqueues the given
 * chemical ID without immediately navigating to the Mix Calculator. It also
 * provides a simple user notification that the product has been added. The
 * queue is later processed when the Mix Calculator page is opened. Duplicate
 * IDs are ignored.
 * @param {string} id Chemical ID to add to the mix queue
 */
function addToMix(id) {
  if (!id) return;
  // Enqueue only if not already present
  if (!pendingMixChemicalIds.includes(id)) {
    pendingMixChemicalIds.push(id);
    // Provide lightweight feedback to the user
    // Use a timeout to avoid alert interfering with click handlers
    setTimeout(() => {
      alert('Chemical added to Mix. Navigate to the Mix Calculator to see your selections.');
    }, 50);
  }
}

// Handoff state from Diagnostics -> Scouting
let pendingScoutingFromDiagnostics = null;

// Handoff state from Mix Calculator -> Treatment Log
let lastMixCalc = null;
let pendingTreatmentFromMix = null;

async function populatePlantSelect(selectId, searchInputId) {
  await ensurePlantsAvailable().catch(() => { console.warn('Plant master failed to load'); });

  const select = document.getElementById(selectId);
  if (!select) return;
  if (!window.PlantUtils || !PlantUtils.getDropdownOptions) return;

  try {
    const allOptions = await PlantUtils.getDropdownOptions();
    if (!Array.isArray(allOptions)) return;

    const buildOptionsHtml = (list) => {
      const parts = ['<option value="">Select crop</option>'];
      list.forEach(opt => {
        const value = String(opt.value || '').trim();
        const label = String(opt.label || value || '').trim();
        if (!label) return;
        const escVal = value.replace(/"/g, '&quot;');
        const escLabel = label.replace(/"/g, '&quot;');
        parts.push(
          `<option value="${escVal}" data-plant-id="${escVal}">${escLabel}</option>`
        );
      });
      return parts.join('');
    };

    select.dataset.allOptions = JSON.stringify(allOptions);
    select.innerHTML = buildOptionsHtml(allOptions);

    const searchEl = searchInputId ? document.getElementById(searchInputId) : null;
    if (searchEl) {
      searchEl.addEventListener('input', () => {
        const term = searchEl.value.trim().toLowerCase();
        let filtered = allOptions;
        if (term) {
          filtered = allOptions.filter(opt =>
            String(opt.label || opt.value || '')
              .toLowerCase()
              .includes(term)
          );
        }
        select.innerHTML = buildOptionsHtml(filtered);
      });
    }
  } catch (err) {
    console.error('Failed to populate plant select', err);
  }
}



// For Chemical Library filter
let currentChemFilter = "all";

function loadFavoriteChemicalIds() {
  try {
    const raw = localStorage.getItem('favoriteChemicalIds');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("Failed to read favoriteChemicalIds from localStorage", e);
    return [];
  }
}

function saveFavoriteChemicalIds() {
  try {
    localStorage.setItem('favoriteChemicalIds', JSON.stringify(favoriteChemicalIds));
  } catch (e) {
    console.warn("Failed to write favoriteChemicalIds to localStorage", e);
  }
}

function isChemicalFavorite(id) {
  return favoriteChemicalIds.includes(id);
}

function toggleChemFavorite(id) {
  if (!id) return;

  const index = favoriteChemicalIds.indexOf(id);
  if (index === -1) {
    favoriteChemicalIds.push(id);
  } else {
    favoriteChemicalIds.splice(index, 1);
  }
  saveFavoriteChemicalIds();

  // Re-render library views so favorite state is reflected
  const search = document.getElementById('chemSearch');
  const term = search ? search.value : "";
  renderChemicalQuickResults(term);

  // Refresh already-open detail rows to update favorite status
  const openDetail = document.querySelector(`#detail-${id}.open`);
  if (openDetail) {
    // Re-render the table to update the favorite button text
    const search = document.getElementById('chemSearch');
    const term = search ? search.value : "";
    renderChemicalQuickResults(term);
    // Re-open the detail row
    setTimeout(() => {
      const refreshedRow = document.getElementById(`detail-${id}`);
      if (refreshedRow) refreshedRow.classList.add('open');
    }, 10);
  }
}

// Queue a chemical for the Mix Calculator and navigate there
function queueChemForMix(id) {
  if (!id) return;
  if (!pendingMixChemicalIds.includes(id)) {
    pendingMixChemicalIds.push(id);
  }
}


// ====== MAIN NAVIGATION ======
/**
 * Cross fade helper. Fades out the current content, executes the provided update function,
 * then fades back in. This function honours the user's reduced motion preference because
 * all opacity transitions are controlled via CSS (see #content transition in style.css) and
 * disabled when prefers-reduced-motion is set to reduce.
 * @param {Function} updateFn A callback that updates the inner HTML of the content element.
 */
function crossFade(updateFn) {
  const content = document.getElementById('content');
  if (!content) {
    updateFn();
    return;
  }
  // Trigger fade-out
  content.style.opacity = '0';
  // After the fade-out completes (250ms per CSS), perform the update and fade back in
  setTimeout(() => {
    updateFn();
    // Use requestAnimationFrame to ensure the DOM updates before fading back in
    requestAnimationFrame(() => {
      content.style.opacity = '1';
    });
  }, 250);
}

/**
 * Smooth page transition helper. Uses the View Transitions API when available
 * for seamless transitions that capture the old and new views. Falls back
 * to crossFade for browsers that do not support the API. The updateFn
 * parameter should synchronously modify the DOM to reflect the new page.
 * @param {Function} updateFn
 */
function smoothTransition(updateFn) {
  // For now, disable all animations during page transitions. Simply call
  // the update function to swap content immediately. This avoids choppy
  // transitions on some devices. If animations are reintroduced later,
  // this function can be updated accordingly.
  if (typeof updateFn === 'function') {
    updateFn();
  }
}

function showPage(page) {
  const content = document.getElementById('content');

  // Update active nav button styling
  document.querySelectorAll('nav button').forEach(btn => {
    btn.classList.remove('nav-active');
  });
  const activeBtn = document.querySelector(`nav button[data-page="${page}"]`);
  if (activeBtn) {
    activeBtn.classList.add('nav-active');
  }

  // keep URL hash in sync with current page
  if (page && window.location.hash !== `#${page}`) {
    window.location.hash = `#${page}`;
  }

  // Helper to render the Home page
  const renderHome = () => {
    content.innerHTML = `
      <h2>Welcome</h2>
      <p>Select a section above or jump into a core tool.</p>

      <div class="home-quick-links">
        <button type="button"
                class="tools-menu-item home-quick-link"
                onclick="showPage('logs')">
          📋 Open Logs
        </button>
        <button type="button"
                class="tools-menu-item home-quick-link"
                onclick="showPage('diagnostics')">
          🔍 Diagnostics
        </button>
        <button type="button"
                class="tools-menu-item home-quick-link"
                onclick="showPage('calculators')">
          🧪 Calculators
        </button>
      </div>

      <div class="home-install-tip">
        <button id="installBtn" onclick="installPWA()" class="btn-primary" style="display: none;">
          📱 Install App to Home Screen
        </button>
        <p class="home-tip-text">
          💡 <strong>Tip:</strong> Install this app to your device for offline access and a native app experience!
        </p>
      </div>
    `;
  };

  // Helper to render the chemical library page
  const renderChemicals = () => {
    content.innerHTML = `
      <h2>Chemical Library</h2>
      <p class="muted">
        Search by product, type, or MOA. Use filters for quick narrowing.
      </p>

      <div class="chem-filter-bar">
        <button type="button" class="chem-filter-btn" data-filter="all"
          onclick="setChemFilter('all')">All</button>
        <button type="button" class="chem-filter-btn" data-filter="favorite"
          onclick="setChemFilter('favorite')">Favorites</button>
        <button type="button" class="chem-filter-btn" data-filter="herbicide"
          onclick="setChemFilter('herbicide')">Herbicides</button>
        <button type="button" class="chem-filter-btn" data-filter="insecticide"
          onclick="setChemFilter('insecticide')">Insecticides</button>
        <button type="button" class="chem-filter-btn" data-filter="fungicide"
          onclick="setChemFilter('fungicide')">Fungicides</button>
        <button type="button" class="chem-filter-btn" data-filter="nutrient"
          onclick="setChemFilter('nutrient')">Nutrients/Fertilizers</button>
        <button type="button" class="chem-filter-btn" data-filter="granular"
          onclick="setChemFilter('granular')">Granular</button>
        <button type="button" class="chem-filter-btn" data-filter="other"
          onclick="setChemFilter('other')">Other</button>
      </div>

      <div class="chem-search-bar">
        <input id="chemSearch" type="text" placeholder="Search chemicals..." />
      </div>

      <div id="chemQuickResults" class="chem-quick-results">
        <p class="muted">Start typing or use a filter to see matching products.</p>
      </div>
    `;

    // Set default filter and render initial results
    currentChemFilter = 'all';
    updateChemFilterButtons();
    renderChemicalQuickResults('');

    // Attach listener for search input
    const search = document.getElementById('chemSearch');
    if (search) {
      search.addEventListener('input', (e) => {
        const term = e.target.value;
        renderChemicalQuickResults(term);
      });
    }
  };

  // Skeleton loader markup for chemical library
  const chemicalSkeleton = () => {
    return `
      <h2>Chemical Library</h2>
      <p class="muted">Loading chemical library…</p>
      <div class="chem-skeleton">
        ${Array.from({ length: 5 }).map(() => {
          return `<div class="skeleton-line" style="height:1.2rem; width:100%; margin-bottom:0.6rem;"></div>`;
        }).join('')}
      </div>
    `;
  };

  // Determine which page to render
  if (page === 'home') {
    smoothTransition(renderHome);
    return;
  }

  if (page === 'chemicals') {
    // Immediately show skeleton (no fade) for perceived performance, then transition to real content
    content.innerHTML = chemicalSkeleton();
    // Render actual chemical page after a short delay to allow skeleton to be visible
    setTimeout(() => {
      smoothTransition(renderChemicals);
    }, 300);
    return;
  }

  // For other pages, cross fade into the appropriate renderer
  if (page === 'calculators') {
    smoothTransition(() => {
      renderCalculators();
    });
    return;
  }
  // Redirect old calculator pages to new unified page
  if (page === 'mix' || page === 'granular') {
    const tab = page; // preserve which tab to show
    smoothTransition(() => {
      renderCalculators(tab);
    });
    return;
  }
  if (page === 'logs') {
    smoothTransition(() => {
      renderLogs();
    });
    return;
  }
  if (page === 'treatment') {
    smoothTransition(() => {
      renderLogs('treatment');
    });
    return;
  }
  if (page === 'diagnostics') {
    smoothTransition(() => {
      renderDiagnostics();
    });
    return;
  }
  if (page === 'scouting') {
    smoothTransition(() => {
      renderLogs('scouting');
    });
    return;
  }
  if (page === 'rotation') {
    smoothTransition(() => {
      renderRotation();
    });
    return;
  }
  if (page === 'review') {
    smoothTransition(() => {
      renderLogReview();
    });
    return;
  }
}

// ====== FILTER HELPERS ======
function chemMatchesCurrentFilter(chem) {
  const cat = (chem.category || "").toLowerCase();
  const type = (chem.type || "").toLowerCase();
  const name = (chem.name || "").toLowerCase();

  const isGranular =
    type.includes("granular") ||
    cat.includes("granular") ||
    name.includes("granular");

  switch (currentChemFilter) {
    case "herbicide":
      return cat.includes("herbicide");
    case "insecticide":
      return cat.includes("insecticide");
    case "fungicide":
      return cat.includes("fungicide");
    case "nutrient":
      return (
        cat.includes("fertilizer") ||
        cat.includes("nutrient") ||
        type.includes("fertilizer") ||
        type.includes("nutrient")
      );
    case "granular":
      return isGranular;
    case "favorite":
      return isChemicalFavorite(chem.id);
    case "other":
      return !(
        cat.includes("herbicide") ||
        cat.includes("insecticide") ||
        cat.includes("fungicide") ||
        cat.includes("fertilizer") ||
        cat.includes("nutrient") ||
        isGranular
      );
    case "all":
    default:
      return true;
  }
}

function setChemFilter(filterKey) {
  currentChemFilter = filterKey;
  updateChemFilterButtons();

  const search = document.getElementById('chemSearch');
  const term = search ? search.value : "";
  renderChemicalQuickResults(term);
}

function updateChemFilterButtons() {
  const buttons = document.querySelectorAll('.chem-filter-btn');
  buttons.forEach(btn => {
    if (btn.dataset.filter === currentChemFilter) {
      btn.classList.add('active-filter');
    } else {
      btn.classList.remove('active-filter');
    }
  });
}


// ====== CHEMICAL TABLE + DROPDOWN DETAILS ======

// Helper function to generate table rows with details (used by both quick results and full table)
function generateChemicalTableRows(chem) {
  const favoriteStar = isChemicalFavorite(chem.id) ? '★ ' : '';
  return `
    <tr class="chem-row" onclick="toggleChemicalDetail('${chem.id}')">
      <td>
        <span class="chem-name">
          ${favoriteStar ? `<span class="chem-fav-star" aria-hidden="true">★</span>` : ""}
          <span class="chem-name-text">${chem.name}</span>
        </span>
      </td>
      <td>${chem.type}</td>
      <td>${chem.moa}</td>
      <td>${chem.rei || "See label"}</td>
      <td>${chem.mixRate || ""}</td>
    </tr>

    <tr id="detail-${chem.id}" class="chem-detail-row">
      <td colspan="5">
        <div class="chem-detail-grid">
          
          <div>
            <h3 class="subheading">Product Information</h3>
            <p><strong>ID:</strong> ${chem.id}</p>
            <p><strong>Category:</strong> ${chem.category || "N/A"}</p>
            <p><strong>Type/Formulation:</strong> ${chem.type || "N/A"}</p>
            <p><strong>Manufacturer:</strong> ${chem.manufacturer || "N/A"}</p>
            <p><strong>Active Ingredient(s):</strong> ${chem.actives || "N/A"}</p>
          </div>

          <div>
            <h3 class="subheading">Mode of Action (MOA)</h3>
            <p><strong>MOA Code:</strong> ${chem.moa || "N/A"}</p>
            <p><strong>MOA Name:</strong> ${chem.moaName || "N/A"}</p>
            <p><strong>MOA Description:</strong> ${chem.moaDescription || "N/A"}</p>
            <p><strong>IPM Category:</strong> ${chem.ipmCategory || "N/A"}</p>
            <p><strong>Systemic/Contact:</strong> ${chem.systemic || "N/A"}</p>
          </div>

          <div>
            <h3 class="subheading">Application & Dosage</h3>
            <p><strong>Application Type:</strong> ${chem.appType || "N/A"}</p>
            <p><strong>Mix Rate:</strong> ${chem.mixRate || "N/A"}</p>
            <p><strong>REI (Reentry Interval):</strong> ${chem.rei || "N/A"} hours</p>
            <p><strong>Target Spectrum:</strong> ${chem.targetSpectrum || "N/A"}</p>
            <p><strong>Target Types:</strong> ${chem.targetTypes || "N/A"}</p>
          </div>

          <div>
            <h3 class="subheading">Legal & Safety</h3>
            <p><strong>Allowed Sites (FL):</strong> ${chem.allowedSites || "N/A"}</p>
            <p><strong>Restrictions:</strong> ${chem.restrictions || "N/A"}</p>
            <p><strong>EPA Reg #:</strong> ${chem.epaRegNum || "N/A"}</p>
            <p><strong>EPA Label:</strong> <a href="${chem.epaLabelUrl || '#'}" target="_blank" style="color: var(--color-accent);">View Label ${chem.epaLabelUrl && chem.epaLabelUrl !== "Check EPA website" ? "↗" : ""}</a></p>
          </div>

        </div>

        ${chem.notes ? `
          <div class="chem-notes-panel">
            <h3 class="subheading">Notes</h3>
            <p>${chem.notes}</p>
          </div>
        ` : ""}

        <div class="chem-detail-actions">
          <button type="button"
                  class="chem-fav-btn"
                  onclick="event.stopPropagation(); toggleChemFavorite('${chem.id}')">
            ${
              isChemicalFavorite(chem.id)
                ? "★ Favorited"
                : "☆ Add to favorites"
            }
          </button>

          ${
            (typeof chem.defaultRatePerGallon === "number" && !isNaN(chem.defaultRatePerGallon))
              ? `<button type="button"
                         class="btn-accent chem-to-mix-btn"
                         onclick="event.stopPropagation(); addToMix('${chem.id}')">
                   Add to Mix
                 </button>`
              : `<button type="button"
                         class="btn-disabled chem-to-mix-btn"
                         disabled>
                   No stored per-gallon rate
                 </button>`
          }
        </div>

        <p class="muted legal-note">
          Always follow the most recent EPA label and FDACS regulations. The label is the law.
        </p>
      </td>
    </tr>
  `;
}

function toggleChemicalDetail(id) {
  const row = document.getElementById(`detail-${id}`);
  if (!row) {
    console.warn(`Detail row not found for ID: ${id}`);
    return;
  }

  const isOpen = row.classList.contains('open');

  document.querySelectorAll('.chem-detail-row')
    .forEach(r => r.classList.remove('open'));

  if (!isOpen) {
    row.classList.add('open');
    console.log(`Opened detail for chemical: ${id}`);
  } else {
    console.log(`Closed detail for chemical: ${id}`);
  }
}


// ====== QUICK RESULTS (SEARCH-FIRST VIEW) ======
function renderChemicalQuickResults(filterTerm = "") {
  if (typeof window.chemicals === 'undefined') {
    const container = document.getElementById('chemQuickResults');
    showLoadingTarget(container, 'Loading chemical library…');
    ensureChemicalsAvailable()
      .then(() => renderChemicalQuickResults(filterTerm))
      .catch(() => { if (container) container.innerHTML = '<p>Unable to load chemical data.</p>'; });
    return;
  }

  const container = document.getElementById('chemQuickResults');
  if (!container) return;

  const term = filterTerm.trim().toLowerCase();

  // Base list always respects the current filter (All, Favorites, Herbicides, etc.)
  let base = chemicals.filter(chemMatchesCurrentFilter);

  // Always sort alphabetically by product name
  base = base.slice().sort((a, b) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  );

  if (!base.length) {
    container.innerHTML = `<p class="muted">No products match this filter yet.</p>`;
    return;
  }

  // If no search term, show the full filtered list
  if (!term) {
    container.innerHTML = `
      <table class="chem-table" style="margin-top: 0;">
        <tbody>
          ${base.map(c => generateChemicalTableRows(c)).join("")}
        </tbody>
      </table>
    `;
    return;
  }

  // When there is a search term, filter within the already-filtered, sorted base list.
  const filtered = base.filter(c =>
    c.name.toLowerCase().includes(term) ||
    c.type.toLowerCase().includes(term) ||
    c.moa.toLowerCase().includes(term)
  );

  if (!filtered.length) {
    container.innerHTML = `<p>No matches found.</p>`;
    return;
  }

  container.innerHTML = `
    <table class="chem-table" style="margin-top: 0;">
      <tbody>
        ${filtered.map(c => generateChemicalTableRows(c)).join("")}
      </tbody>
    </table>
  `;
}



// ====== TOOLS MENU (MODAL NAV) ======
function openToolsMenu() {
  const overlay = document.getElementById('toolsMenuOverlay');
  if (!overlay) return;
  overlay.classList.add('is-open');
  overlay.setAttribute('aria-hidden', 'false');
}

function closeToolsMenu() {
  const overlay = document.getElementById('toolsMenuOverlay');
  if (!overlay) return;
  overlay.classList.remove('is-open');
  overlay.setAttribute('aria-hidden', 'true');
}

function navigateFromMenu(page) {
  closeToolsMenu();
  showPage(page);
}

// Close menu on Escape key
document.addEventListener('keydown', function (evt) {
  if (evt.key === 'Escape') {
    closeToolsMenu();
  }
});

// ====== CALCULATORS (UNIFIED MIX CALCULATOR + GRANULAR HELPER) ======
function renderCalculators(defaultTab) {
  if (typeof window.chemicals === 'undefined') {
    const content = document.getElementById('content');
    showLoadingTarget(content, 'Loading chemical data for Calculators…');
    ensureChemicalsAvailable()
      .then(() => renderCalculators(defaultTab))
      .catch(() => { if (content) content.innerHTML = '<p>Failed to load chemical data.</p>'; });
    return;
  }

  const content = document.getElementById('content');
  if (!content) return;

  content.innerHTML = `
    <h2>Calculators</h2>
    <p class="muted">
      Calculate spray mixes and granular applications for your nursery.
    </p>

    <div class="logs-tabs" role="tablist" aria-label="Mix Calculator and Granular Helper">
      <button type="button"
              class="logs-tab-btn logs-tab-active"
              data-tab="mix"
              role="tab"
              aria-selected="true"
              onclick="showCalculatorTab('mix')">
        Mix Calculator
      </button>
      <button type="button"
              class="logs-tab-btn"
              data-tab="granular"
              role="tab"
              aria-selected="false"
              onclick="showCalculatorTab('granular')">
        Granular Helper
      </button>
    </div>

    <div id="calculatorBody" class="logs-body" role="tabpanel" aria-live="polite"></div>
  `;

  const initial = defaultTab === 'granular' ? 'granular' : 'mix';
  showCalculatorTab(initial);
}

function showCalculatorTab(tab) {
  const body = document.getElementById('calculatorBody');
  if (!body) return;

  const buttons = document.querySelectorAll('.logs-tabs .logs-tab-btn');
  buttons.forEach(btn => {
    const btnTab = btn.getAttribute('data-tab');
    const isActive = btnTab === tab;
    btn.classList.toggle('logs-tab-active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  if (tab === 'granular') {
    renderGranularHelperTab(body);
  } else {
    renderMixCalculatorTab(body);
  }
}

// ====== MIX CALCULATOR TAB (DYNAMIC MULTI-CHEMICAL + COVERAGE) ======
function renderMixCalculatorTab(targetEl) {
  const content = targetEl || document.getElementById('content');
      .then(() => renderMixCalculatorTab(targetEl))
      .catch(() => { if (content) content.innerHTML = '<p>Failed to load chemical data.</p>'; });
    return;
  }

  // Build a sorted list of non‑granular chemicals for the Mix Calculator dropdown.
  // Store both the raw data and the HTML options string globally so that
  // they can be reused when filtering via the search inputs.
  mixChemicalOptionsData = chemicals
    .filter(c => {
      const cat = (c.category || '').toLowerCase();
      const type = (c.type || '').toLowerCase();
      const name = (c.name || '').toLowerCase();
      const isGranular = type.includes('granular') || cat.includes('granular') || name.includes('granular');
      return !isGranular;
    })
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(c => ({ id: c.id, name: c.name }));

  mixChemicalOptionsHTML = [
    '<option value="">Select chemical</option>',
    ...mixChemicalOptionsData.map(item => `<option value="${item.id}">${item.name}</option>`)
  ].join('');

  // reset row count each time we open the Mix tab
  mixChemRowCount = 0;

  content.innerHTML = `
    <h3 class="subheading">Mix Calculator</h3>
    <p class="muted">
      Select one or more chemicals and enter your tank size in gallons.
      Rates are based on each product's stored per-gallon rate
      (often coming from label guidance per 1,000 sq ft). Always verify against the current label.
    </p>

    <form class="mix-form" onsubmit="event.preventDefault(); calculateMix();">
      <label for="mixTankSize">Tank size (gallons)</label>
      <input id="mixTankSize" type="number" step="1" min="1" placeholder="e.g. 25" />

      <p class="muted" style="font-size:0.8rem; margin-top:0.1rem;">
        Coverage assumes <strong>1 gallon of spray per 1,000 sq ft</strong>. Just enter your tank size in gallons.
      </p>

      <div class="mix-chem-group">
        <h3 class="subheading">Chemicals in this tank</h3>
        <p class="muted">Start with one chemical, then tap “+ Add chemical” if needed.</p>

        <div id="mixChemContainer"></div>

        <button type="button" class="btn-accent mix-add-btn" onclick="addMixChemicalRow()">
          + Add chemical
        </button>
      </div>

      <button class="btn-primary mix-btn">Calculate Amounts</button>
    </form>

    <div id="mixResult" class="mix-result muted">
      Enter a tank size, spray volume, and choose at least one chemical.
    </div>
  `;

  // Add rows based on any queued chemicals from the library.
  // If none are queued, start with a single blank row.
  const container = document.getElementById('mixChemContainer');
  if (container) {
    if (Array.isArray(pendingMixChemicalIds) && pendingMixChemicalIds.length > 0) {
      pendingMixChemicalIds.forEach((chemId) => {
        addMixChemicalRow();
        const select = document.getElementById(`mixChemical${mixChemRowCount}`);
        if (select) {
          select.value = chemId;
          updateMixRateInfo(mixChemRowCount);
        }
      });
      // Clear the queue so it only applies on first load
      pendingMixChemicalIds = [];
    } else {
      addMixChemicalRow();
    }
  }
}

function addMixChemicalRow() {
  const container = document.getElementById('mixChemContainer');
  if (!container) return;

  mixChemRowCount += 1;
  const index = mixChemRowCount;

  const row = document.createElement('div');
  row.className = 'mix-chem-row';
  row.setAttribute('data-index', index);

  row.innerHTML = `
    <label for="mixChemical${index}">Chemical ${index}</label>
    <div class="mix-search-select">
      <input type="text" placeholder="Search chemical…" oninput="filterMixOptions(${index}, this.value)" aria-label="Search chemicals" />
      <select id="mixChemical${index}" onchange="updateMixRateInfo(${index})">
        ${mixChemicalOptionsHTML}
      </select>
    </div>
    <div id="mixRateInfo${index}" class="mix-chem-rate muted"></div>
    <button type="button" class="mix-remove-btn" onclick="removeMixChemicalRow(${index})">
      Remove
    </button>
  `;

  container.appendChild(row);
}

function removeMixChemicalRow(index) {
  const container = document.getElementById('mixChemContainer');
  if (!container) return;

  const row = container.querySelector(`.mix-chem-row[data-index="${index}"]`);
  if (!row) return;

  row.remove();

  const remainingRows = container.querySelectorAll('.mix-chem-row');

  // Always keep at least one row
  if (remainingRows.length === 0) {
    // Reset the counter so the next row starts back at "Chemical 1"
    mixChemRowCount = 0;
    addMixChemicalRow();
    return;
  }

  // If only one row remains, normalize its label to "Chemical 1"
  if (remainingRows.length === 1) {
    const onlyRow = remainingRows[0];
    const label = onlyRow.querySelector('label');
    if (label) {
      label.textContent = "Chemical 1";
    }
  }
}

function updateMixRateInfo(index) {
  const select = document.getElementById(`mixChemical${index}`);
  const infoDiv = document.getElementById(`mixRateInfo${index}`);
  if (!select || !infoDiv) return;

  const chemId = select.value;
  if (!chemId) {
    infoDiv.textContent = "";
    return;
  }

  // Prevent duplicate selections across rows
  const allSelects = document.querySelectorAll('.mix-chem-row select');
  let duplicate = false;
  allSelects.forEach(sel => {
    if (sel !== select && sel.value === chemId) {
      duplicate = true;
    }
  });

  if (duplicate) {
    infoDiv.textContent = "Already selected in another row. Each chemical should only appear once per tank.";
    select.value = "";
    return;
  }

  const chem = chemicals.find(c => c.id === chemId);
  if (!chem) {
    infoDiv.textContent = "";
    return;
  }

  if (typeof chem.defaultRatePerGallon === "number" && !isNaN(chem.defaultRatePerGallon) && chem.defaultRatePerGallon > 0) {
    infoDiv.textContent =
      `Default: ${chem.defaultRatePerGallon} fl oz per gal. ${chem.rateNote || ""}`;
  } else {
    const labelRate = chem.mixRate
      ? `Label mix rate: ${chem.mixRate}`
      : "Check the product label for mix rates.";
    infoDiv.textContent = labelRate;
  }
}

/**
 * Filter the chemical options for a given row based on a search term. The
 * function rebuilds the select options using the globally stored
 * mixChemicalOptionsData, preserving the previously selected value if it
 * still matches the filter. If the previous value is no longer in the
 * filtered list, the selection is cleared and rate info reset. This
 * improves usability when the chemical list is long.
 * @param {number} index Row index corresponding to the select element ID
 * @param {string} term The search term to filter by (case-insensitive)
 */
function filterMixOptions(index, term) {
  const select = document.getElementById(`mixChemical${index}`);
  if (!select) return;

  const normalized = (term || '').trim().toLowerCase();
  const options = [];
  options.push('<option value="">Select chemical</option>');
  mixChemicalOptionsData.forEach(item => {
    if (!normalized || item.name.toLowerCase().includes(normalized)) {
      options.push(`<option value="${item.id}">${item.name}</option>`);
    }
  });
  const prevValue = select.value;
  select.innerHTML = options.join('');
  // Restore previous selection if still present
  if (prevValue && Array.from(select.options).some(opt => opt.value === prevValue)) {
    select.value = prevValue;
  } else {
    // Clear selection and related rate info if selection no longer valid
    select.value = '';
    updateMixRateInfo(index);
  }
}

function calculateMix() {
  const FL_OZ_TO_ML = 29.57;

  const tankSizeInput = document.getElementById('mixTankSize');
  const resultDiv = document.getElementById('mixResult');

  const tank = parseFloat(tankSizeInput.value);
  const sprayVol = 1; // fixed 1 gal per 1,000 sq ft assumption

  if (!tank || tank <= 0) {
    resultDiv.innerHTML = "Enter a valid tank size in gallons.";
    return;

  
  }
  
  // Coverage estimation: with fixed 1 gal per 1,000 sq ft,
  // coverage is simply tank gallons * 1,000 sq ft per gallon.
  const estimatedCoverageSqFt = tank * 1000;

  // Collect all chosen chemicals from dynamically added rows
  const selectElements = document.querySelectorAll('.mix-chem-row select');
  const chemIds = [];
  selectElements.forEach(sel => {
    const val = sel.value;
    if (val) chemIds.push(val);
  });

  if (chemIds.length === 0) {
    resultDiv.innerHTML = "Select at least one chemical.";
    return;
  }

  let html = `
    <p><strong>Tank size:</strong> ${tank} gallons</p>
    <p><strong>Spray volume:</strong> ${sprayVol} gal per 1,000 sq ft</p>
    <p><strong>Estimated coverage:</strong> ${estimatedCoverageSqFt.toFixed(0)} sq ft</p>
  `;

  html += `<p><strong>Chemicals and amounts:</strong></p><ul>`;

  const mixItems = [];

  chemIds.forEach(id => {
    const chem = chemicals.find(c => c.id === id);
    if (!chem) return;

    if (typeof chem.defaultRatePerGallon !== "number" || chem.defaultRatePerGallon <= 0) {
      const labelRate = chem.mixRate
        ? `Label mix rate: ${chem.mixRate}`
        : "Check the product label for exact rates.";
      html += `<li>${chem.name}: ${labelRate}</li>`;
      return;
    }

    const flOz = chem.defaultRatePerGallon * tank;
    const ml = flOz * FL_OZ_TO_ML;

    html += `<li>
      ${chem.name}: ${flOz.toFixed(2)} fl oz (≈ ${ml.toFixed(0)} mL)
      at ${chem.defaultRatePerGallon} fl oz per gal.
    </li>`;

    mixItems.push({
      id,
      name: chem.name,
      ratePerGallon: chem.defaultRatePerGallon,
      flOz,
      ml
    });
  });

  html += `</ul>`;

  // Store last mix for Treatment Log handoff
  if (mixItems.length > 0) {
    const mixText = mixItems
      .map(item => `${item.name}: ${item.flOz.toFixed(2)} fl oz (~${item.ml.toFixed(0)} mL) at ${item.ratePerGallon} fl oz/gal`)
      .join('\n');

    lastMixCalc = {
      tank,
      sprayVol,
      estimatedCoverageSqFt,
      mixText
    };

    html += `
      <button type="button"
              class="btn-accent mix-btn"
              style="margin-top:0.5rem;"
              onclick="sendLastMixToTreatment()">
        Send to Treatment Log
      </button>
    `;
  }

  html += `
    <p class="muted" style="margin-top:0.5rem;">
      Coverage is an estimate based on a fixed 1 gallon of spray per 1,000 sq ft.
      Chemical amounts are based on stored per-gallon rates. Always verify exact rates
      and maximum applications on the current product label. The label is the law.
    </p>
  `;

  resultDiv.innerHTML = html;
}

// ====== GRANULAR HELPER TAB (GRANULAR PRODUCT CALCULATOR) ======
function renderGranularHelperTab(targetEl) {
  const content = targetEl || document.getElementById('content');

  // Build a sorted list of granular products for selection
  const granularProducts = chemicals
    .filter(c => {
      const cat = (c.category || '').toLowerCase();
      const type = (c.type || '').toLowerCase();
      const name = (c.name || '').toLowerCase();
      return type.includes('granular') || cat.includes('granular') || name.includes('granular');
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const options = [
    '<option value="">Select granular product</option>',
    ...granularProducts.map(c => `<option value="${c.id}">${c.name}</option>`)
  ].join('');

  content.innerHTML = `
    <h3 class="subheading">Granular Helper</h3>
    <p class="muted">
      Calculate how much granular product you need based on area and label rate.
      This is a helper only; always follow the current product label.
    </p>

    <form id="granularForm" class="mix-form" onsubmit="event.preventDefault(); calculateGranular();">
      <label for="granularProduct">Product</label>
      <select id="granularProduct">
        ${options}
      </select>

      <label for="granularArea">Area to treat (sq ft)</label>
      <input id="granularArea" type="number" step="1" min="0" placeholder="e.g. 5000" />

      <!-- Hidden input to store the calculated application rate (lbs per 1,000 sq ft) -->
      <input id="granularRate" type="hidden" />

      <button class="btn-primary mix-btn" style="margin-top: 1rem;">Calculate Product Needed</button>
    </form>

    <div id="granularResult" class="mix-result muted" style="margin-top: 1.5rem;">
      Enter the area and select a product to see granular product needed.
    </div>

    <p class="muted" style="margin-top: 1.5rem; font-size: 0.85rem;">
      This helper assumes a uniform granular application over the entered area.
      Always confirm rates, calibration, and spreader settings on the current product label. The label is the law.
    </p>
  `;

  // When a product is selected, automatically populate the rate field using the product's label rate if available
  const productSelect = document.getElementById('granularProduct');
  const rateInput = document.getElementById('granularRate');
  if (productSelect && rateInput) {
    productSelect.addEventListener('change', () => {
      const selectedId = productSelect.value;
      if (!selectedId) {
        rateInput.value = '';
        return;
      }
      const chem = chemicals.find(c => c.id === selectedId);
      if (!chem) {
        rateInput.value = '';
        return;
      }
      // Use the stored default granular rate per thousand square feet if available
      let rate = chem.defaultGranularRatePerThousandSqFt;
      // If not present, attempt to extract a numeric rate from the chemical's mixRate string as a fallback
      if (!rate && chem.mixRate) {
        const match = chem.mixRate.match(/([0-9]+\.?[0-9]*)/);
        if (match) rate = parseFloat(match[1]);
      }
      if (rate && !isNaN(rate)) {
        rateInput.value = rate;
      } else {
        rateInput.value = '';
      }
    });
  }
}

function calculateGranular() {
  const nameSelect = document.getElementById('granularProduct');
  const areaInput = document.getElementById('granularArea');
  const rateInput = document.getElementById('granularRate');
  const resultDiv = document.getElementById('granularResult');
  const productName = nameSelect && nameSelect.selectedIndex > 0 ? nameSelect.options[nameSelect.selectedIndex].text : '';
  const areaSqFt = parseFloat(areaInput.value);
  const ratePerThousand = parseFloat(rateInput.value); // lbs per 1,000 sq ft (auto calculated)

  if (!areaSqFt || areaSqFt <= 0) {
    resultDiv.innerHTML = 'Enter a valid area in square feet.';
    return;
  }
  if (!ratePerThousand || ratePerThousand <= 0 || isNaN(ratePerThousand)) {
    resultDiv.innerHTML = 'No stored application rate for the selected product. Please refer to the product label.';
    return;
  }

  const areaThousands = areaSqFt / 1000;
  const totalLbs = areaThousands * ratePerThousand;

  let html = '';
  if (productName) {
    html += `<p><strong>Product:</strong> ${productName}</p>`;
  }
  html += `
    <p><strong>Area:</strong> ${areaSqFt.toFixed(0)} sq ft (${areaThousands.toFixed(2)} × 1,000 sq ft)</p>
    <p><strong>Rate:</strong> ${ratePerThousand} lbs per 1,000 sq ft</p>
    <p><strong>Total product needed:</strong> ${totalLbs.toFixed(2)} lbs</p>
  `;
  resultDiv.innerHTML = html;
}

// ====== DIAGNOSTICS (OBSERVATION ANALYZER) ======
function renderDiagnostics() {
  const content = document.getElementById('content');

  content.innerHTML = `
    <h2>Diagnostics</h2>
    <p class="muted">Describe what you're observing. Later: full AI diagnostics.</p>

    <form class="diag-form" onsubmit="event.preventDefault(); diagnoseIssue();">

      <label for="diagCrop">Crop</label>
      <input id="diagCropSearch" placeholder="Search crops..." />
      <select id="diagCrop">
        <option value="">Select crop</option>
      </select>

      <label for="diagSymptomType">Issue type</label>
      <select id="diagSymptomType">
        <option value="">Select one</option>
        <option value="pest">Pest / Insect</option>
        <option value="disease">Disease</option>
        <option value="weed">Weed</option>
        <option value="nutrient">Nutrient issue</option>
        <option value="abiotic">Abiotic / Stress</option>
      </select>

      <label for="diagPart">Where is it showing?</label>
      <input id="diagPart" placeholder="new leaves, old leaves, stems, whole plant..." />

      <label for="diagPattern">Pattern / spread</label>
      <input id="diagPattern" placeholder="edges, low spots, scattered, uniform..." />

      <label for="diagSeverity">Severity</label>
      <select id="diagSeverity">
        <option value="">Select</option>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>

      <label for="diagNotes">Description</label>
      <textarea id="diagNotes" rows="3" placeholder="Describe symptoms, timing, weather..."></textarea>

      <button class="btn-primary diag-btn">Analyze Observations</button>
    </form>

    <div id="diagResult" class="diag-result muted">
      Fill out the form for a structured summary.
    </div>
  `;
  populatePlantSelect('diagCrop', 'diagCropSearch');
}

function diagnoseIssue() {
  const cropSelect = document.getElementById('diagCrop');
  let crop = "";
  let plantId = "";
  if (cropSelect) {
    const opt = cropSelect.options[cropSelect.selectedIndex] || null;
    if (opt) {
      crop = (opt.text || opt.value || "").trim();
      plantId = (opt.getAttribute('data-plant-id') || opt.value || "").trim();
    }
  }

  const type = document.getElementById('diagSymptomType').value;
  const part = document.getElementById('diagPart').value.trim();
  const pattern = document.getElementById('diagPattern').value.trim();
  const severity = document.getElementById('diagSeverity').value;
  const notes = document.getElementById('diagNotes').value.trim();
  const result = document.getElementById('diagResult');

  if (!crop && !type && !notes) {
    result.innerHTML = "Enter at least a crop, issue type, or symptoms.";
    return;
  }

  let output = "<p><strong>Observation Summary</strong></p><ul>";

  if (crop) output += `<li><strong>Crop:</strong> ${crop}</li>`;
  if (type) output += `<li><strong>Issue type:</strong> ${type}</li>`;
  if (part) output += `<li><strong>Location:</strong> ${part}</li>`;
  if (pattern) output += `<li><strong>Pattern:</strong> ${pattern}</li>`;
  if (severity) output += `<li><strong>Severity:</strong> ${severity}</li>`;
  if (notes) output += `<li><strong>Symptoms:</strong> ${notes}</li>`;

  output += "</ul>";

  // Core, label-safe guidance
  output += `
    <p><strong>Initial Thoughts</strong></p>
    <ul>
      ${
        type === "pest"
          ? "<li>Check undersides of leaves for insects, frass, or webbing.</li>"
        : type === "disease"
          ? "<li>Look for leaf spots, lesions, molds; note new vs old growth.</li>"
        : type === "nutrient"
          ? "<li>Check if yellowing is between veins or at edges/tips.</li>"
        : type === "abiotic"
          ? "<li>Consider heat, irrigation, wind, chemical drift, or pot stress.</li>"
        : "<li>Clarify issue type for better guidance.</li>"
      }
      <li>Capture photos and add this to the scouting log.</li>
    </ul>
  `;

  // --- VINE plant intelligence (read-only, not a confirmed diagnosis) ---
  let matchedPlant = null;
  let diagProfile = null;

  if (window.PlantUtils) {
    try {
      // Prefer an exact match via plantId when coming from the dropdown
      if (plantId && window.PlantUtils.getDiagnosticProfileSync) {
        diagProfile = window.PlantUtils.getDiagnosticProfileSync(plantId);
        if (!matchedPlant && window.PlantUtils.getPlantByIdSync) {
          matchedPlant = window.PlantUtils.getPlantByIdSync(plantId);
        }
      } else if (crop && window.PlantUtils.findBestPlantMatchSync) {
        // Fallback: fuzzy match by name if no plantId
        matchedPlant = window.PlantUtils.findBestPlantMatchSync(crop);
        if (matchedPlant && window.PlantUtils.getDiagnosticProfileSync) {
          diagProfile = window.PlantUtils.getDiagnosticProfileSync(matchedPlant.plantId);
        }
      }
    } catch (err) {
      console.error('Diagnostics lookup failed:', err);
    }
  }

  if (diagProfile) {
    const name =
      diagProfile.commonName ||
      diagProfile.botanicalName ||
      (matchedPlant && (matchedPlant.commonName || matchedPlant.botanicalName)) ||
      crop ||
      plantId;

    output += `
      <hr class="diag-divider" />
      <p><strong>Preliminary VINE Plant Intelligence</strong></p>
      <p class="muted">
        Matched crop: <strong>${name}</strong>.
        This is not a confirmed diagnosis — it is a data-driven starting point based on this plant's profile.
      </p>
    `;

    const pests = Array.isArray(diagProfile.commonPests) ? diagProfile.commonPests : [];
    const diseases = Array.isArray(diagProfile.commonDiseases) ? diagProfile.commonDiseases : [];
    const abiotic = Array.isArray(diagProfile.commonAbioticIssues) ? diagProfile.commonAbioticIssues : [];

    if (pests.length || diseases.length || abiotic.length) {
      output += "<ul>";
      if (pests.length) {
        output += `<li><strong>Common pests:</strong> ${pests.join(", ")}</li>`;
      }
      if (diseases.length) {
        output += `<li><strong>Common diseases:</strong> ${diseases.join(", ")}</li>`;
      }
      if (abiotic.length) {
        output += `<li><strong>Common abiotic issues:</strong> ${abiotic.join(", ")}</li>`;
      }
      output += "</ul>";
    }

    const patterns = Array.isArray(diagProfile.symptomPatterns)
      ? diagProfile.symptomPatterns.slice()
      : [];

    const priorityScore = (p) => {
      const v = String(p.priority || "").toLowerCase();
      if (v.startsWith("high")) return 3;
      if (v.startsWith("medium")) return 2;
      if (v.startsWith("low")) return 1;
      return 0;
    };

    const categoryMatches = (patternCategory, issueType) => {
      if (!issueType) return true;
      const c = String(patternCategory || "").toLowerCase();
      const t = String(issueType || "").toLowerCase();
      if (t === "pest") return c.includes("pest") || c.includes("insect");
      if (t === "disease") return c.includes("disease") || c.includes("fung");
      if (t === "nutrient") return c.includes("nutrient");
      if (t === "abiotic") return c.includes("abiotic") || c.includes("stress");
      return true;
    };

    const filteredPatterns = patterns
      .filter(p => categoryMatches(p.category, type))
      .sort((a, b) => priorityScore(b) - priorityScore(a));

    if (filteredPatterns.length) {
      output += "<p><strong>Pattern-based leads (not confirmed):</strong></p><ol>";
      for (const p of filteredPatterns) {
        output += "<li>";
        if (p.description) {
          output += `<div><strong>Pattern:</strong> ${p.description}</div>`;
        }
        if (p.likelyCauses) {
          output += `<div><strong>Likely causes:</strong> ${p.likelyCauses}</div>`;
        }
        if (p.category) {
          output += `<div><strong>Category:</strong> ${p.category}</div>`;
        }
        if (p.priority) {
          output += `<div><strong>Pattern priority:</strong> ${p.priority}</div>`;
        }
        output += "</li>";
      }
      output += "</ol>";
    }
  }


// Safety disclaimer stays explicit
  output += `
    <p class="muted" style="font-size:0.8rem;margin-top:0.5rem;">
      This tool does not confirm a diagnosis. It structures observations and surfaces likely directions based on your plant master.
      Always verify with labels, local extension guidance, and your own expertise.
    </p>
  `;

  // Add a handoff button to send this observation into the Scouting Log
  output += `
    <button type="button"
            class="btn-accent diag-to-scout-btn"
            style="margin-top:0.75rem;"
            onclick="sendDiagnosticsToScouting()">
      Send to Scouting Log
    </button>
  `;

  result.innerHTML = output;
}
function sendDiagnosticsToScouting() {
  const crop = (document.getElementById('diagCrop').value || "").trim();
  const issueType = document.getElementById('diagSymptomType').value || "";
  const severity = document.getElementById('diagSeverity').value || "";
  const notes = (document.getElementById('diagNotes').value || "").trim();

  pendingScoutingFromDiagnostics = {
    crop,
    issueType,
    severity,
    notes
  };

  // Navigate to the Scouting page, which will auto-prefill the form
  showPage('scouting');
}



// ====== TREATMENT LOG (FORM + TABLE + LOCAL STORAGE) ======
function sendLastMixToTreatment() {
  if (!lastMixCalc) {
    alert("Run a mix calculation first.");
    return;
  }

  pendingTreatmentFromMix = lastMixCalc;
  showPage('treatment');
}


function renderLogs(defaultTab) {
  const content = document.getElementById('content');
  if (!content) return;

  content.innerHTML = `
    <h2>Logs</h2>
    <p class="muted">
      Scouting and treatment records stored on this device.
    </p>

    <div class="logs-tabs" role="tablist" aria-label="Scouting and Treatment Logs">
      <button type="button"
              class="logs-tab-btn logs-tab-active"
              data-tab="scouting"
              role="tab"
              aria-selected="true"
              onclick="showLogsTab('scouting')">
        Scouting
      </button>
      <button type="button"
              class="logs-tab-btn"
              data-tab="treatment"
              role="tab"
              aria-selected="false"
              onclick="showLogsTab('treatment')">
        Treatment
      </button>
    </div>

    <div id="logsBody" class="logs-body" role="tabpanel" aria-live="polite"></div>
  `;

  const initial = defaultTab === 'treatment' ? 'treatment' : 'scouting';
  showLogsTab(initial);
}

function showLogsTab(tab) {
  const body = document.getElementById('logsBody');
  if (!body) return;

  const buttons = document.querySelectorAll('.logs-tab-btn');
  buttons.forEach(btn => {
    const btnTab = btn.getAttribute('data-tab');
    const isActive = btnTab === tab;
    btn.classList.toggle('logs-tab-active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  if (tab === 'treatment') {
    renderTreatment(body);
  } else {
    renderScouting(body);
  }
}

function renderTreatment(targetEl) {
  const content = targetEl || document.getElementById('content');
  if (!content) return;

  const entries = getTreatmentEntries();

  content.innerHTML = `
    <h2>Treatment Log</h2>
    <p class="muted">
      Record each spray application. Entries are stored in this browser only (local device).
    </p>

    <form class="scout-form" onsubmit="event.preventDefault(); saveTreatmentEntry();">
      <div class="scout-form-row">
        <label for="treatDate">Date</label>
        <input id="treatDate" type="date" />
      </div>

      <div class="scout-form-row">
        <label for="treatArea">Block / Area</label>
        <input id="treatArea" placeholder="e.g. Block A, Shade House, Front bed" />
      </div>

      <div class="scout-form-row">
        <label for="treatCrop">Crop</label>
        <input id="treatCropSearch" placeholder="Search crops..." />
        <select id="treatCrop">
          <option value="">Select crop</option>
        </select>
      </div>

      <div class="scout-form-row">
        <label for="treatTankSize">Tank size (gallons)</label>
        <input id="treatTankSize" type="number" step="1" min="1" placeholder="e.g. 25" />
      </div>

      <!-- Spray volume input removed. Spray volume is assumed to be 1 gal per 1,000 sq ft. -->

      <div class="scout-form-row">
        <label for="treatCoverage">Estimated coverage (sq ft)</label>
        <input id="treatCoverage" type="number" step="1" min="0" placeholder="Auto-filled from mix" />
      </div>

      <div class="scout-form-row">
        <label for="treatMix">Chemicals & amounts</label>
        <textarea id="treatMix" rows="4" placeholder="Auto-filled from Mix Calculator if sent, or enter manually."></textarea>
      </div>

      <div class="scout-form-row">
        <label for="treatNotes">Notes</label>
        <textarea id="treatNotes" rows="3" placeholder="Target pest/disease, weather, intervals, etc."></textarea>
      </div>

      <button class="btn-primary scout-btn">Save Treatment</button>
    </form>

    <div id="treatTableWrapper" class="table-wrapper">
      ${renderTreatmentTableHTML(entries)}
    </div>
  `;
  populatePlantSelect('treatCrop', 'treatCropSearch');

  // Default date to today if blank
  const dateInput = document.getElementById('treatDate');
  if (dateInput && !dateInput.value) {
    const todayStr = new Date().toISOString().slice(0, 10);
    dateInput.value = todayStr;
  }

  // If we arrived here from Mix Calculator, prefill from the stored mix
    if (pendingTreatmentFromMix) {
    const { tank, estimatedCoverageSqFt, mixText } = pendingTreatmentFromMix;

    const tankInput = document.getElementById('treatTankSize');
    if (tankInput && typeof tank === 'number') {
      tankInput.value = tank;
    }

    const covInput = document.getElementById('treatCoverage');
    if (covInput && typeof estimatedCoverageSqFt === 'number') {
      covInput.value = estimatedCoverageSqFt.toFixed(0);
    }

    const mixArea = document.getElementById('treatMix');
    if (mixArea && mixText) {
      mixArea.value = mixText;
    }

    // Clear after one use so future visits don't keep prefilling
    pendingTreatmentFromMix = null;
  }
}

function getTreatmentEntries() {
  try {
    const raw = localStorage.getItem('treatmentEntries');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Failed to read treatmentEntries from localStorage', e);
    return [];
  }
}

function setTreatmentEntries(entries) {
  try {
    localStorage.setItem('treatmentEntries', JSON.stringify(entries));
  } catch (e) {
    console.warn('Failed to save treatmentEntries to localStorage', e);
  }
}

function renderTreatmentTableHTML(entries) {
  if (!entries || !entries.length) {
    return `<p class="muted" style="margin-top:0.75rem;">No treatment entries yet.</p>`;
  }

  const rows = entries
    .map((e, index) => `
      <tr>
        <td>${e.date || ""}</td>
        <td>${e.area || ""}</td>
        <td>${e.crop || ""}</td>
        <td>${e.tankSize || ""}</td>
        <td>${e.coverage || ""}</td>
        <td>${(e.mix || "").replace(/\n/g, '<br>')}</td>
        <td>${e.notes || ""}</td>
        <td>
          <button type="button" class="mix-remove-btn" onclick="deleteTreatmentEntry(${index})">
            Delete
          </button>
        </td>
      </tr>
    `)
    .join("");

  return `
    <table class="scout-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Area</th>
          <th>Crop</th>
          <th>Tank (gal)</th>
          <th>Coverage (sq ft)</th>
          <th>Mix</th>
          <th>Notes</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function saveTreatmentEntry() {
  const dateEl = document.getElementById('treatDate');
  const areaEl = document.getElementById('treatArea');
  const cropEl = document.getElementById('treatCrop');
  const tankEl = document.getElementById('treatTankSize');
  const covEl = document.getElementById('treatCoverage');
  const mixEl = document.getElementById('treatMix');
  const notesEl = document.getElementById('treatNotes');

  const date = dateEl ? dateEl.value.trim() : "";
  const area = areaEl ? areaEl.value.trim() : "";
  const crop = cropEl
    ? ((cropEl.options[cropEl.selectedIndex] || {}).text || (cropEl.value || "")).trim()
    : "";
  const tankSize = tankEl ? tankEl.value.trim() : "";
  // Spray volume is assumed to be 1 gal per 1,000 sq ft; no input field
  const sprayVolume = "1";
  const coverage = covEl ? covEl.value.trim() : "";
  const mix = mixEl ? mixEl.value.trim() : "";
  const notes = notesEl ? notesEl.value.trim() : "";

  if (!date && !area && !crop && !mix && !notes) {
    alert("Enter at least a date, area, crop, mix, or notes.");
    return;
  }

  const entries = getTreatmentEntries();
  entries.push({
    date,
    area,
    crop,
    tankSize,
    sprayVolume,
    coverage,
    mix,
    notes
  });

  setTreatmentEntries(entries);

  // Re-render page (form + table) with updated data
  const logsBody = document.getElementById('logsBody');
  if (logsBody) {
    renderTreatment(logsBody);
  } else {
    renderTreatment();
  }
}

function deleteTreatmentEntry(index) {
  const entries = getTreatmentEntries();
  if (index < 0 || index >= entries.length) return;

  entries.splice(index, 1);
  setTreatmentEntries(entries);

  const logsBody = document.getElementById('logsBody');
  if (logsBody) {
    renderTreatment(logsBody);
  } else {
    renderTreatment();
  }
}
// ====== SCOUTING LOG (FORM + TABLE + LOCAL STORAGE) ======

function renderScouting(targetEl) {
  const content = targetEl || document.getElementById('content');
  const entries = getScoutingEntries();

  content.innerHTML = `
    <h2>Scouting Log</h2>
    <p class="muted">
      Record each scouting stop. Entries are stored in this browser only (local device).
    </p>

    <form class="scout-form" onsubmit="event.preventDefault(); saveScoutingEntry();">
      <div class="scout-form-row">
        <label for="scoutDate">Date</label>
        <input id="scoutDate" type="date" />
      </div>

      <div class="scout-form-row">
        <label for="scoutArea">Block / Area</label>
        <input id="scoutArea" placeholder="e.g. Block A, Shade House, Front bed" />
      </div>

      <div class="scout-form-row">
        <label for="scoutCrop">Crop</label>
        <input id="scoutCropSearch" placeholder="Search crops..." />
        <select id="scoutCrop">
          <option value="">Select crop</option>
        </select>
      </div>

      <div class="scout-form-row">
        <label for="scoutIssueType">Issue type</label>
        <select id="scoutIssueType">
          <option value="">Select one</option>
          <option value="pest">Pest / Insect</option>
          <option value="disease">Disease</option>
          <option value="weed">Weed</option>
          <option value="nutrient">Nutrient issue</option>
          <option value="abiotic">Abiotic / Stress</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div class="scout-form-row">
        <label for="scoutPressure">Pressure / Severity</label>
        <select id="scoutPressure">
          <option value="">Select</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>

      <div class="scout-form-row">
        <label for="scoutNotes">Notes</label>
        <textarea id="scoutNotes" rows="3" placeholder="Key observations, counts, weather, etc."></textarea>
      </div>

      <button class="btn-primary scout-btn">Save Entry</button>
    </form>

    <div id="scoutTableWrapper" class="table-wrapper">
      ${renderScoutingTableHTML(entries)}
    </div>
  `;
  populatePlantSelect('scoutCrop', 'scoutCropSearch');

  // Default date to today if blank
  const dateInput = document.getElementById('scoutDate');
  if (dateInput && !dateInput.value) {
    const todayStr = new Date().toISOString().slice(0, 10);
    dateInput.value = todayStr;
  }

  // If we arrived here from Diagnostics, prefill the form from the stored observation
  if (pendingScoutingFromDiagnostics) {
    const { crop, issueType, severity, notes } = pendingScoutingFromDiagnostics;

    const cropInput = document.getElementById('scoutCrop');
    if (cropInput && crop) cropInput.value = crop;

    const issueSelect = document.getElementById('scoutIssueType');
    if (issueSelect && issueType) issueSelect.value = issueType;

    const sevSelect = document.getElementById('scoutPressure');
    if (sevSelect && severity) sevSelect.value = severity;

    const notesEl = document.getElementById('scoutNotes');
    if (notesEl && notes) notesEl.value = notes;

    // Clear after one use so future visits don't keep prefilling
    pendingScoutingFromDiagnostics = null;
  }
}

function getScoutingEntries() {
  try {
    const raw = localStorage.getItem('scoutingEntries');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("Failed to read scoutingEntries from localStorage", e);
    return [];
  }
}

function setScoutingEntries(entries) {
  try {
    localStorage.setItem('scoutingEntries', JSON.stringify(entries));
  } catch (e) {
    console.warn("Failed to save scoutingEntries to localStorage", e);
  }
}

function renderScoutingTableHTML(entries) {
  if (!entries || !entries.length) {
    return `<p class="muted" style="margin-top:0.75rem;">No scouting entries yet.</p>`;
  }

  const rows = entries
    .map((e, index) => `
      <tr>
        <td>${e.date || ""}</td>
        <td>${e.area || ""}</td>
        <td>${e.crop || ""}</td>
        <td>${e.issueType || ""}</td>
        <td>${e.pressure || ""}</td>
        <td>${e.notes || ""}</td>
        <td>
          <button type="button" class="mix-remove-btn" onclick="deleteScoutingEntry(${index})">
            Delete
          </button>
        </td>
      </tr>
    `)
    .join("");

  return `
    <table class="scout-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Area</th>
          <th>Crop</th>
          <th>Issue</th>
          <th>Severity</th>
          <th>Notes</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function saveScoutingEntry() {
  const date = (document.getElementById('scoutDate').value || "").trim();
  const area = (document.getElementById('scoutArea').value || "").trim();
  const cropSelect = document.getElementById('scoutCrop');
  const crop = cropSelect
    ? ((cropSelect.options[cropSelect.selectedIndex] || {}).text || (cropSelect.value || "")).trim()
    : "";
  const issueType = document.getElementById('scoutIssueType').value || "";
  const pressure = document.getElementById('scoutPressure').value || "";
  const notes = (document.getElementById('scoutNotes').value || "").trim();

  if (!date && !area && !crop && !notes) {
    alert("Enter at least a date, area, crop, or notes.");
    return;
  }

  const entries = getScoutingEntries();
  entries.push({
    date,
    area,
    crop,
    issueType,
    pressure,
    notes
  });

  setScoutingEntries(entries);

  // Re-render page (form + table) with updated data
  const logsBody = document.getElementById('logsBody');
  if (logsBody) {
    renderScouting(logsBody);
  } else {
    renderScouting();
  }
}

function deleteScoutingEntry(index) {
  const entries = getScoutingEntries();
  if (index < 0 || index >= entries.length) return;

  entries.splice(index, 1);
  setScoutingEntries(entries);

  const logsBody = document.getElementById('logsBody');
  if (logsBody) {
    renderScouting(logsBody);
  } else {
    renderScouting();
  }
}


// ====== CHEMICAL ROTATION SCHEDULE (RESISTANCE MANAGEMENT) ======

// MOA groups for resistance rotation
const moaGroups = {
  'WSSA 3': 'Dinitroanilines (Pre-emergent)',
  'WSSA 4': 'Phenoxy herbicides',
  'WSSA 9': 'Glyphosate (EPSPS inhibitor)',
  'WSSA 12': 'Aquatic herbicides',
  'WSSA 14': 'PPO inhibitors',
  'WSSA 21': 'Chloroacetamides',
  'WSSA 22': 'Bipyridyliums',
  'WSSA 29': 'Isoxazoles',
  'IRAC 3A': 'Pyrethroids',
  'IRAC 4A': 'Neonicotinoids',
  'IRAC 5': 'Spinosyns',
  'FRAC 1': 'Benzimidazoles',
  'FRAC 3': 'DMIs (Demethylation Inhibitors)',
  'FRAC M1': 'Copper fungicides'
};

function analyzeChemicalUsage() {
  if (typeof window.chemicals === 'undefined') {
    console.warn('analyzeChemicalUsage: chemicals not loaded; returning empty analysis');
    return {
      recentlyUsed: {},
      byMOA: {},
      byIssueType: {},
      totalApplications: 0,
      dateRange: { earliest: null, latest: null }
    };
  }

  const treatmentEntries = getTreatmentEntries();
  const scoutingEntries = getScoutingEntries();
  
  const analysis = {
    recentlyUsed: {},
    byMOA: {},
    byIssueType: {},
    totalApplications: treatmentEntries.length,
    dateRange: {
      earliest: null,
      latest: null
    }
  };

  // Parse treatment logs for chemical usage
  treatmentEntries.forEach((entry, idx) => {
    if (entry.mix) {
      const chemLines = entry.mix.split('\n');
      chemLines.forEach(line => {
        const chemMatch = line.match(/^([^:]+):/);
        if (chemMatch) {
          const chemName = chemMatch[1].trim();
          const chem = chemicals.find(c => c.name === chemName);
          
          if (chem) {
            analysis.recentlyUsed[chem.id] = {
              name: chem.name,
              moa: chem.moa,
              lastUsed: entry.date,
              count: (analysis.recentlyUsed[chem.id]?.count || 0) + 1
            };
            
            if (!analysis.byMOA[chem.moa]) {
              analysis.byMOA[chem.moa] = [];
            }
            if (!analysis.byMOA[chem.moa].find(c => c.id === chem.id)) {
              analysis.byMOA[chem.moa].push({ id: chem.id, name: chem.name, count: 0 });
            }
            analysis.byMOA[chem.moa].find(c => c.id === chem.id).count += 1;
          }
        }
      });
    }
    if (entry.date) {
      if (!analysis.dateRange.earliest || entry.date < analysis.dateRange.earliest) {
        analysis.dateRange.earliest = entry.date;
      }
      if (!analysis.dateRange.latest || entry.date > analysis.dateRange.latest) {
        analysis.dateRange.latest = entry.date;
      }
    }
  });

  // Analyze scouting logs for issue types
  scoutingEntries.forEach(entry => {
    if (entry.issueType) {
      analysis.byIssueType[entry.issueType] = (analysis.byIssueType[entry.issueType] || 0) + 1;
    }
  });

  return analysis;
}

function generateRotationRecommendations(analysis) {
  const recommendations = [];
  const usedMOAs = Object.keys(analysis.byMOA);

  // Check for overuse of single MOA
  usedMOAs.forEach(moa => {
    const chemicals = analysis.byMOA[moa];
    const totalUses = chemicals.reduce((sum, c) => sum + c.count, 0);
    
    if (totalUses >= 3) {
      recommendations.push({
        priority: 'high',
        issue: `${moa} used ${totalUses} times`,
        chemicals: chemicals,
        suggestion: `Rotate to a different MOA group. Avoid using ${moa} chemicals for the next 1-2 spraying cycles.`,
        reason: 'Repeated use of the same MOA increases resistance risk.'
      });
    } else if (totalUses === 2) {
      recommendations.push({
        priority: 'medium',
        issue: `${moa} used ${totalUses} times recently`,
        chemicals: chemicals,
        suggestion: `Consider alternating with a different MOA group on the next application.`,
        reason: 'Moderate use - diversification recommended.'
      });
    }
  });

  // Find available alternatives
  const availableMOAs = Object.keys(moaGroups).filter(moa => !usedMOAs.includes(moa));
  
  if (recommendations.length > 0 && availableMOAs.length > 0) {
    recommendations.push({
      priority: 'info',
      issue: 'Alternative MOA groups available',
      alternatives: availableMOAs.map(moa => ({
        moa,
        description: moaGroups[moa],
        examples: chemicals.filter(c => c.moa === moa).slice(0, 3)
      })),
      suggestion: 'Consider rotating to one of these MOA groups for your next application.',
      reason: 'Rotation prevents resistance development.'
    });
  }

  return recommendations;
}

function renderRotation() {
  const content = document.getElementById('content');
  const analysis = analyzeChemicalUsage();
  const recommendations = generateRotationRecommendations(analysis);

  let html = `
    <h2>Chemical Rotation Schedule</h2>
    <p class="muted">
      Track chemical usage and prevent resistance development through strategic MOA rotation.
    </p>
  `;

  // Overview stats
  html += `
    <div class="rotation-overview">
      <p><strong>Total Applications:</strong> ${analysis.totalApplications}</p>
      ${analysis.dateRange.earliest ? `<p><strong>Period:</strong> ${analysis.dateRange.earliest} to ${analysis.dateRange.latest || 'Present'}</p>` : '<p class="muted">No treatment data yet.</p>'}
    </div>
  `;

  if (analysis.totalApplications === 0) {
    html += `<p class="muted">No treatment log entries yet. Start recording treatments to get rotation recommendations.</p>`;
    content.innerHTML = html;
    return;
  }

  // Recent chemicals used
  html += `<h3 class="subheading">Recently Used Chemicals</h3>`;
  const recentList = Object.values(analysis.recentlyUsed)
    .sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed))
    .slice(0, 10);
  
  if (recentList.length > 0) {
    html += `<table class="chem-table"><thead><tr><th>Chemical</th><th>MOA</th><th>Uses</th><th>Last Used</th></tr></thead><tbody>`;
    recentList.forEach(chem => {
      html += `<tr><td>${chem.name}</td><td>${chem.moa}</td><td>${chem.count}</td><td>${chem.lastUsed}</td></tr>`;
    });
    html += `</tbody></table>`;
  }

  // MOA breakdown
  html += `<h3 class="subheading" style="margin-top: 1.5rem;">MOA Usage Breakdown</h3>`;
  const moaList = Object.entries(analysis.byMOA).sort((a, b) => 
    b[1].reduce((s, c) => s + c.count, 0) - a[1].reduce((s, c) => s + c.count, 0)
  );
  
  if (moaList.length > 0) {
    html += `<table class="chem-table"><thead><tr><th>MOA Group</th><th>Description</th><th>Uses</th><th>Chemicals</th></tr></thead><tbody>`;
    moaList.forEach(([moa, chems]) => {
      const totalUses = chems.reduce((s, c) => s + c.count, 0);
      const chemNames = chems.map(c => c.name).join(', ');
      html += `<tr><td><strong>${moa}</strong></td><td>${moaGroups[moa] || 'Not classified'}</td><td>${totalUses}</td><td style="font-size:0.85rem;">${chemNames}</td></tr>`;
    });
    html += `</tbody></table>`;
  }

  // Recommendations
  html += `<h3 class="subheading" style="margin-top: 1.5rem;">Rotation Recommendations</h3>`;
  
  if (recommendations.length === 0) {
    html += `<p class="muted">Good rotation! Keep diversifying your MOA usage.</p>`;
  } else {
    recommendations.forEach(rec => {
      const colorClass = rec.priority === 'high' ? 'rotation-high' : rec.priority === 'medium' ? 'rotation-medium' : 'rotation-info';
      html += `
        <div class="rotation-recommendation ${colorClass}">
          <strong>${rec.issue}</strong>
          <p>${rec.suggestion}</p>
          <p class="muted" style="font-size:0.85rem;">${rec.reason}</p>
      `;
      
      if (rec.alternatives) {
        html += `<p style="margin-top:0.5rem;"><strong>Suggested alternatives:</strong></p><ul>`;
        rec.alternatives.forEach(alt => {
          html += `<li><strong>${alt.moa}:</strong> ${alt.description}`;
          if (alt.examples.length > 0) {
            html += ` (e.g., ${alt.examples.map(e => e.name).join(', ')})`;
          }
          html += `</li>`;
        });
        html += `</ul>`;
      }
      
      html += `</div>`;
    });
  }

  // Issue type summary
  if (Object.keys(analysis.byIssueType).length > 0) {
    html += `<h3 class="subheading" style="margin-top: 1.5rem;">Issues Monitored (from Scouting)</h3>`;
    html += `<ul>`;
    Object.entries(analysis.byIssueType).forEach(([issue, count]) => {
      html += `<li>${issue}: ${count} observations</li>`;
    });
    html += `</ul>`;
  }

  // Export data
  html += `
    <div style="margin-top: 2rem; padding: 1rem; background: #f9fafb; border-radius: 8px;">
      <p><strong>Export Analysis:</strong></p>
      <button type="button" class="btn-accent" onclick="exportRotationAnalysis()">Download as JSON</button>
    </div>
  `;

  content.innerHTML = html;
}

function exportRotationAnalysis() {
  const analysis = analyzeChemicalUsage();
  const recommendations = generateRotationRecommendations(analysis);
  
  const exportData = {
    generatedAt: new Date().toISOString(),
    analysis,
    recommendations,
    appInfo: 'Lukas Horticulture App - Chemical Rotation Schedule'
  };

  const dataStr = JSON.stringify(exportData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `rotation-analysis-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);
}


// ====== LOG REVIEW (SEARCH & RECALL) ======
let currentReviewLogType = 'treatment';

function switchLogReviewType(type) {
  currentReviewLogType = type;
  renderLogReview();
}

function renderLogReview() {
  const content = document.getElementById('content');
  
  let html = `
    <h2>Log Review</h2>
    <p class="muted">Search and review all treatment and scouting log entries.</p>

    <div class="log-review-toggle">
      <button type="button" 
              class="log-toggle-btn ${currentReviewLogType === 'treatment' ? 'active' : ''}"
              onclick="switchLogReviewType('treatment')">
        Treatment Logs
      </button>
      <button type="button" 
              class="log-toggle-btn ${currentReviewLogType === 'scouting' ? 'active' : ''}"
              onclick="switchLogReviewType('scouting')">
        Scouting Logs
      </button>
    </div>

    <div class="log-review-search">
      <input type="text" 
             id="logReviewSearch" 
             placeholder="Search by date, chemicals, area, issue, notes..."
             onkeyup="filterLogReview()">
    </div>

    <div id="logReviewResults"></div>
  `;

  content.innerHTML = html;
  filterLogReview();
}

function filterLogReview() {
  const searchTerm = (document.getElementById('logReviewSearch')?.value || '').toLowerCase();
  const resultsContainer = document.getElementById('logReviewResults');
  
  let entries = [];
  if (currentReviewLogType === 'treatment') {
    entries = getTreatmentEntries();
  } else {
    entries = getScoutingEntries();
  }

  // Filter based on search term
  let filtered = entries;
  if (searchTerm) {
    filtered = entries.filter(entry => {
      const searchableText = JSON.stringify(entry).toLowerCase();
      return searchableText.includes(searchTerm);
    });
  }

  if (filtered.length === 0) {
    resultsContainer.innerHTML = `<p class="muted">No entries found.</p>`;
    return;
  }

  // Sort by date (newest first)
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  let html = `
    <div class="log-review-count">
      <p><strong>${filtered.length} entry/entries found</strong></p>
    </div>
    <div class="log-review-list">
  `;

  filtered.forEach((entry, idx) => {
    if (currentReviewLogType === 'treatment') {
      html += `
        <div class="log-entry treatment-entry">
          <div class="log-entry-header">
            <strong>${entry.date || 'No date'}</strong>
            <span class="log-entry-area">${entry.area || 'N/A'}</span>
          </div>
          <div class="log-entry-details">
            <p><strong>Crop:</strong> ${entry.crop || 'N/A'}</p>
            <p><strong>Issue:</strong> ${entry.issue || 'N/A'}</p>
            <p><strong>Target:</strong> ${entry.target || 'N/A'}</p>
            ${entry.mix ? `<p><strong>Mix:</strong><br/><code>${entry.mix.replace(/\n/g, '<br/>')}</code></p>` : ''}
            ${entry.coverage ? `<p><strong>Coverage:</strong> ${entry.coverage}</p>` : ''}
            ${entry.notes ? `<p><strong>Notes:</strong> ${entry.notes}</p>` : ''}
          </div>
        </div>
      `;
    } else {
      const severityBadge = entry.pressure 
        ? `<span class="severity-badge severity-${entry.pressure}">${entry.pressure}</span>` 
        : '<span class="severity-badge severity-unknown">Not recorded</span>';
      
      html += `
        <div class="log-entry scouting-entry">
          <div class="log-entry-header">
            <strong>${entry.date || 'No date'}</strong>
            <span class="log-entry-area">${entry.area || 'N/A'}</span>
          </div>
          <div class="log-entry-details">
            <p><strong>Crop:</strong> ${entry.crop || 'N/A'}</p>
            <p><strong>Issue:</strong> ${entry.issueType || 'N/A'}</p>
            <p><strong>Severity:</strong> ${severityBadge}</p>
            ${entry.notes ? `<p><strong>Notes:</strong> ${entry.notes}</p>` : ''}
          </div>
        </div>
      `;
    }
  });

  html += `</div>`;
  resultsContainer.innerHTML = html;
}


// ====== RESTORE LAST PAGE ON LOAD ======
// Flag to track if the page has been initialized
let pageInitialized = false;

// Note: Initial page load is now handled by index.html's script onload handler
// to ensure script.js is fully loaded before showPage() is called.
// This listener serves as a fallback for edge cases and handles hash changes.
document.addEventListener('DOMContentLoaded', () => {
  // Preload plant master so diagnostics and dropdowns have data ready
  if (window.loadPlants) {
    window.loadPlants().catch(err => {
      console.error('Failed to preload plants master:', err);
    });
  }

  // Only initialize if not already done (prevents duplicate initialization)
  if (!pageInitialized) {
    pageInitialized = true;
    const hash = window.location.hash.replace('#', '').trim();
    if (hash) {
      showPage(hash);
    } else {
      showPage('home');
    }
  }
});

// ============ LUKAS DEBUG MENU (SAFE ADD-ON) ============
(function () {
  function createDebugMenu() {
    // Don't create twice
    if (document.getElementById('lukasDebugToggle')) return;

    // --- Toggle button (bottom-right) ---
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'lukasDebugToggle';
    toggleBtn.textContent = '🐞';
    Object.assign(toggleBtn.style, {
      position: 'fixed',
      bottom: '12px',
      right: '12px',
      width: '36px',
      height: '36px',
      borderRadius: '50%',
      border: 'none',
      cursor: 'pointer',
      fontSize: '20px',
      boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
      zIndex: '9999',
      background: '#fcb917',      // matches your green vibe
      color: '#fff',
      padding: '0'
    });

    // --- Panel container ---
    const panel = document.createElement('div');
    panel.id = 'lukasDebugPanel';
    Object.assign(panel.style, {
      position: 'fixed',
      bottom: '60px',
      right: '12px',
      width: '260px',
      padding: '10px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
      background: '#ffffff',
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      display: 'none',
      zIndex: '9999'
    });

    panel.innerHTML = `
    <div style="font-weight:600; margin-bottom:6px;">
        Lukas Debug Tools
      </div>
      <button type="button" id="lukasDebugReload" style="width:100%; margin-bottom:6px; padding:5px 8px; border-radius:4px; border:1px solid #0b7140; background:#0b7140; color:#fff; cursor:pointer;">
        Force Reload (cache-bust)
      </button>
      <button type="button" id="lukasDebugClearSW" style="width:100%; margin-bottom:6px; padding:5px 8px; border-radius:4px; border:1px solid #c0392b; background:#e74c3c; color:#fff; cursor:pointer;">
        Dev: clear offline cache & reload
      </button>
      <button type="button" id="lukasDebugLog" style="width:100%; margin-bottom:6px; padding:5px 8px; border-radius:4px; border:1px solid #ccc; background:#f5f5f5; cursor:pointer;">
        Log basic app info to console
      </button>
      <div style="font-size:11px; color:#666;">
        Tip: Hard refresh = <strong>Ctrl + Shift + R</strong> (Win/Chromebook),
        <strong>⌘ + Shift + R</strong> (Mac).
      </div>
    `;

    document.body.appendChild(toggleBtn);
    document.body.appendChild(panel);

    // --- Toggle panel visibility ---
    toggleBtn.addEventListener('click', () => {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });

    // --- Force reload with cache-busting query param ---
    const reloadBtn = panel.querySelector('#lukasDebugReload');
    reloadBtn.addEventListener('click', () => {
      const url = new URL(window.location.href);
      url.searchParams.set('_dev', Date.now().toString());
      window.location.href = url.toString();
    });

    const clearSwBtn = panel.querySelector('#lukasDebugClearSW');
    if (clearSwBtn) {
      clearSwBtn.addEventListener('click', async () => {
        try {
          // Unregister all service workers
          if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistrations) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(reg => reg.unregister()));
          }

          // Clear all caches
          if (window.caches && caches.keys) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
          }

          // Reload with a cache-busting query param just in case
          const url = new URL(window.location.href);
          url.searchParams.set('_dev', Date.now().toString());
          window.location.href = url.toString();
        } catch (err) {
          console.log('Lukas debug clearSW error:', err);
          window.location.reload();
        }
      });
    }

    // --- Log safe diagnostics ---
    const logBtn = panel.querySelector('#lukasDebugLog');
    logBtn.addEventListener('click', () => {
      console.group('Lukas Debug Info');
      console.log('URL:', window.location.href);
      console.log('Time:', new Date().toISOString());

      // Safely log chemicals if it exists
      if (typeof window.chemicals !== 'undefined' && Array.isArray(window.chemicals)) {
        console.log('chemicals.length:', window.chemicals.length);
      } else {
        console.log('chemicals: not defined or not an array');
      }

      // Safely log currentChemFilter if it exists
      if (typeof window.currentChemFilter !== 'undefined') {
        console.log('currentChemFilter:', window.currentChemFilter);
      } else {
        console.log('currentChemFilter: not defined');
      }

      console.groupEnd();
    });
  }

  // Add without touching existing listeners
  document.addEventListener('DOMContentLoaded', createDebugMenu);
})();