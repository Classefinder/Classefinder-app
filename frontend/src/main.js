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

// Création d'un objet config unique
const config = {
    ETAGES: userConfig.ETAGES,
    perimeterCenter: userConfig.perimeterCenter,
    perimeterRadius: userConfig.perimeterRadius,
    BASE_HUE: userConfig.BASE_HUE,
    BASE_SAT: userConfig.BASE_SAT,
    BASE_LIGHT: userConfig.BASE_LIGHT,
    blacklist: userConfig.blacklist,
    osrmUrl: userConfig.osrmUrl
};

// Ajout d'un niveau de zoom libre
const map = L.map('map', {
    zoomDelta: 0.1,
    zoomSnap: 0
}).setView(config.perimeterCenter, 18);

// Gestion du sélecteur de config
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

async function loadConfigFile(filename) {
    try {
        const res = await fetch(`/config/${filename}`);
        const data = await res.json();
        
        // Mettre à jour l'objet config
        Object.assign(config, data);
        
        // Mise à jour de la carte
        if (map && map.setView) {
            map.setView(config.perimeterCenter, 18);
            
            // Mettre à jour le cercle de périmètre si existant
            if (window.perimeterCircle) {
                window.perimeterCircle.setLatLng(config.perimeterCenter);
                window.perimeterCircle.setRadius(config.perimeterRadius);
            }
        }
        return data;
    } catch (e) {
        console.error('Erreur lors du chargement du fichier de config:', e);
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
    // Charger la config mémorisée si présente
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

// Initialiser le sélecteur de config
setupConfigSelector();

// URLs MapTiler vectoriel
const UNIVERSAL_BASE_URLS = {
    light: 'https://api.maptiler.com/maps/3b544fc3-420c-4a93-a594-a99b71d941bb/style.json?key=BiyHHi8FTQZ233ADqskZ',
    dark: 'https://api.maptiler.com/maps/04c03a5d-804b-4c6f-9736-b7103fdb530b/style.json?key=BiyHHi8FTQZ233ADqskZ'
};

let universalBaseLayer = null;

function setUniversalBaseLayer(theme) {
    if (universalBaseLayer) {
        map.removeLayer(universalBaseLayer);
    }
    const styleUrl = theme === 'dark' ? UNIVERSAL_BASE_URLS.dark : UNIVERSAL_BASE_URLS.light;
    universalBaseLayer = L.maplibreGL({
        style: styleUrl,
        attribution: '© MapTiler, OpenStreetMap contributors'
    });
    universalBaseLayer.addTo(map);
}

// Initialisation du thème
initThemeManager();
setUniversalBaseLayer(getCurrentTheme());
onThemeChange(setUniversalBaseLayer);
setupTheme(map, UNIVERSAL_BASE_URLS);

// Initialisation des fonctionnalités de la carte
const { batimentLayers, batimentFeatures, cheminFeatures, layerControl: mapLayerControl } = setupMapFeatures({
    map,
    ETAGES: config.ETAGES,
    perimeterCenter: config.perimeterCenter,
    perimeterRadius: config.perimeterRadius,
    getRouteAndPoints
});

// Flags d'initialisation
let geojsonLoaded = false;
let searchBarInitialized = false;
let departButtonAdded = false;

// Logique de localisation
document.addEventListener('DOMContentLoaded', () => {
    setupLocationControl({
        map,
        config, // Passer l'objet config complet
        onInside: (e, perimeterCircle) => {
            map.removeLayer(perimeterCircle);
            if (!geojsonLoaded) {
                geojsonLoaded = true;
                loadGeojsonLayers({
                    ETAGES: config.ETAGES,
                    batimentLayers,
                    batimentFeatures,
                    cheminFeatures,
                    layerControl: mapLayerControl,
                    getRouteAndPoints,
                    map,
                    BASE_HUE: config.BASE_HUE,
                    BASE_SAT: config.BASE_SAT,
                    BASE_LIGHT: config.BASE_LIGHT,
                    blacklist: config.blacklist,
                    onAllLoaded: () => {
                        if (!searchBarInitialized) {
                            searchBarInitialized = true;
                            setupSearchBars({
                                map,
                                batimentLayers,
                                batimentFeatures,
                                cheminFeatures,
                                ETAGES: config.ETAGES,
                                getRouteAndPoints
                            });
                        }
                        if (!departButtonAdded) {
                            departButtonAdded = true;
                            addSetDepartButton({
                                map,
                                getCurrentPosition: cb => getCurrentUserPosition(map, cb),
                                setDepartMarker: (latlng) => {
                                    window.departMarkerByEtage.forEach((marker, idx) => {
                                        if (marker) map.removeLayer(marker);
                                        window.departMarkerByEtage[idx] = null;
                                    });
                                    const currentIdx = batimentLayers.findIndex(l => map.hasLayer(l));
                                    if (currentIdx !== -1) {
                                        const marker = L.marker(latlng, { icon: departIcon, className: 'start-marker' }).bindPopup('Départ : Ma position');
                                        window.departMarkerByEtage[currentIdx] = marker;
                                        marker.addTo(map).openPopup();
                                        window.currentRouteStart = [latlng.lat, latlng.lng];
                                        window.currentRouteStartIdx = currentIdx;
                                        if (window.currentRouteStart && window.currentRouteEnd) {
                                            getRouteAndPoints({
                                                map,
                                                start: window.currentRouteStart,
                                                end: window.currentRouteEnd,
                                                markers: [marker, window.arriveeMarkerByEtage[window.currentRouteEndIdx]],
                                                layersEtages: batimentLayers,
                                                departIdx: window.currentRouteStartIdx,
                                                arriveeIdx: window.currentRouteEndIdx,
                                                ETAGES: config.ETAGES,
                                                batimentLayers,
                                                routeSegmentsByEtage: window.routeSegmentsByEtage,
                                                markerOptions: { className: 'end-marker' },
                                                osrmUrl: config.osrmUrl
                                            });
                                        }
                                    }
                                }
                            });
                        }
                        batimentLayers.forEach((layer, idx) => {
                            if (idx === 0) {
                                if (!map.hasLayer(layer)) map.addLayer(layer);
                            } else {
                                if (map.hasLayer(layer)) map.removeLayer(layer);
                            }
                        });
                        const firstVisibleIdx = batimentLayers.findIndex(layer => map.hasLayer(layer));
                        if (firstVisibleIdx !== -1) {
                            setBackgroundForEtage(firstVisibleIdx);
                        }
                    }
                });
            }
        },
        onOutside: (e, perimeterCircle) => {
            map.setView(config.perimeterCenter, 18);
        },
        onDenied: (e, perimeterCircle) => {
            map.setView(config.perimeterCenter, 18);
        }
    });

    // Gestion du bouton dark mode
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

// Variables globales
window.routeSegmentsByEtage = [];
window.currentRouteStart = null;
window.currentRouteEnd = null;
window.currentRouteStartIdx = null;
window.currentRouteEndIdx = null;
window.departMarkerByEtage = [];
window.arriveeMarkerByEtage = [];
window.perimeterCircle = null; // Référence globale au cercle

// Icônes personnalisés
const departIcon = L.icon({
    iconUrl: "./images/start-icon.svg",
    iconSize: [15, 15],
    iconAnchor: [7.5, 7.5],
    popupAnchor: [0, -10],
});
const arriveeIcon = L.icon({
    iconUrl: '/images/end-icon.svg',
    iconSize: [15, 15],
    iconAnchor: [7.5, 7.5],
    popupAnchor: [0, -10],
});

// Gestion du fond de carte par étage
let currentBaseLayer = null;
let currentEtageIdx = 0;
function setBackgroundForEtage(idx) {
    const etage = config.ETAGES[idx];
    if (!etage || !etage.backgroundUrl) return;
    if (currentBaseLayer) {
        map.removeLayer(currentBaseLayer);
    }
    const theme = getCurrentTheme() || THEMES.LIGHT;
    const url = etage.backgroundUrl[theme] || etage.backgroundUrl.light;
    currentBaseLayer = L.tileLayer(url, {
        maxZoom: 23,
        attribution: '© OpenStreetMap'
    });
    currentBaseLayer.addTo(map);
    currentEtageIdx = idx;
}
setBackgroundForEtage(0);

// Écouteurs d'événements
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

// Réorganisation des contrôles UI
setTimeout(() => {
    const leafletLayerControl = document.querySelector('.leaflet-control-layers');
    const customLayerControl = document.getElementById('custom-layer-control');
    if (leafletLayerControl && customLayerControl) {
        customLayerControl.appendChild(leafletLayerControl);
    }
    const leafletLocate = document.querySelector('.leaflet-control-locate');
    const customLocateBtn = document.getElementById('custom-locate-btn');
    if (leafletLocate && customLocateBtn) {
        customLocateBtn.appendChild(leafletLocate);
    }
}, 500);