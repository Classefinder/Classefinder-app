import { getLineCenter } from './modules/geoUtils.js';
import { updateRouteDisplay } from './modules/routeDisplay.js';
import { getRouteAndPoints } from './modules/route.js';
import { setupSearchBars } from './modules/searchBar.js';
import { setupLocationControl, addSetDepartButton, getCurrentUserPosition } from './modules/location.js';
import { loadGeojsonLayers } from './modules/geojsonLoader.js';

// Nouvelle configuration dynamique des étages avec code explicite
const ETAGES = [
    {
        nom: "Etage -1",
        code: "2",
        cheminUrl: "http://localhost:3000/geojson/chemins_etage2.geojson",
        batimentUrl: "http://localhost:3000/geojson/salles_etage2.geojson",
        backgroundUrl: "./QTiles/etage2/{z}/{x}/{y}.png" // format compatible Leaflet
    },
    {
        nom: "Etage 0",
        code: "0",
        cheminUrl: "http://localhost:3000/geojson/chemins_etage0.geojson",
        batimentUrl: "http://localhost:3000/geojson/salles_etage0.geojson",
        backgroundUrl: "./QTiles/etage0/{z}/{x}/{y}.png"
    },
    {
        nom: "Etage 1",
        code: "1",
        cheminUrl: "http://localhost:3000/geojson/chemins_etage1.geojson",
        batimentUrl: "http://localhost:3000/geojson/salles_etage1.geojson",
        backgroundUrl: "./QTiles/etage1/{z}/{x}/{y}.png"
    },
];

// Paramètres du périmètre (exemple : centre du campus)
const perimeterCenter = [45.93728985010814, 6.132621267468342]; // à adapter si besoin
const perimeterRadius = 120000; // en mètres

const map = L.map('map').setView(perimeterCenter, 18);
// Ajout du fond universel, toujours présent
const universalBaseLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 23,
    attribution: '© OpenStreetMap'
}).addTo(map);
const layerControl = L.control.layers(null, null, { collapsed: false }).addTo(map);

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
                                        const marker = L.marker(latlng).bindPopup('Départ : Ma position');
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
                                                routeSegmentsByEtage: window.routeSegmentsByEtage
                                            });
                                        }
                                    }
                                }
                            });
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

// Ajoute un listener sur le changement de baseLayer pour afficher les bons segments et marqueurs
map.on('baselayerchange', function (e) {
    const idx = batimentLayers.findIndex(l => l === e.layer);
    if (idx !== -1) {
        setBackgroundForEtage(idx);
        updateRouteDisplay(map, window.routeSegmentsByEtage, window.departMarkerByEtage, window.arriveeMarkerByEtage, idx);
    }
});

// Ajout d'une gestion dynamique du fond de carte par étage
let currentBaseLayer = null;
function setBackgroundForEtage(idx) {
    const etage = ETAGES[idx];
    if (!etage || !etage.backgroundUrl) return;
    if (currentBaseLayer) {
        map.removeLayer(currentBaseLayer);
    }
    // Ajoute le fond dynamique en plus du fond universel
    currentBaseLayer = L.tileLayer(etage.backgroundUrl, {
        maxZoom: 23,
        attribution: '© OpenStreetMap'
    });
    currentBaseLayer.addTo(map);
}
// Initialisation avec le fond du premier étage
setBackgroundForEtage(0);

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

// Gestion du mode sombre
const darkModeBtn = document.getElementById('dark-mode-toggle');
darkModeBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
});
