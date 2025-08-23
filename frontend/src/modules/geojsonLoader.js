import { getBaseColorByIndex } from './colors.js';
import { addFeatureClickHandler } from './geoFeatureInteraction.js';

// Ce module gère le chargement conditionnel des données geojson selon la localisation
// function getColorByIndex(idx, total, baseHue = 220, baseSat = 70, baseLight = 55) {
//     // Génère une couleur HSL en variant la teinte
//     const hue = (baseHue + (idx * (360 / total))) % 360;
//     return `hsl(${hue}, ${baseSat}%, ${baseLight}%)`;
// }

// Ajoute une classe CSS dynamique à chaque calque selon l'étage
export function loadGeojsonLayers({ ETAGES, batimentLayers, batimentFeatures, cheminFeatures, layerControl, map, onAllLoaded, getRouteAndPoints, BASE_HUE, BASE_SAT, BASE_LIGHT, blacklist }) {
    let loadedCount = 0;
    ETAGES.forEach((etage, idx) => {
        // Trace temporelle par étage
        const timerName = `geojson:etage:${etage.code}`;
        console.time(timerName);
        console.log(`[geojson] Start loading etage ${etage.code} (idx=${idx})`);

        // Calque chemin (jamais affiché, ni dans le control layer)
        fetch(etage.cheminUrl)
            .then(res => res.json())
            .then(data => {
                const features = [];
                const cheminLayer = L.geoJSON(data, {
                    pane: 'geojsonOverlay',
                    style: function () {
                        // Déclinaison bleu HSL
                        return { color: getBaseColorByIndex(idx, ETAGES.length, BASE_HUE, BASE_SAT, BASE_LIGHT), weight: 3, fillColor: getBaseColorByIndex(idx, ETAGES.length, BASE_HUE, BASE_SAT, BASE_LIGHT) };
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
                            getRouteAndPoints,
                            BASE_HUE,
                            BASE_SAT,
                            BASE_LIGHT,
                            blacklist
                        });
                        // Impossible d'ajouter une classe CSS directement, on utilise le style
                    }
                });
                cheminFeatures[idx] = features;
                console.timeLog(timerName, `[geojson] chemin for etage ${etage.code} fetched and parsed`);
            })
            .catch(e => {
                console.error(`[geojson] Failed to load chemin for etage ${etage.code}:`, e);
            });

        // Calque batiment (affiché dans le control layer)
        fetch(etage.batimentUrl)
            .then(res => res.json())
            .then(data => {
                const features = [];
                const batLayer = L.geoJSON(data, {
                    pane: 'geojsonOverlay',
                    style: function () {
                        // Déclinaison bleu HSL
                        return { color: getBaseColorByIndex(idx, ETAGES.length, BASE_HUE, BASE_SAT, BASE_LIGHT), weight: 2, fillColor: getBaseColorByIndex(idx, ETAGES.length, BASE_HUE, BASE_SAT, BASE_LIGHT) };
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
                            getRouteAndPoints,
                            BASE_HUE,
                            BASE_SAT,
                            BASE_LIGHT,
                            blacklist
                        });
                        // Impossible d'ajouter une classe CSS directement, on utilise le style
                    }
                });
                batimentLayers[idx] = batLayer;
                batimentFeatures[idx] = features;

                console.timeLog(timerName, `[geojson] batiment for etage ${etage.code} fetched and parsed`);

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

                    // Fin des timers par étage
                    ETAGES.forEach(e => {
                        const tn = `geojson:etage:${e.code}`;
                        try { console.timeEnd(tn); } catch (err) { }
                    });

                    if (typeof onAllLoaded === 'function') {
                        console.log('[geojson] All ETAGES processed, calling onAllLoaded');
                        onAllLoaded();
                    }
                }
            })
            .catch(e => {
                console.error(`[geojson] Failed to load batiment for etage ${etage.code}:`, e);
            });
    });
}
