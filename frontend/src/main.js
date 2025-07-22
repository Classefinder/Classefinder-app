import { getLineCenter } from './modules/geoUtils.js';
import { updateRouteDisplay } from './modules/routeDisplay.js';
import { getRouteAndPoints } from './modules/route.js';
import { setupSearchBars } from './modules/searchBar.js';
import { setupLocationControl, addSetDepartButton, getCurrentUserPosition } from './modules/location.js';
import { loadGeojsonLayers } from './modules/geojsonLoader.js';
import { initThemeManager, getCurrentTheme, onThemeChange, toggleTheme, THEMES } from './modules/themeManager.js';

// Nouvelle configuration dynamique des étages avec code explicite
const ETAGES = [
    {
        nom: "Etage -1",
        code: "2",
        cheminUrl: "/geojson/chemins_etage2.geojson",
        batimentUrl: "/geojson/salles_etage2.geojson",
        backgroundUrl: {
            light: "./QTiles/etage2/{z}/{x}/{y}.png",
            dark: "./QTiles/etage2/{z}/{x}/{y}.png" // À remplacer si tu as un fond sombre spécifique
        }
    },
    {
        nom: "Etage 0",
        code: "0",
        cheminUrl: "/geojson/chemins_etage0.geojson",
        batimentUrl: "/geojson/salles_etage0.geojson",
        backgroundUrl: {
            light: "./QTiles/etage0/{z}/{x}/{y}.png",
            dark: "./QTiles/etage0/{z}/{x}/{y}.png"
        }
    },
    {
        nom: "Etage 1",
        code: "1",
        cheminUrl: "/geojson/chemins_etage1.geojson",
        batimentUrl: "/geojson/salles_etage1.geojson",
        backgroundUrl: {
            light: "./QTiles/etage1/{z}/{x}/{y}.png",
            dark: "./QTiles/etage1/{z}/{x}/{y}.png"
        }
    },
];

// Paramètres du périmètre (exemple : centre du campus)
const perimeterCenter = [45.93728985010814, 6.132621267468342]; // à adapter si besoin
const perimeterRadius = 120000; // en mètres

// Ajout d'un niveau de zoom libre
const map = L.map('map', {
    zoomDelta: 0.1,
    zoomSnap: 0
}).setView(perimeterCenter, 18);
// URLs MapTiler vectoriel pour le fond universel
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

// Déclaration AVANT toute utilisation
const layerControl = L.control.layers(null, null, { collapsed: false }).addTo(map);

// Initialisation du gestionnaire de thème
initThemeManager();
setUniversalBaseLayer(getCurrentTheme());
onThemeChange(setUniversalBaseLayer);

// Stockage des couches et features par étage
const batimentLayers = [];
const batimentFeatures = [];
const cheminFeatures = [];

// Flags pour empêcher l'initialisation multiple
let geojsonLoaded = false;
let searchBarInitialized = false;
let departButtonAdded = false;

// Logique de localisation obligatoire et chargement conditionnel
document.addEventListener('DOMContentLoaded', () => {
    setupLocationControl({
        map,
        perimeterCenter,
        perimeterRadius,
        onInside: (e, perimeterCircle) => {
            map.removeLayer(perimeterCircle);
            if (!geojsonLoaded) {
                geojsonLoaded = true;
                loadGeojsonLayers({
                    ETAGES,
                    batimentLayers,
                    batimentFeatures,
                    cheminFeatures,
                    layerControl,
                    map,
                    onAllLoaded: () => {
                        if (!searchBarInitialized) {
                            searchBarInitialized = true;
                            setupSearchBars({
                                map,
                                batimentLayers,
                                batimentFeatures,
                                cheminFeatures,
                                ETAGES,
                                getRouteAndPoints
                            });
                        }
                        if (!departButtonAdded) {
                            departButtonAdded = true;
                            addSetDepartButton({
                                map,
                                getCurrentPosition: cb => getCurrentUserPosition(map, cb),
                                setDepartMarker: (latlng) => {
                                    // Supprime tous les anciens marqueurs de départ sur tous les étages
                                    window.departMarkerByEtage.forEach((marker, idx) => {
                                        if (marker) map.removeLayer(marker);
                                        window.departMarkerByEtage[idx] = null;
                                    });
                                    // Place le marqueur de départ sur l'étage courant
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
                                                ETAGES,
                                                batimentLayers,
                                                routeSegmentsByEtage: window.routeSegmentsByEtage,
                                                markerOptions: { className: 'end-marker' }
                                            });
                                        }
                                    }
                                }
                            });
                        }
                        // Masquer tous les layers sauf celui de l'étage actif (0) après chargement
                        batimentLayers.forEach((layer, idx) => {
                            if (idx === 0) {
                                if (!map.hasLayer(layer)) map.addLayer(layer);
                            } else {
                                if (map.hasLayer(layer)) map.removeLayer(layer);
                            }
                        });
                        // Synchronise dynamiquement le fond de carte avec le premier layer affiché
                        const firstVisibleIdx = batimentLayers.findIndex(layer => map.hasLayer(layer));
                        if (firstVisibleIdx !== -1) {
                            setBackgroundForEtage(firstVisibleIdx);
                        }
                    }
                });
            }
        },
        onOutside: (e, perimeterCircle) => {
            // L'utilisateur est hors zone : on montre juste le cercle
            map.setView(perimeterCenter, 18);
            // La position de l'utilisateur est affichée par le plugin
        },
        onDenied: (e, perimeterCircle) => {
            // L'utilisateur refuse la localisation : on montre juste le cercle
            map.setView(perimeterCenter, 18);
        }
    });
    // Gestion du bouton dark mode (toggle + icône dynamique)
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
        // Met à jour l'icône au chargement et lors des changements de thème
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

