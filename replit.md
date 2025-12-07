# Scouting Management System

## Overview

The Scouting Management System is a single-page web application designed for horticultural management at Lukas Nursery. It provides tools for chemical management, spray mix calculations, treatment logging, plant diagnostics, scouting observations, and spray rotation scheduling. The application is built with vanilla JavaScript, HTML, and CSS, with no backend dependencies, relying entirely on client-side localStorage for data persistence.

**Progressive Web App (PWA):** The application is a production-ready PWA that can be installed to device home screens and works completely offline. Users can access all features without an internet connection after initial installation.

## Progressive Web App Implementation

### PWA Features

**Installation:**
- Users can install the app to their device home screen (iOS, Android, Desktop)
- App appears and launches like a native application
- Full-screen mode without browser UI elements
- Custom app icon with brand colors (sunset gradient with palm tree)

**Offline Functionality:**
- Complete offline access after initial load
- Service worker caches all HTML, CSS, JavaScript, and assets
- localStorage persists all user data (logs, favorites, settings)
- Works without internet connection for all features

**Cross-Platform Support:**
- iOS: Safari with Add to Home Screen
- Android: Chrome/Edge with install prompt
- Desktop: Chrome/Edge with install button in address bar
- Responsive design adapts to all screen sizes

### Technical Implementation

