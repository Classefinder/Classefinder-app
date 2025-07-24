import { getBaseColorByIndex } from './colors.js';
import { addFeatureClickHandler } from './geoFeatureInteraction.js';

// Ce module gère le chargement conditionnel des données geojson selon la localisation
// function getColorByIndex(idx, total, baseHue = 220, baseSat = 70, baseLight = 55) {
//     // Génère une couleur HSL en variant la teinte
//     const hue = (baseHue + (idx * (360 / total))) % 360;
//     return `hsl(${hue}, ${baseSat}%, ${baseLight}%)`;
// }

// Ajoute une classe CSS dynamique à chaque calque selon l'étage
export function loadGeojsonLayers({ ETAGES, batimentLayers, batimentFeatures, cheminFeatures, layerControl, map, onAllLoaded, getRouteAndPoints }) {
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
                        // Ajoute le gestionnaire de clic pour le zoom et les boutons
                        addFeatureClickHandler(feature, layer, map, {
                            etageIdx: idx,
                            batimentFeatures,
                            cheminFeatures,
                            batimentLayers,
                            ETAGES,
                            getRouteAndPoints
                        });
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
                        // Ajoute le gestionnaire de clic pour le zoom et les boutons
                        addFeatureClickHandler(feature, layer, map, {
                            etageIdx: idx,
                            batimentFeatures,
                            cheminFeatures,
                            batimentLayers,
                            ETAGES,
                            getRouteAndPoints
                        });
                        // Impossible d'ajouter une classe CSS directement, on utilise le style
                    }
                });
                batimentLayers[idx] = batLayer;
                batimentFeatures[idx] = features;

                // On attend que tous les calques soient chargés avant de les ajouter au contrôle
                loadedCount++;
                if (loadedCount === ETAGES.length) {
                    // Trier les calques selon le code d'étage (ordre décroissant)
                    const sortedLayers = ETAGES.map((etage, i) => ({
                        layer: batimentLayers[i],
                        nom: etage.nom,
                        code: etage.code
                    })).sort((a, b) => parseInt(b.code) - parseInt(a.code));

                    // Ajouter les calques dans l'ordre trié
                    sortedLayers.forEach((item, i) => {
                        layerControl.addBaseLayer(item.layer, item.nom);
                        if (i === 0) {
                            item.layer.addTo(map);
                        }
                    });

                    if (typeof onAllLoaded === 'function') {
                        onAllLoaded();
                    }
                }
            });
    });
}
