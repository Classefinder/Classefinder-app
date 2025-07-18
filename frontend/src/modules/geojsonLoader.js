// Ce module gère le chargement conditionnel des données geojson selon la localisation
export function loadGeojsonLayers({ ETAGES, batimentLayers, batimentFeatures, cheminFeatures, layerControl, map, onAllLoaded }) {
    let loadedCount = 0;
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
