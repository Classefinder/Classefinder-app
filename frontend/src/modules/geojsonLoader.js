import { getBaseColorByIndex } from './colors.js';

// Ce module gère le chargement conditionnel des données geojson selon la localisation
// function getColorByIndex(idx, total, baseHue = 220, baseSat = 70, baseLight = 55) {
//     // Génère une couleur HSL en variant la teinte
//     const hue = (baseHue + (idx * (360 / total))) % 360;
//     return `hsl(${hue}, ${baseSat}%, ${baseLight}%)`;
// }

// Ajoute une classe CSS dynamique à chaque calque selon l'étage
export function loadGeojsonLayers({ ETAGES, batimentLayers, batimentFeatures, cheminFeatures, layerControl, map, onAllLoaded }) {
    let loadedCount = 0;
    ETAGES.forEach((etage, idx) => {
        // Calque chemin (jamais affiché, ni dans le control layer)
        fetch(etage.cheminUrl)
            .then(res => res.json())
            .then(data => {
                const features = [];
                const cheminLayer = L.geoJSON(data, {
                    style: function () {
                        // Déclinaison bleu HSL
                        return { color: getBaseColorByIndex(idx, ETAGES.length), weight: 3, fillColor: getBaseColorByIndex(idx, ETAGES.length) };
                    },
                    onEachFeature: (feature, layer) => {
                        features.push({ feature, layer });
                        // Impossible d'ajouter une classe CSS directement, on utilise le style
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
                    style: function () {
                        // Déclinaison bleu HSL
                        return { color: getBaseColorByIndex(idx, ETAGES.length), weight: 2, fillColor: getBaseColorByIndex(idx, ETAGES.length) };
                    },
                    onEachFeature: (feature, layer) => {
                        features.push({ feature, layer });
                        if (feature.properties && feature.properties.name) {
                            layer.bindPopup(feature.properties.name);
                        }
                        // Impossible d'ajouter une classe CSS directement, on utilise le style
                    }
                });
                batimentLayers[idx] = batLayer;
                batimentFeatures[idx] = features;
                layerControl.addBaseLayer(batLayer, etage.nom);
                if (idx === 0) {
                    batLayer.addTo(map);
                }
                loadedCount++;
                if (loadedCount === ETAGES.length && typeof onAllLoaded === 'function') {
                    onAllLoaded();
                }
            });
    });
}
