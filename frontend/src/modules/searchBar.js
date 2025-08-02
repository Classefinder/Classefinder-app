import { getLineCenter } from './geoUtils.js';
import { departIcon, arriveeIcon } from './icons.js';

export function setupSearchBars({
    map,
    batimentLayers,
    batimentFeatures,
    cheminFeatures,
    ETAGES,
    getRouteAndPoints,
    osrmUrl
}) {
    let depart = null;
    let departEtageIdx = null;
    let arrivee = null;
    let arriveeEtageIdx = null;
    const allBatimentLayers = L.featureGroup(batimentLayers);

    // Search control for depart
    const searchCtrlDepart = new L.Control.Search({
        layer: allBatimentLayers,
        propertyName: 'name',
        initial: false,
        collapsed: false,
        zoom: false,
        marker: false,
        textPlaceholder: 'Départ...',
        id: 'search-control-start',
        className: 'search-control-start'
    });
    map.addControl(searchCtrlDepart);

    setTimeout(() => {
        const searchStart = document.querySelectorAll('.leaflet-control-search');
        if (searchStart && searchStart.length > 0) {
            searchStart[0].id = 'search-control-start';
            searchStart[0].classList.add('search-control-start');
        }
    }, 100);

    // Couleur de surlignage (doit être cohérente avec geoFeatureInteraction.js)
    const hoverColor = 'hsl(120, 100%, 45%)'; // Vert vif
    let lastHighlightedLayers = [];

    searchCtrlDepart.on('search:locationfound', function (e) {
        // Reset highlight précédent
        if (lastHighlightedLayers.length) {
            lastHighlightedLayers.forEach(l => l.setStyle({ color: '', fillColor: '' }));
            lastHighlightedLayers = [];
        }
        // Recherche sur l'étage actif
        const toHighlight = [];
        const highlightFeatures = [];
        let activeEtageIdx = null;
        batimentLayers.forEach((layer, idx) => {
            if (map.hasLayer(layer)) activeEtageIdx = idx;
        });
        batimentFeatures.forEach((features, idx) => {
            if (idx === activeEtageIdx) {
                features.forEach(obj => {
                    if (obj.feature.properties.name === e.layer.feature.properties.name) {
                        highlightFeatures.push({ feature: obj.feature, etageIdx: idx, layer: obj.layer });
                    }
                });
            }
        });
        // Si rien sur l'étage actif, cherche sur les autres étages
        if (highlightFeatures.length === 0) {
            batimentFeatures.forEach((features, idx) => {
                if (idx !== activeEtageIdx) {
                    features.forEach(obj => {
                        if (obj.feature.properties.name === e.layer.feature.properties.name) {
                            highlightFeatures.push({ feature: obj.feature, etageIdx: idx, layer: obj.layer });
                        }
                    });
                }
            });
            // Si trouvé ailleurs, bascule sur le bon calque
            if (highlightFeatures.length > 0) {
                const etageCible = highlightFeatures[0].etageIdx;
                if (!map.hasLayer(batimentLayers[etageCible])) {
                    batimentLayers.forEach(l => map.removeLayer(l));
                    batimentLayers[etageCible].addTo(map);
                }
            }
        }
        // Highlight et zoom sur les résultats trouvés (après éventuel changement de calque)
        if (highlightFeatures.length > 0) {
            highlightFeatures.forEach(({ layer }) => {
                if (layer && layer.setStyle) {
                    layer.setStyle({ color: hoverColor, fillColor: hoverColor });
                    toHighlight.push(layer);
                }
            });
            lastHighlightedLayers = toHighlight;
        }
        if (highlightFeatures.length > 1) {
            const bounds = L.latLngBounds();
            highlightFeatures.forEach(({ layer }) => {
                if (layer && layer.getBounds) {
                    bounds.extend(layer.getBounds());
                }
            });
            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [30, 30], maxZoom: 20 });
            }
        } else if (highlightFeatures.length === 1) {
            const { layer } = highlightFeatures[0];
            if (layer && layer.getBounds) {
                map.fitBounds(layer.getBounds());
            }
        }
        // Optionnel : retirer le highlight après 2 secondes
        if (lastHighlightedLayers.length) {
            setTimeout(() => {
                lastHighlightedLayers.forEach(l => l.setStyle({ color: '', fillColor: '' }));
                lastHighlightedLayers = [];
            }, 2000);
        }
    });

    // Search control for arrivee
    const searchCtrlArrivee = new L.Control.Search({
        layer: allBatimentLayers,
        propertyName: 'name',
        collapsed: false,
        initial: false,
        zoom: false,
        marker: false,
        textPlaceholder: 'Arrivée...',
        id: 'search-control-end',
        className: 'search-control-end'
    });
    map.addControl(searchCtrlArrivee);

    setTimeout(() => {
        const searchEnd = document.querySelectorAll('.leaflet-control-search');
        if (searchEnd && searchEnd.length > 1) {
            searchEnd[1].id = 'search-control-end';
            searchEnd[1].classList.add('search-control-end');
        }
    }, 100);

    searchCtrlArrivee.on('search:locationfound', function (e) {
        // Reset highlight précédent
        if (lastHighlightedLayers.length) {
            lastHighlightedLayers.forEach(l => l.setStyle({ color: '', fillColor: '' }));
            lastHighlightedLayers = [];
        }
        // Recherche sur l'étage actif
        const toHighlight = [];
        const highlightFeatures = [];
        let activeEtageIdx = null;
        batimentLayers.forEach((layer, idx) => {
            if (map.hasLayer(layer)) activeEtageIdx = idx;
        });
        batimentFeatures.forEach((features, idx) => {
            if (idx === activeEtageIdx) {
                features.forEach(obj => {
                    if (obj.feature.properties.name === e.layer.feature.properties.name) {
                        highlightFeatures.push({ feature: obj.feature, etageIdx: idx, layer: obj.layer });
                    }
                });
            }
        });
        // Si rien sur l'étage actif, cherche sur les autres étages
        if (highlightFeatures.length === 0) {
            batimentFeatures.forEach((features, idx) => {
                if (idx !== activeEtageIdx) {
                    features.forEach(obj => {
                        if (obj.feature.properties.name === e.layer.feature.properties.name) {
                            highlightFeatures.push({ feature: obj.feature, etageIdx: idx, layer: obj.layer });
                        }
                    });
                }
            });
            // Si trouvé ailleurs, bascule sur le bon calque
            if (highlightFeatures.length > 0) {
                const etageCible = highlightFeatures[0].etageIdx;
                if (!map.hasLayer(batimentLayers[etageCible])) {
                    batimentLayers.forEach(l => map.removeLayer(l));
                    batimentLayers[etageCible].addTo(map);
                }
            }
        }
        // Highlight et zoom sur les résultats trouvés (après éventuel changement de calque)
        if (highlightFeatures.length > 0) {
            highlightFeatures.forEach(({ layer }) => {
                if (layer && layer.setStyle) {
                    layer.setStyle({ color: hoverColor, fillColor: hoverColor });
                    toHighlight.push(layer);
                }
            });
            lastHighlightedLayers = toHighlight;
        }
        if (highlightFeatures.length > 1) {
            const bounds = L.latLngBounds();
            highlightFeatures.forEach(({ layer }) => {
                if (layer && layer.getBounds) {
                    bounds.extend(layer.getBounds());
                }
            });
            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [30, 30], maxZoom: 20 });
            }
        } else if (highlightFeatures.length === 1) {
            const { layer } = highlightFeatures[0];
            if (layer && layer.getBounds) {
                map.fitBounds(layer.getBounds());
            }
        }
        // Optionnel : retirer le highlight après 2 secondes
        if (lastHighlightedLayers.length) {
            setTimeout(() => {
                lastHighlightedLayers.forEach(l => l.setStyle({ color: '', fillColor: '' }));
                lastHighlightedLayers = [];
            }, 2000);
        }
    });
}