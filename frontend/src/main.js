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

const map = L.map('map', { zoomDelta: 0.1, zoomSnap: 0 }).setView(config.perimeterCenter, config.initialZoom);

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

        return data;
    } catch (e) {
        console.error('Erreur lors du chargement du fichier de config:', e);
    }
}

async function loadConfigList() {
    try {
        const res = await fetch('/api/configs');
        const configs = await res.json();
        const selector = document.getElementById('config-selector');
        selector.innerHTML = '';
        configs.forEach(cfg => {
            const opt = document.createElement('option');
            opt.value = cfg;
            opt.textContent = cfg.replace(/\.json$/, '');
            selector.appendChild(opt);
        });
        return configs;
    } catch (e) {
        console.error('Erreur lors du chargement des configs:', e);
        return [];
    }
}

async function setupConfigSelector() {
    const configs = await loadConfigList();
    const selector = document.getElementById('config-selector');
    if (!configs.length) {
        selector.innerHTML = '<option>Aucune config</option>';
        selector.disabled = true;
        return;
    }
    selector.disabled = false;
    let configToLoad = configs[0];
    const storedConfig = localStorage.getItem('selectedConfig');
    if (storedConfig && configs.includes(storedConfig)) {
        configToLoad = storedConfig;
        localStorage.removeItem('selectedConfig');
    }
    await loadConfigFile(configToLoad);
    selector.value = configToLoad;
    selector.addEventListener('change', async (e) => {
        localStorage.setItem('selectedConfig', e.target.value);
        window.location.reload();
    });
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
}

function onLocationDenied() {
    window._cf_locationPermission = 'denied';
    // only keep base map + perimeter visible
    setupLocationControl({ map, config, perimeterCenter: config.perimeterCenter, perimeterRadius: config.perimeterRadius });
    map.setView(config.perimeterCenter, config.initialZoom || 18);
}

document.addEventListener('DOMContentLoaded', () => {
    setupLocationControl({
        map,
        config,
        onInside: (e, perimeterCircle) => {
            if (window._cf_locationPermission !== 'granted') onLocationGranted();
        },
        onOutside: (e) => {
            map.setView(config.perimeterCenter, config.initialZoom || 18);
        },
        onDenied: () => onLocationDenied()
    });

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