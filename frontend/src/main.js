import { getLineCenter } from './modules/geoUtils.js';
import { updateRouteDisplay } from './modules/routeDisplay.js';
import { getRouteAndPoints } from './modules/route.js';
import { setupSearchBars } from './modules/searchBar.js';
import { setupLocationControl, addSetDepartButton, getCurrentUserPosition } from './modules/location.js';
import { loadGeojsonLayers } from './modules/geojsonLoader.js';
import { initThemeManager, getCurrentTheme, onThemeChange, toggleTheme, THEMES } from './modules/themeManager.js';
import { setupTheme } from './modules/themeSetup.js';
import { setupMapFeatures } from './modules/mapSetup.js';

import * as userConfig from './modules/userConfig.js';

// Performance tracing for init
// Setup perf-start and console wrapper to add elapsed time + ISO timestamp to logs
const __perfStart = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
const __perfStartIso = new Date().toISOString();
const __origConsole = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    timeLog: console.timeLog ? console.timeLog.bind(console) : null
};
function __formatPrefix() {
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const delta = Math.round(now - __perfStart);
    const iso = new Date().toISOString();
    return `[+${delta}ms][${iso}]`;
}
console.log = function (...args) { __origConsole.log(__formatPrefix(), ...args); };
console.info = function (...args) { __origConsole.info(__formatPrefix(), ...args); };
console.warn = function (...args) { __origConsole.warn(__formatPrefix(), ...args); };
console.error = function (...args) { __origConsole.error(__formatPrefix(), ...args); };
if (__origConsole.timeLog) {
    console.timeLog = function (label, ...args) { __origConsole.timeLog(label, __formatPrefix(), ...args); };
}

console.time('init:main');
console.log('[INIT] Starting main initialization (perf wrapper active)', { perfStart: __perfStartIso });

// Shared config (initial values come from userConfig)
const config = {
    ETAGES: userConfig.ETAGES,
    perimeterCenter: userConfig.perimeterCenter,
    perimeterRadius: userConfig.perimeterRadius,
    BASE_HUE: userConfig.BASE_HUE,
    BASE_SAT: userConfig.BASE_SAT,
    BASE_LIGHT: userConfig.BASE_LIGHT,
    blacklist: userConfig.blacklist,
    osrmUrl: userConfig.osrmUrl,
    initialZoom: userConfig.initialZoom || 18
};

