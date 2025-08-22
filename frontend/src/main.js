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
// Choices will be installed via npm and bundled
import Choices from 'choices.js';
import 'choices.js/public/assets/styles/choices.min.css';

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

// Create dedicated panes to control z-order for base layers.
// personalBase will sit above universalBase so user-provided backgrounds are visible.
try {
    if (!map.getPane('universalBase')) map.createPane('universalBase');
    if (!map.getPane('personalBase')) map.createPane('personalBase');
    // set z-indexes (numbers chosen to sit above default tile pane)
    map.getPane('universalBase').style.zIndex = '200';
    map.getPane('personalBase').style.zIndex = '650';
} catch (e) { /* ignore if panes can't be created */ }

// Theme / base
const UNIVERSAL_BASE_URLS = {
    light: 'https://api.maptiler.com/maps/3b544fc3-420c-4a93-a594-a99b71d941bb/style.json?key=BiyHHi8FTQZ233ADqskZ',
    dark: 'https://api.maptiler.com/maps/04c03a5d-804b-4c6f-9736-b7103fdb530b/style.json?key=BiyHHi8FTQZ233ADqskZ'
};
let universalBaseLayer = null;
function setUniversalBaseLayer(theme) {
    if (universalBaseLayer) map.removeLayer(universalBaseLayer);
    const styleUrl = theme === 'dark' ? UNIVERSAL_BASE_URLS.dark : UNIVERSAL_BASE_URLS.light;
    // place universal base in the dedicated lower pane
    universalBaseLayer = L.maplibreGL({ style: styleUrl, attribution: '\u00a9 MapTiler, OpenStreetMap contributors', pane: 'universalBase' });
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
    if (currentBaseLayer) {
        try { map.removeLayer(currentBaseLayer); } catch (e) { /* ignore */ }
        currentBaseLayer = null;
    }

    const theme = getCurrentTheme() || THEMES.LIGHT;
    // allow backgroundUrl to be either an object mapping themes -> url/style or a single string
    let urlOrStyle = etage.backgroundUrl[theme] || etage.backgroundUrl.light || etage.backgroundUrl;

    // Helper: detect raster tile template (contains {z}/{x}/{y})
    const looksLikeRasterTemplate = (v) => (typeof v === 'string' && /\{ ?z ?\}|\{ ?x ?\}|\{ ?y ?\}/.test(v));
    // Helper: detect a vector style (URL to JSON or a style object)
    const looksLikeVectorStyle = (v) => {
        if (!v) return false;
        if (typeof v === 'object') return true; // assume already a style object
        if (typeof v === 'string') {
            const s = v.split('?')[0];
            if (/\.json$/i.test(s)) return true;
            if (s.toLowerCase().includes('style')) return true; // loose check for style endpoints
        }
        return false;
    };

    try {
        if (looksLikeVectorStyle(urlOrStyle)) {
            // If it's already an object, use it directly
            if (typeof urlOrStyle === 'object') {
                currentBaseLayer = L.maplibreGL({ style: urlOrStyle, attribution: '\u00a9 MapTiler, OpenStreetMap contributors' });
                currentBaseLayer.addTo(map);
            } else if (typeof urlOrStyle === 'string') {
                // Try to fetch/validate the style JSON before handing it to maplibre.
                const tryUrls = [
                    urlOrStyle,
                    urlOrStyle + '.json',
                    urlOrStyle.replace(/\/$/, '') + '/style.json'
                ];

                const tryFetchStyle = async (candidates) => {
                    for (let u of candidates) {
                        try {
                            const res = await fetch(u, { method: 'GET' });
                            if (!res.ok) continue;
                            const contentType = (res.headers.get('content-type') || '').toLowerCase();
                            if (contentType.includes('application/json')) {
                                try {
                                    const json = await res.json();
                                    return { style: json, url: u };
                                } catch (e) {
                                    // parse error, continue to next candidate
                                    continue;
                                }
                            }
                            // Some servers may return JSON with different content-type; attempt to parse anyway
                            try {
                                const txt = await res.text();
                                if (txt && txt.trim().startsWith('{')) {
                                    try {
                                        const json = JSON.parse(txt);
                                        return { style: json, url: u };
                                    } catch (e) {
                                        // not json
                                        continue;
                                    }
                                }
                            } catch (e) { /* ignore */ }
                        } catch (e) {
                            // fetch failed for this candidate, try next
                            continue;
                        }
                    }
                    return null;
                };

                // Async resolution: attempt to load style then add maplibre; otherwise fallback to raster
                tryFetchStyle(tryUrls).then(result => {
                    if (result && result.style) {
                        try {
                            const layer = L.maplibreGL({ style: result.style, attribution: '\u00a9 MapTiler, OpenStreetMap contributors', pane: 'personalBase' });
                            if (currentBaseLayer) try { map.removeLayer(currentBaseLayer); } catch (e) { }
                            currentBaseLayer = layer;
                            currentBaseLayer.addTo(map);
                        } catch (e) {
                            console.warn('[BACKGROUND] maplibre add failed, falling back to raster', e);
                            const layer = L.tileLayer(urlOrStyle, { maxZoom: 23, attribution: '\u00a9 OpenStreetMap', pane: 'personalBase' });
                            if (currentBaseLayer) try { map.removeLayer(currentBaseLayer); } catch (e) { }
                            currentBaseLayer = layer;
                            currentBaseLayer.addTo(map);
                        }
                    } else {
                        // fallback to raster tile layer
                        const layer = L.tileLayer(urlOrStyle, { maxZoom: 23, attribution: '\u00a9 OpenStreetMap', pane: 'personalBase' });
                        if (currentBaseLayer) try { map.removeLayer(currentBaseLayer); } catch (e) { }
                        currentBaseLayer = layer;
                        currentBaseLayer.addTo(map);
                    }
                }).catch(() => {
                    const layer = L.tileLayer(urlOrStyle, { maxZoom: 23, attribution: '\u00a9 OpenStreetMap', pane: 'personalBase' });
                    if (currentBaseLayer) try { map.removeLayer(currentBaseLayer); } catch (e) { }
                    currentBaseLayer = layer;
                    currentBaseLayer.addTo(map);
                });
            }
        } else if (looksLikeRasterTemplate(urlOrStyle)) {
            // Raster tile template (local tiles or remote tiles)
            currentBaseLayer = L.tileLayer(urlOrStyle, { maxZoom: 23, attribution: '\u00a9 OpenStreetMap', pane: 'personalBase' });
            currentBaseLayer.addTo(map);
        } else if (typeof urlOrStyle === 'string') {
            // If it's a plain string that doesn't look like raster or vector, assume raster template
            currentBaseLayer = L.tileLayer(urlOrStyle, { maxZoom: 23, attribution: '\u00a9 OpenStreetMap' });
            currentBaseLayer.addTo(map);
        }
    } catch (e) {
        console.error('[BACKGROUND] Error while setting background layer', e);
    }

    currentEtageIdx = idx;
}
setBackgroundForEtage(0);