**Files:**
1. **manifest.json** - PWA metadata
   - App name, description, and branding
   - Theme colors: Sky blue (#33a9dc) primary, Cream (#f5f3ee) background
   - App icon references (512x512 for all devices)
   - Display mode: standalone (full-screen)

2. **sw.js** - Service worker for offline caching
   - Precaches all critical assets on install (including lukas-logo.png)
   - Cache-first strategy for fast loading
   - Dynamic caching for runtime requests
   - Cache versioning for updates (CACHE_NAME: 'lukas-hort-v13')
   - Auto-updating system with skipWaiting and clients.claim for immediate cache refresh

3. **icon-512.png** - PWA app icon
   - Branded with sunset gradient and palm tree
   - 512x512 resolution for iOS, Android, Desktop
   - Used for home screen, splash screen, task switcher

**Installation Flow:**
- Home page shows "Install App" button when available
- JavaScript captures `beforeinstallprompt` event
- `installPWA()` function triggers native install dialog
- Button auto-hides after installation or if already installed

**Caching Strategy:**
- **Precache on install**: index.html, style.css, script.js, chemicals.js, fonts
- **Cache on fetch**: Dynamic runtime caching for other resources
- **Version management**: Bump CACHE_NAME when updating assets
- **Versioned URLs**: Service worker caches exact query-string URLs (style.css?v=...)

**iOS Support:**
- Apple-specific meta tags for status bar and icon
- `apple-mobile-web-app-capable` enables full-screen mode
- `apple-touch-icon` for home screen icon
- `apple-mobile-web-app-title` for short name

### Deployment Considerations

**Cache Updates:**
- When updating CSS/JS, increment version in cache-busting query strings
- Update `CACHE_NAME` in sw.js to force cache refresh
- Service worker auto-updates when file changes

**Testing:**
- Desktop Chrome: DevTools > Application > Service Workers
- Mobile: Use "Open in browser" from preview, then install
- Offline test: DevTools > Network > Offline checkbox

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- **Pure HTML/CSS/JavaScript**: No frameworks or build tools required
- **Single-Page Application (SPA)**: Page navigation handled via JavaScript without server requests
- **Component-based Structure**: Each major feature (Chemical Library, Mix Calculator, Treatment Log, etc.) is a separate "page" rendered dynamically

**Design Pattern:**
- **Page-based Navigation**: `showPage(pageName)` function handles routing and content switching
- **Event-driven UI**: Button clicks and form submissions trigger JavaScript functions
- **State Management**: Application state stored in global JavaScript variables and localStorage

**Key Architectural Decisions:**

1. **No Framework Approach**
   - **Problem**: Need for rapid development and easy maintenance without build complexity
   - **Solution**: Vanilla JavaScript with inline event handlers and global functions
   - **Rationale**: Eliminates build step, reduces complexity for small team, enables direct HTML editing
   - **Trade-off**: Less structured than frameworks, but simpler deployment and maintenance

2. **CSS Variable System**
   - **Problem**: Consistent theming across multiple components
   - **Solution**: Centralized CSS custom properties (`:root` variables) for colors, spacing, and effects
   - **Benefits**: Single source of truth for brand colors (sunset gradient, golden yellow, deep green), easy theme modifications
   - **Implementation**: Variables like `--color-primary`, `--color-accent`, `--gradient-sunset` used throughout

3. **Client-side Only Architecture**
   - **Problem**: Need for persistent data without server infrastructure
   - **Solution**: localStorage API for all data persistence
   - **Stored Data**: 
     - Treatment logs
     - Scouting observations
     - Diagnostic records
     - User favorites (chemical IDs)
     - Mix calculation history
   - **Limitations**: Data limited to single browser, no multi-user sync, ~5-10MB storage limit

4. **Chemical Database as Static JSON**
   - **Problem**: Need for comprehensive chemical reference data
   - **Solution**: `chemicals.js` file containing array of 97+ chemical products with complete metadata
   - **Structure**: Each chemical object contains:
     - Identification (id, name, manufacturer)
     - Classification (category, type, formulation)
     - Active ingredients and MOA (Mode of Action)
     - Safety data (REI - Re-Entry Interval)
     - Application rates and restrictions
     - EPA registration and label URLs
   - **Rationale**: Static data avoids database dependency while remaining easily updatable

### Data Storage Solutions

**localStorage Schema:**

1. **favoriteChemicalIds**: Array of chemical IDs marked as favorites
2. **treatmentLogs**: Array of treatment application records
3. **scoutingLogs**: Array of field observation records
4. **diagnosticRecords**: Array of plant diagnostic entries
5. **rotationSchedules**: Spray rotation planning data

**Data Flow:**
- **Write**: User actions → JavaScript functions → localStorage.setItem(key, JSON.stringify(data))
- **Read**: Page load → localStorage.getItem(key) → JSON.parse() → Render UI
- **Error Handling**: Try-catch blocks prevent localStorage quota errors from crashing app

### UI/UX Patterns

**Feature Integration:**
1. **Cross-feature Data Handoff**
   - **Diagnostics → Scouting**: Diagnostic findings can create scouting tasks
   - **Mix Calculator → Treatment Log**: Mix calculations can be logged as treatments
   - **Chemical Library → Mix Calculator**: Chemicals can be queued for mix calculations
   - **Implementation**: Global state variables like `pendingTreatmentFromMix`, `pendingScoutingFromDiagnostics`

2. **Dynamic Form Generation**
   - **Mix Calculator Rows**: User can add/remove chemical rows dynamically
   - **Pattern**: JavaScript generates HTML strings and inserts into DOM
   - **State Tracking**: `mixChemRowCount` counter ensures unique element IDs

3. **Expandable Table Rows**
   - **Chemical Library Detail View**: Click-to-expand pattern for chemical details
   - **Implementation**: Toggle CSS class `.open` on detail rows
   - **Accessibility**: Single active detail row at a time

### Styling Architecture

**Theme System:**
- **Brand Colors**: Derived from Lukas Nursery logo (sunset gradient: sky blue → coral → golden)
- **Typography**: 
  - Header: 'Cormorant' (elegant serif at 700 weight with subtle text shadow)
  - Headings: 'Cormorant' (elegant serif with botanical curves)
  - Body: 'Poppins' (soft rounded sans-serif for tropical feel)
- **Visual Identity**: Centered Lukas Nursery logo PNG in header (200px desktop, 170px mobile, transparent background, circular design with sunset gradient, palm tree, brand text), vintage-inspired borders
- **Title**: "Scouting Management System" (Cormorant serif, 3.5rem desktop / 2.2rem mobile)
- **Tagline**: "Scouting - Diagnostics - Treatment" (bolded, uppercase)

**Navigation Icons:**
- **Custom SVG Icons**: Each navigation button features a professional inline SVG icon
  - Home: House icon
  - Scouting Log: Magnifying glass with crosshairs
  - Diagnostics: Layered analysis icon
  - Mix Calculator: Beaker with droplets
  - Treatment Log: Spray bottle
  - Rotation Schedule: Calendar
  - Log Review: Document with checkmark
  - Chemical Library: Book/library icon
- **Interactive Animations**: Tactile press/depress feedback
  - Hover: Button lifts (-2px translateY) + icon scales up (1.1×)
  - Active/Press: Button scales down (0.97×) + icon scales down (0.9×)
  - Smooth transitions (0.2s cubic-bezier easing)
- **Responsive Layout**:
  - Desktop/Tablet: Icon + text side-by-side (18px icons)
  - Mobile (<600px): Icon above text in column layout (16px icons)
- **Accessibility**: Icons inherit theme colors, respect reduced-motion preferences

**CSS Organization:**
1. **Variables Section**: All theme tokens defined in `:root`
2. **Global Resets**: Box-sizing, base typography
3. **Component Styles**: Header, nav, forms, tables, buttons
4. **Utility Classes**: Shadows, borders, spacing
5. **Page-specific Overrides**: Custom styles per feature page

**Optimization Strategy:**
- Consolidated button styles (`.btn-primary`, `.btn-accent`, `.btn-warning`) to reduce duplication
- Removed syntax errors (double semicolons)
- Reduced file size by ~17% through consolidation
- Added missing footer styles

### Authentication and Authorization

**Current State**: None implemented
- Application is designed for internal, single-user use
- No login system or access controls
- All data visible to anyone with access to the browser

**Future Considerations**: If multi-user support is needed, would require backend authentication

## External Dependencies

### Third-party Services

**None**: Application has no external API calls or service dependencies

### Frontend Libraries

**Google Fonts CDN:**
- **Fonts**: Playfair Display (400-900 weights), Cormorant (400, 500, 600, 700 weights), Poppins (300, 400, 500, 600, 700 weights)
- **URL**: `https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800;900&family=Poppins:wght@300;400;500;600;700&family=Cormorant:wght@400;500;600;700&display=swap`
- **Purpose**: Luxury typography for sophisticated tropical botanical aesthetic with elegant header presentation
- **Fallbacks**: System fonts specified as fallbacks in CSS

### Databases

**None**: No database server required

**Data Source:**
- `chemicals.js`: Static JavaScript file containing chemical product data
- Format: ES6 module exporting `chemicals` array constant
- Size: 97 unique chemicals (originally 100 with 3 duplicates removed)

### Browser APIs Used

1. **localStorage**: Persistent data storage for app data
2. **Service Worker API**: Offline caching and PWA functionality
3. **Cache API**: Asset caching for offline access
4. **beforeinstallprompt**: PWA installation prompt handling
5. **Standard DOM APIs**: Element manipulation, event handling
6. **JSON**: Serialization/deserialization for localStorage
7. **SVG**: Vector graphics for decorative palm tree elements

### Development Tools

**Cache Control Headers** (in HTML):
```html
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
<meta http-equiv="Pragma" content="no-cache">
<meta http-equiv="Expires" content="0">
```
- **Purpose**: Prevent browser caching during development
- **Impact**: Ensures latest code always loads in development environment

### External References

**EPA Chemical Labels:**
- Chemical objects contain `epaLabelUrl` fields
- Links point to external PDF resources (labelsds.com domain)
- Used for regulatory compliance and detailed product information