// Helpers for persisting the selected config across browser sessions.
// Use localStorage when available, fallback to cookies when it's not.
const SAVED_CONFIG_KEY = 'selectedConfig';
function setCookie(name, value, days) {
    try {
        const expires = typeof days === 'number' ? `; expires=${new Date(Date.now() + days * 864e5).toUTCString()}` : '';
        document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value || '')}${expires}; path=/`;
    } catch (e) { /* ignore */ }
}
function getCookie(name) {
    try {
        const matches = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()\[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
        return matches ? decodeURIComponent(matches[1]) : null;
    } catch (e) { return null; }
}
function readSavedConfig() {
    try {
        if (typeof localStorage !== 'undefined') {
            const v = localStorage.getItem(SAVED_CONFIG_KEY);
            if (v) return v;
        }
    } catch (e) { /* localStorage unavailable */ }
    // fallback to cookie
    return getCookie(SAVED_CONFIG_KEY);
}
function writeSavedConfig(value) {
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(SAVED_CONFIG_KEY, value);
            return;
        }
    } catch (e) { /* can't use localStorage */ }
    // fallback: store for 30 days
    setCookie(SAVED_CONFIG_KEY, value, 30);
}
function removeSavedConfig() {
    try {
        if (typeof localStorage !== 'undefined') localStorage.removeItem(SAVED_CONFIG_KEY);
    } catch (e) { /* ignore */ }
    // expire cookie
    setCookie(SAVED_CONFIG_KEY, '', -1);
}

const map = L.map('map', { zoomDelta: 0.1, zoomSnap: 0 }).setView(config.perimeterCenter, config.initialZoom);
console.timeLog('init:main', '[INIT] Map created and view set', { center: config.perimeterCenter, zoom: config.initialZoom });

// Theme / base
const UNIVERSAL_BASE_URLS = {
    light: 'https://api.maptiler.com/maps/3b544fc3-420c-4a93-a594-a99b71d941bb/style.json?key=BiyHHi8FTQZ233ADqskZ',
    dark: 'https://api.maptiler.com/maps/04c03a5d-804b-4c6f-9736-b7103fdb530b/style.json?key=BiyHHi8FTQZ233ADqskZ'
};
let universalBaseLayer = null;
function setUniversalBaseLayer(theme) {
    if (universalBaseLayer) map.removeLayer(universalBaseLayer);
    const styleUrl = theme === 'dark' ? UNIVERSAL_BASE_URLS.dark : UNIVERSAL_BASE_URLS.light;
    universalBaseLayer = L.maplibreGL({ style: styleUrl, attribution: '\u00a9 MapTiler, OpenStreetMap contributors' });
    universalBaseLayer.addTo(map);
}

initThemeManager();
setUniversalBaseLayer(getCurrentTheme());
onThemeChange(setUniversalBaseLayer);
setupTheme(map, UNIVERSAL_BASE_URLS);
console.timeLog('init:main', '[INIT] Theme manager and base layers initialized');

// Map features (expose reload/loadOnce but don't auto run heavy loads)
const {
    batimentLayers,
    batimentFeatures,
    cheminFeatures,
    layerControl: mapLayerControl,
    reloadConfig,
    loadOnceWithParams
} = setupMapFeatures({
    map,
    ETAGES: config.ETAGES,
    perimeterCenter: config.perimeterCenter,
    perimeterRadius: config.perimeterRadius,
    getRouteAndPoints: (params) => getRouteAndPoints({ ...params, osrmUrl: config.osrmUrl }),
    osrmUrl: config.osrmUrl,
    onLayersReady: (firstVisibleIdx) => {
        if (window.perimeterCircle && map.hasLayer(window.perimeterCircle)) {
            try { map.removeLayer(window.perimeterCircle); } catch (e) { }
        }
        try { setBackgroundForEtage(firstVisibleIdx); } catch (e) { }
    }
});
console.timeLog('init:main', '[INIT] setupMapFeatures returned (map features setup initiated)');

// globals
window.routeSegmentsByEtage = [];
window.currentRouteStart = null;
window.currentRouteEnd = null;
window.currentRouteStartIdx = null;
window.currentRouteEndIdx = null;
window.departMarkerByEtage = [];
window.arriveeMarkerByEtage = [];
window.perimeterCircle = null;

const departIcon = L.icon({ iconUrl: './images/start-icon.svg', iconSize: [15, 15], iconAnchor: [7.5, 7.5], popupAnchor: [0, -10] });
const arriveeIcon = L.icon({ iconUrl: '/images/end-icon.svg', iconSize: [15, 15], iconAnchor: [7.5, 7.5], popupAnchor: [0, -10] });

let currentBaseLayer = null;
let currentEtageIdx = 0;
function setBackgroundForEtage(idx) {
    const etage = config.ETAGES[idx];
    if (!etage || !etage.backgroundUrl) return;
    if (currentBaseLayer) map.removeLayer(currentBaseLayer);
    const theme = getCurrentTheme() || THEMES.LIGHT;
    const url = etage.backgroundUrl[theme] || etage.backgroundUrl.light;
    currentBaseLayer = L.tileLayer(url, { maxZoom: 23, attribution: '\u00a9 OpenStreetMap' });
    currentBaseLayer.addTo(map);
    currentEtageIdx = idx;
}
setBackgroundForEtage(0);

onThemeChange(() => setBackgroundForEtage(currentEtageIdx));
map.on('baselayerchange', function (e) {
    const idx = batimentLayers.findIndex(l => l === e.layer);
    if (idx !== -1) {
        setBackgroundForEtage(idx);
        updateRouteDisplay(map, window.routeSegmentsByEtage, window.departMarkerByEtage, window.arriveeMarkerByEtage, idx);
    }
});
map.on('layeradd', function (e) {
    const idx = batimentLayers.findIndex(l => l === e.layer);
    if (idx !== -1) {
        setBackgroundForEtage(idx);
        updateRouteDisplay(map, window.routeSegmentsByEtage, window.departMarkerByEtage, window.arriveeMarkerByEtage, idx);
    }
});

let geojsonLoaded = false;
let searchBarInitialized = false;
let departButtonAdded = false;

// permission state
window._cf_locationPermission = null; // 'granted' | 'denied' | null
window._cf_pendingReloadConfig = null;

async function loadConfigFile(filename) {
    try {
        console.time(`loadConfigFile:${filename}`);
        console.log(`[CONFIG] Start loading config file: ${filename}`);
        const res = await fetch(`/config/${filename}`);
        const data = await res.json();
        Object.assign(config, data);

        if (map && map.setView) {
            map.setView(config.perimeterCenter, config.initialZoom || 18);
            if (window.perimeterCircle) {
                window.perimeterCircle.setLatLng(config.perimeterCenter);
                window.perimeterCircle.setRadius(config.perimeterRadius);
            }
        }

        if (typeof reloadConfig === 'function') {
            const payload = {
                ETAGES: config.ETAGES,
                perimeterCenter: config.perimeterCenter,
                perimeterRadius: config.perimeterRadius,
                getRouteAndPoints: (params) => getRouteAndPoints({ ...params, osrmUrl: config.osrmUrl }),
                osrmUrl: config.osrmUrl,
                BASE_HUE: config.BASE_HUE,
                BASE_SAT: config.BASE_SAT,
                BASE_LIGHT: config.BASE_LIGHT,
                blacklist: config.blacklist
            };

            if (window._cf_locationPermission === 'granted') {
                reloadConfig(payload);
            } else {
                window._cf_pendingReloadConfig = payload;
            }
        }

        console.timeEnd(`loadConfigFile:${filename}`);
        console.log(`[CONFIG] Loaded config file: ${filename}`);
        return data;
    } catch (e) {
        console.error('Erreur lors du chargement du fichier de config:', e);
    }
}

async function loadConfigList() {
    try {
        console.time('loadConfigList');
        console.log('[CONFIG] Start loading config list');
        const res = await fetch('/api/configs');
        const configs = await res.json();
        const selector = document.getElementById('config-selector');
        selector.innerHTML = '';
        configs.forEach(cfg => {
            const opt = document.createElement('option');
            opt.value = cfg;
            opt.textContent = cfg.replace(/\.json$/, '');
            // marque les options réelles pour les distinguer d'un placeholder temporaire
            opt.dataset.real = 'true';
            selector.appendChild(opt);
        });
        console.timeEnd('loadConfigList');
        console.log('[CONFIG] Config list loaded', configs);
        return configs;
    } catch (e) {
        console.error('Erreur lors du chargement des configs:', e);
        return [];
    }
}

async function setupConfigSelector() {
    console.time('setupConfigSelector');
    console.log('[CONFIG] setupConfigSelector start');
    const configs = await loadConfigList();
    const selector = document.getElementById('config-selector');
    if (!configs.length) {
        selector.innerHTML = '<option>Aucune config</option>';
        selector.disabled = true;
        return;
    }
    selector.disabled = false;
    // Default selection: prefer Demo.json when available, otherwise first entry
    let configToLoad = configs.includes('Demo.json') ? 'Demo.json' : configs[0];
    // Try to restore previously saved selection (localStorage or cookie). Do not delete it here.
    const storedConfig = readSavedConfig();
    if (storedConfig && configs.includes(storedConfig)) {
        configToLoad = storedConfig;
    }
    // Create a small search input to filter the selector options
    let searchInput = document.getElementById('config-selector-search');
    if (!searchInput) {
        const container = document.getElementById('config-selector-container');
        searchInput = document.createElement('input');
        searchInput.type = 'search';
        searchInput.id = 'config-selector-search';
        searchInput.placeholder = 'Rechercher...';
        searchInput.autocomplete = 'off';
        searchInput.setAttribute('aria-label', 'Rechercher une configuration');
        if (container) container.insertBefore(searchInput, selector);

        // placeholder option qui s'affiche pendant la recherche
        let placeholderOption = null;
        // sauvegarde de la selection réelle avant recherche
        let savedRealSelection = selector.value || configToLoad;

        // filter handler
        searchInput.addEventListener('input', (e) => {
            const q = (e.target.value || '').toLowerCase().trim();
            Array.from(selector.options).forEach(opt => {
                // ne pas cacher le placeholder si présent
                if (opt.dataset && opt.dataset.real !== 'true') return;
                const text = (opt.textContent || opt.value || '').toLowerCase();
                opt.hidden = q ? !text.includes(q) : false;
            });
            const firstVisible = Array.from(selector.options).find(o => !o.hidden && o.dataset && o.dataset.real === 'true');

            if (q) {
                // search active: afficher un placeholder invitant à cliquer pour sélectionner
                if (!placeholderOption) {
                    placeholderOption = document.createElement('option');
                    placeholderOption.value = '__placeholder__';
                    placeholderOption.textContent = 'Cliquer pour sélectionner';
                    placeholderOption.disabled = true;
                    placeholderOption.classList.add('config-placeholder');
                }
                if (selector.options[0] !== placeholderOption) selector.insertBefore(placeholderOption, selector.firstChild);
                // selectionner le placeholder (affiche le texte)
                selector.value = placeholderOption.value;
            } else {
                // search cleared: retirer placeholder et restaurer la selection réelle si possible
                if (placeholderOption && selector.contains(placeholderOption)) {
                    selector.removeChild(placeholderOption);
                }
                // restore saved selection si elle est visible
                if (savedRealSelection && Array.from(selector.options).some(o => o.value === savedRealSelection && !o.hidden)) {
                    selector.value = savedRealSelection;
                } else if (firstVisible) {
                    selector.value = firstVisible.value;
                }
            }
        });

        // quand l'utilisateur choisit réellement une option, mettre à jour la sauvegarde
        selector.addEventListener('change', (e) => {
            if (e.target.value && e.target.value !== '__placeholder__') savedRealSelection = e.target.value;
        });
    }
    await loadConfigFile(configToLoad);
    selector.value = configToLoad;
    // stocke la selection initiale pour le restore après recherche
    // (si le search input est créé après, il la lira depuis selector.value)
    selector.addEventListener('change', async (e) => {
        if (e.target.value && e.target.value !== '__placeholder__') {
            // Persist the chosen config across sessions
            writeSavedConfig(e.target.value);
            // reload to apply the config cleanly
            window.location.reload();
        }
    });
    console.timeEnd('setupConfigSelector');
    console.log('[CONFIG] setupConfigSelector end');
    // ensure the search input is reset when setup completes
    if (searchInput) searchInput.value = '';
}

setupConfigSelector();

function onLocationGranted() {
    window._cf_locationPermission = 'granted';
    if (window._cf_pendingReloadConfig && typeof reloadConfig === 'function') {
        reloadConfig(window._cf_pendingReloadConfig);
        window._cf_pendingReloadConfig = null;
    } else if (!geojsonLoaded && typeof loadOnceWithParams === 'function') {
        geojsonLoaded = true;
        loadOnceWithParams({
            ETAGES: config.ETAGES,
            getRouteAndPoints: (params) => getRouteAndPoints({ ...params, osrmUrl: config.osrmUrl }),
            osrmUrl: config.osrmUrl,
            BASE_HUE: config.BASE_HUE,
            BASE_SAT: config.BASE_SAT,
            BASE_LIGHT: config.BASE_LIGHT,
            blacklist: config.blacklist
        });
    }
    // Masque l'overlay de récupération de position
    hideLocationLoadingOverlay();
}

function onLocationDenied() {
    window._cf_locationPermission = 'denied';
    // only keep base map + perimeter visible
    setupLocationControl({ map, config, perimeterCenter: config.perimeterCenter, perimeterRadius: config.perimeterRadius });
    map.setView(config.perimeterCenter, config.initialZoom || 18);
    // Masque l'overlay même si l'utilisateur refuse
    hideLocationLoadingOverlay();
}

document.addEventListener('DOMContentLoaded', () => {
    console.time('DOMContentLoaded');
    console.log('[INIT] DOMContentLoaded handler start');

    // Create locate control
    const locCtrl = setupLocationControl({
        map,
        config,
        allowAutoCenter: false,
        onInside: (e, perimeterCircle) => {
            if (window._cf_locationPermission !== 'granted') onLocationGranted();
        },
        onOutside: (e) => {
            // Keep view on perimeter center even if user is outside
            map.setView(config.perimeterCenter, config.initialZoom || 18);
        },
        onDenied: () => onLocationDenied()
    });

    // Démarre immédiatement la localisation avec le plugin
    try {
        // Affiche l'overlay pendant que le navigateur demande la permission
        showLocationLoadingOverlay();
        if (locCtrl && typeof locCtrl.startLocate === 'function') {
            locCtrl.startLocate();
        }
    } catch (e) { /* ignore */ }

    // Attacher le bouton "Continuer sans position" si présent
    try {
        const overlay = document.getElementById('location-loading-overlay');
        if (overlay) {
            const btn = overlay.querySelector('.location-timeout-continue');
            if (btn) {
                // Cacher par défaut jusqu'au timeout
                btn.style.display = 'none';
                btn.addEventListener('click', () => {
                    try {
                        // User chooses to continue without position
                        hideLocationLoadingOverlay();
                        onLocationDenied();
                    } catch (e) { /* ignore */ }
                });
            }
        }
    } catch (e) { /* ignore */ }

    const darkModeBtn = document.getElementById('dark-mode-toggle');
    if (darkModeBtn) {
        darkModeBtn.addEventListener('click', () => {
            toggleTheme();
            let img = darkModeBtn.querySelector('img');
            if (!img) {
                img = document.createElement('img');
                img.style.width = '24px';
                img.style.height = '24px';
                darkModeBtn.appendChild(img);
            }
            img.src = document.body.classList.contains('dark-mode') ? '/images/light-icon.svg' : '/images/dark-icon.svg';
            img.alt = document.body.classList.contains('dark-mode') ? 'Mode clair' : 'Mode sombre';
        });
        const updateBtnIcon = () => {
            let img = darkModeBtn.querySelector('img');
            if (!img) {
                img = document.createElement('img');
                img.style.width = '24px';
                img.style.height = '24px';
                darkModeBtn.appendChild(img);
            }
            img.src = document.body.classList.contains('dark-mode') ? '/images/light-icon.svg' : '/images/dark-icon.svg';
            img.alt = document.body.classList.contains('dark-mode') ? 'Mode clair' : 'Mode sombre';
        };
        updateBtnIcon();
        onThemeChange(updateBtnIcon);
    }
    console.timeEnd('DOMContentLoaded');
    console.log('[INIT] DOMContentLoaded handler end');
});

// small UI reorg
setTimeout(() => {
    const leafletLayerControl = document.querySelector('.leaflet-control-layers');
    const customLayerControl = document.getElementById('custom-layer-control');
    if (leafletLayerControl && customLayerControl) customLayerControl.appendChild(leafletLayerControl);
    const leafletLocate = document.querySelector('.leaflet-control-locate');
    const customLocateBtn = document.getElementById('custom-locate-btn');
    if (leafletLocate && customLocateBtn) customLocateBtn.appendChild(leafletLocate);
}, 500);

console.timeLog('init:main', '[INIT] End of initial script sync path (async loads may still run)');

// Helpers pour afficher/masquer l'overlay de récupération de position
function showLocationLoadingOverlay() {
    try {
        const el = document.getElementById('location-loading-overlay');
        if (el) {
            el.classList.remove('location-loading-hidden');
            el.classList.add('location-loading-visible');
            el.setAttribute('aria-hidden', 'false');
            resetLocationOverlayState();
            startLocationOverlayTimeout();
        }
    } catch (e) { /* ignore */ }
}

function hideLocationLoadingOverlay() {
    try {
        const el = document.getElementById('location-loading-overlay');
        if (el) {
            el.classList.remove('location-loading-visible');
            el.classList.add('location-loading-hidden');
            el.setAttribute('aria-hidden', 'true');
            clearLocationOverlayTimeout();
            resetLocationOverlayState();
        }
    } catch (e) { /* ignore */ }
}

// Timeout pour l'overlay de localisation. Si la permission n'est pas résolue
// après ce délai, passer en état d'erreur et proposer "Continuer sans position".
const LOCATION_OVERLAY_TIMEOUT_MS = 7000; // 7 seconds
let _cf_locationOverlayTimer = null;

function startLocationOverlayTimeout() {
    clearLocationOverlayTimeout();
    _cf_locationOverlayTimer = setTimeout(() => {
        try {
            const el = document.getElementById('location-loading-overlay');
            if (!el) return;
            el.classList.add('location-loading-error');
            const btn = el.querySelector('.location-timeout-continue');
            if (btn) {
                btn.setAttribute('aria-hidden', 'false');
                btn.style.display = '';
            }
            const text = el.querySelector('.location-loading-text');
            if (text) text.textContent = 'Cela prend plus de temps que prévu !';
        } catch (e) { /* ignore */ }
    }, LOCATION_OVERLAY_TIMEOUT_MS);
}

function clearLocationOverlayTimeout() {
    try { if (_cf_locationOverlayTimer) { clearTimeout(_cf_locationOverlayTimer); _cf_locationOverlayTimer = null; } } catch (e) { }
}

function resetLocationOverlayState() {
    try {
        const el = document.getElementById('location-loading-overlay');
        if (!el) return;
        el.classList.remove('location-loading-error');
        const btn = el.querySelector('.location-timeout-continue');
        if (btn) {
            btn.setAttribute('aria-hidden', 'true');
            btn.style.display = 'none';
        }
        const text = el.querySelector('.location-loading-text');
        if (text) text.textContent = 'récupération de votre position';
    } catch (e) { /* ignore */ }
}