// Stockage global des segments d'itinéraire par étage
window.routeSegmentsByEtage = [];
window.currentRouteStart = null;
window.currentRouteEnd = null;
window.currentRouteStartIdx = null;
window.currentRouteEndIdx = null;

// Stockage des marqueurs par étage
window.departMarkerByEtage = [];
window.arriveeMarkerByEtage = [];

// Icônes personnalisés pour les marqueurs de départ et d'arrivée
const departIcon = L.icon({
    iconUrl: "./images/start-icon.svg",
    iconSize: [15, 15], // size of the icon
    iconAnchor: [7.5, 7.5], // point of the icon which will correspond to marker's location
    popupAnchor: [0, -10], // point from which the popup should open relative to the iconAnchor
});
const arriveeIcon = L.icon({
    iconUrl: '/images/end-icon.svg',
    iconSize: [15, 15], // size of the icon
    iconAnchor: [7.5, 7.5], // point of the icon which will correspond to marker's location
    popupAnchor: [0, -10], // point from which the popup should open relative
});

// Ajout d'une gestion dynamique du fond de carte par étage et par thème
let currentBaseLayer = null;
let currentEtageIdx = 0;
function setBackgroundForEtage(idx) {
    const etage = ETAGES[idx];
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
// Initialisation avec le fond du premier étage
setBackgroundForEtage(0);

// Réagit au changement de thème pour changer le fond de carte
onThemeChange(() => {
    setBackgroundForEtage(currentEtageIdx);
});

// Ajoute un listener sur le changement de baseLayer pour afficher les bons segments et marqueurs
map.on('baselayerchange', function (e) {
    const idx = batimentLayers.findIndex(l => l === e.layer);
    if (idx !== -1) {
        setBackgroundForEtage(idx);
        updateRouteDisplay(map, window.routeSegmentsByEtage, window.departMarkerByEtage, window.arriveeMarkerByEtage, idx);
    }
});

// Synchronise le fond de carte personnalisé avec le layer GeoJSON d'étage affiché (utile pour la recherche)
map.on('layeradd', function (e) {
    const idx = batimentLayers.findIndex(l => l === e.layer);
    if (idx !== -1) {
        setBackgroundForEtage(idx);
        updateRouteDisplay(map, window.routeSegmentsByEtage, window.departMarkerByEtage, window.arriveeMarkerByEtage, idx);
    }
});

// Après le chargement des layers et de la localisation
// Déplace le control layer dans le conteneur custom
setTimeout(() => {
    const leafletLayerControl = document.querySelector('.leaflet-control-layers');
    const customLayerControl = document.getElementById('custom-layer-control');
    if (leafletLayerControl && customLayerControl && !customLayerControl.hasChildNodes()) {
        customLayerControl.appendChild(leafletLayerControl);
    }
    // Déplace le bouton locate dans le conteneur custom
    const leafletLocate = document.querySelector('.leaflet-control-locate');
    const customLocateBtn = document.getElementById('custom-locate-btn');
    if (leafletLocate && customLocateBtn && !customLocateBtn.hasChildNodes()) {
        customLocateBtn.appendChild(leafletLocate);
    }
}, 500);
