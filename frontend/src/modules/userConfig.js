
// Fichier de configuration des préférences utilisateur et variables modifiables
// Modifiez ces valeurs pour personnaliser l'application

// --- Étages (importé de main.js)
export const ETAGES = [
    {
        nom: "Etage -1",
        code: "2",
        cheminUrl: "/geojson/chemins_etage2.geojson",
        batimentUrl: "/geojson/salles_etage2.geojson",
        backgroundUrl: {
            light: "./QTiles/etage2/{z}/{x}/{y}.png",
            dark: "./QTiles/etage2/{z}/{x}/{y}.png"
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

// --- Périmètre (importé de main.js)
export const perimeterCenter = [45.93728985010814, 6.132621267468342]; // à adapter si besoin
export const perimeterRadius = 1000000000000; // en mètres

// --- Couleurs (importé de colors.js)
export const BASE_HUE = 0;   // 220 = bleu, 0 = rouge, 120 = vert, etc.
export const BASE_SAT = 70;    // Saturation de base (0–100)
export const BASE_LIGHT = 55;  // Luminosité de base (0–100)

// --- Liste noire pour l'interaction avec les entités géographiques (importé de geoFeatureInteraction.js)
export const blacklist = ["", "escalier"];
export const osrmUrl = "https://classeinder.duckdns.org/osrm/route/v1/driving"; // URL du service OSRM mais qui est fausse