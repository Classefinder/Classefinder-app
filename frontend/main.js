import { getLineCenter } from './modules/geoUtils.js';
import { updateRouteDisplay } from './modules/routeDisplay.js';
import { getRouteAndPoints } from './modules/route.js';
import { setupSearchBars } from './modules/searchBar.js';

// Nouvelle configuration dynamique des étages avec code explicite
const ETAGES = [
    {
        nom: "Etage -1",
        code: "2",
        cheminUrl: "http://localhost:3000/geojson/chemins_etage2.geojson",
        batimentUrl: "http://localhost:3000/geojson/salles_etage2.geojson"
    },
    {
        nom: "Etage 0",
        code: "0",
        cheminUrl: "http://localhost:3000/geojson/chemins_etage0.geojson",
        batimentUrl: "http://localhost:3000/geojson/salles_etage0.geojson"
    },
    {
        nom: "Etage 1",
        code: "1",
        cheminUrl: "http://localhost:3000/geojson/chemins_etage1.geojson",
        batimentUrl: "http://localhost:3000/geojson/salles_etage1.geojson"
    },
];

const map = L.map('map').setView([45.93728985010814, 6.132621267468342], 18);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 23,
    attribution: '© OpenStreetMap'
}).addTo(map);

const layerControl = L.control.layers(null, null, { collapsed: false }).addTo(map);

// Stockage des couches et features par étage
const batimentLayers = [];
const batimentFeatures = [];
const cheminFeatures = [];

// Chargement dynamique des calques pour chaque étage
ETAGES.forEach((etage, idx) => {
    // Calque chemin (jamais affiché, ni dans le control layer)
    fetch(etage.cheminUrl)
        .then(res => res.json())
        .then(data => {
            const features = [];
            L.geoJSON(data, {
                onEachFeature: (feature, layer) => {
                    features.push({ feature, layer });
                }
            });
            cheminFeatures[idx] = features;
        });

    // Calque batiment (affiché dans le control layer)
    fetch(etage.batimentUrl)
        .then(res => res.json())
        .then(data => {
            const features = [];
            const batLayer = L.geoJSON(data, {
                onEachFeature: (feature, layer) => {
                    features.push({ feature, layer });
                    if (feature.properties && feature.properties.name) {
                        layer.bindPopup(feature.properties.name);
                    }
                }
            });
            batimentLayers[idx] = batLayer;
            batimentFeatures[idx] = features;
            layerControl.addBaseLayer(batLayer, etage.nom);
            // Affiche le premier étage par défaut
            if (idx === 0) {
                batLayer.addTo(map);
            }
        });
});

// On attend que tous les calques soient chargés avant d'initialiser les barres de recherche
Promise.all([
    ...ETAGES.map((etage, idx) => fetch(etage.batimentUrl).then(res => res.json())),
]).then(() => {
    setupSearchBars({
        map,
        batimentLayers,
        batimentFeatures,
        cheminFeatures,
        ETAGES,
        getRouteAndPoints
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
        updateRouteDisplay(map, window.routeSegmentsByEtage, window.departMarkerByEtage, window.arriveeMarkerByEtage, idx);
    }
});