onThemeChange(() => setBackgroundForEtage(currentEtageIdx));
map.on('baselayerchange', function (e) {
    const idx = batimentLayers.findIndex(l => l === e.layer);
    if (idx !== -1) {
        setBackgroundForEtage(idx);
        updateRouteDisplay(map, window.routeSegmentsByEtage, window.departMarkerByEtage, window.arriveeMarkerByEtage, window.routeArrowsByEtage, idx);
    }
});
map.on('layeradd', function (e) {
    const idx = batimentLayers.findIndex(l => l === e.layer);
    if (idx !== -1) {
        setBackgroundForEtage(idx);
        updateRouteDisplay(map, window.routeSegmentsByEtage, window.departMarkerByEtage, window.arriveeMarkerByEtage, window.routeArrowsByEtage, idx);
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
        // if a selected config was stored previously, mark the corresponding option
        try {
            const stored = localStorage.getItem('selectedConfig');
            if (stored && configs.includes(stored)) {
                const opt = selector.querySelector(`option[value="${stored}"]`);
                if (opt) opt.selected = true;
            }
        } catch (e) { /* ignore */ }
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
        // keep storedConfig so the UI can reflect the currently selected config after reload
    }
    await loadConfigFile(configToLoad);
    selector.value = configToLoad;
    // ensure the option element is marked selected so Choices picks it up on init
    try {
        const opt = selector.querySelector(`option[value="${configToLoad}"]`);
        if (opt) opt.selected = true;
    } catch (e) { /* ignore */ }
    // Initialize Choices.js from the bundled import
    try {
        if (!selector._choicesInstance) {
            // compute min-width based on widest option text (mirror native select behaviour)
            let minWidthPx = null;
            try {
                const measurer = document.createElement('span');
                measurer.style.position = 'absolute';
                measurer.style.visibility = 'hidden';
                measurer.style.whiteSpace = 'nowrap';
                // use body font so measurement matches the rendered Choices label
                measurer.style.font = window.getComputedStyle(document.body).font || '14px Arial';
                document.body.appendChild(measurer);
                let maxW = 0;
                Array.from(selector.options).forEach(o => {
                    measurer.textContent = o.textContent || '';
                    const w = measurer.getBoundingClientRect().width;
                    if (w > maxW) maxW = w;
                });
                document.body.removeChild(measurer);
                const padding = 40; // room for dropdown icon + padding
                minWidthPx = Math.ceil(maxW + padding);
                // set fallback on the original select
                selector.style.minWidth = minWidthPx + 'px';
            } catch (e) {
                // ignore measuring errors
            }

            selector._choicesInstance = new Choices(selector, {
                searchEnabled: true,
                itemSelectText: '',
                shouldSort: false,
                placeholder: true,
                placeholderValue: 'Sélectionner une config...',
                searchPlaceholderValue: 'Rechercher...'
            });
            // apply the computed min width to the Choices container so it doesn't shrink
            try {
                const ch = selector._choicesInstance;
                let choicesEl = null;
                if (ch && ch.containerOuter) {
                    // newer Choices stores containerOuter.element or containerOuter
                    choicesEl = ch.containerOuter.element || ch.containerOuter;
                }
                if (!choicesEl) {
                    // fallback: try to find the generated .choices element near the original select
                    choicesEl = selector.parentElement && selector.parentElement.querySelector && selector.parentElement.querySelector('.choices');
                    if (!choicesEl) choicesEl = document.querySelector('.choices');
                }
                if (choicesEl && minWidthPx) {
                    choicesEl.style.minWidth = minWidthPx + 'px';
                }
                // ensure the visible value matches the loaded config
                if (ch && typeof ch.setChoiceByValue === 'function') {
                    ch.setChoiceByValue(configToLoad);
                }
            } catch (e) { /* ignore */ }
        }
    } catch (err) {
        console.warn('Choices initialization failed', err);
    }

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
    try {
        // Try common selectors for the search input used by the app. If none found, do nothing.
        const searchEl = document.querySelector('input[type="search"], input.search-input, #search-input');
        if (searchEl) searchEl.value = '';
    } catch (e) { /* ignore */ }
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
    setupLocationControl({ map, config, perimeterCenter: config.perimeterCenter, perimeterRadius: config.perimeterRadius, allowAutoCenter: false });
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
            // Toujours déclencher l'initialisation quand une position est trouvée.
            // Le contrôle de confidentialité est assuré par le fait que cet évènement
            // n'arrive que si la permission est accordée.
            onLocationGranted();
        },
        onOutside: (e) => {
            // No-op: location module enforces perimeter center when allowAutoCenter is false.
            // Avoid forcing map.setView here because location events fire frequently.
        },
        onDenied: () => onLocationDenied()
    });

    // Démarre immédiatement la localisation avec le plugin
    try {
        if (locCtrl && typeof locCtrl.startLocate === 'function') {
            // Use Permissions API when available to avoid triggering the geolocation
            // permission prompt during cold startup (Firefox can appear to hang).
            // If permission is already granted we start immediately. If denied,
            // call the denied handler. If state is 'prompt', defer starting the
            // locate until the user interacts (first click/keydown) to avoid a
            // blocking prompt. As a fallback, do a short timeout start.
            if (navigator.permissions && typeof navigator.permissions.query === 'function') {
                navigator.permissions.query({ name: 'geolocation' }).then((perm) => {
                    try {
                        if (perm.state === 'granted') {
                            locCtrl.startLocate();
                        } else if (perm.state === 'denied') {
                            // Keep same behaviour as when the plugin reports denial
                            onLocationDenied();
                        } else {
                            // 'prompt' -> try to start immediately. Some browsers (or
                            // configurations) may block until a user gesture; in that
                            // case the call will throw or the returned promise will
                            // reject, so fall back to deferring start until first
                            // user interaction.
                            const addDeferredStart = () => {
                                const startOnce = () => {
                                    try { locCtrl.startLocate(); } catch (e) { /* ignore */ }
                                    window.removeEventListener('pointerdown', startOnce);
                                    window.removeEventListener('keydown', startOnce);
                                };
                                window.addEventListener('pointerdown', startOnce, { once: true });
                                window.addEventListener('keydown', startOnce, { once: true });
                            };

                            try {
                                const res = locCtrl.startLocate();
                                // If startLocate returns a promise, catch failures
                                if (res && typeof res.then === 'function') {
                                    res.catch(() => addDeferredStart());
                                }
                            } catch (err) {
                                // Fallback: wait for the first user interaction
                                addDeferredStart();
                            }
                        }
                    } catch (e) {
                        // If anything goes wrong, attempt a deferred start
                        setTimeout(() => { try { locCtrl.startLocate(); } catch (err) { /* ignore */ } }, 500);
                    }
                }).catch(() => {
                    // Permissions API failed - defer slightly to reduce startup impact
                    setTimeout(() => { try { locCtrl.startLocate(); } catch (e) { /* ignore */ } }, 500);
                });
            } else {
                // No Permissions API - defer slightly to reduce startup impact on some browsers
                setTimeout(() => { try { locCtrl.startLocate(); } catch (e) { /* ignore */ } }, 500);
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