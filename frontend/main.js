import { getLineCenter } from './modules/geoUtils.js';
import { updateRouteDisplay } from './modules/routeDisplay.js';
import { getRouteAndPoints } from './modules/route.js';
import { setupSearchBars } from './modules/searchBar.js';
import { setupLocationControl } from './modules/location.js';
import { loadGeojsonLayers } from './modules/geojsonLoader.js';

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

// Paramètres du périmètre (exemple : centre du campus)
const perimeterCenter = [45.93728985010814, 6.132621267468342]; // à adapter si besoin
const perimeterRadius = 120000; // en mètres

const map = L.map('map').setView(perimeterCenter, 18);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 23,
    attribution: '© OpenStreetMap'
}).addTo(map);
const layerControl = L.control.layers(null, null, { collapsed: false }).addTo(map);

// Stockage des couches et features par étage
const batimentLayers = [];
const batimentFeatures = [];
const cheminFeatures = [];

// Logique de localisation obligatoire et chargement conditionnel
document.addEventListener('DOMContentLoaded', () => {
    setupLocationControl({
        map,
        perimeterCenter,
        perimeterRadius,
        onInside: (e, perimeterCircle) => {
            // L'utilisateur est dans la zone : on charge les geojson et la logique
            map.removeLayer(perimeterCircle);
            loadGeojsonLayers({
                ETAGES,
                batimentLayers,
                batimentFeatures,
                cheminFeatures,
                layerControl,
                map,
                onAllLoaded: () => {
                    setupSearchBars({
                        map,
                        batimentLayers,
                        batimentFeatures,
                        cheminFeatures,
                        ETAGES,
                        getRouteAndPoints
                    });
                }
            });
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
        updateRouteDisplay(map, window.routeSegmentsByEtage, window.departMarkerByEtage, window.arriveeMarkerByEtage, idx);
    }
});
