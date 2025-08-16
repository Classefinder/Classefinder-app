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
    let lastOriginalStyles = new Map();

    searchCtrlDepart.on('search:locationfound', function (e) {
        // Reset highlight précédent
        if (lastHighlightedLayers.length) {
            lastHighlightedLayers.forEach(l => {
                const orig = lastOriginalStyles.get(l);
                if (orig) l.setStyle(orig);
            });
            lastHighlightedLayers = [];
            lastOriginalStyles.clear();
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
                    // Stocke le style d'origine
                    if (!lastOriginalStyles.has(layer)) {
                        const orig = {
                            color: layer.options.color,
                            fillColor: layer.options.fillColor,
                            weight: layer.options.weight,
                            opacity: layer.options.opacity,
                            fillOpacity: layer.options.fillOpacity
                        };
                        lastOriginalStyles.set(layer, orig);
                    }
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
                lastHighlightedLayers.forEach(l => {
                    const orig = lastOriginalStyles.get(l);
                    if (orig) l.setStyle(orig);
                });
                lastHighlightedLayers = [];
                lastOriginalStyles.clear();
            }, 2000);
        }

        // --- Place a depart marker on the matching 'chemin' feature (same behaviour as clicking the feature) ---
        try {
            if (highlightFeatures.length > 0) {
                const target = highlightFeatures[0];
                const etageIdx = target.etageIdx;
                const name = target.feature.properties && target.feature.properties.name;
                if (name && cheminFeatures && Array.isArray(cheminFeatures[etageIdx])) {
                    const cheminObj = cheminFeatures[etageIdx].find(obj => obj.feature.properties.name === name);
                    if (cheminObj) {
                        let markerCoords = null;
                        if (cheminObj.feature.geometry.type === 'LineString') {
                            markerCoords = getLineCenter(cheminObj.feature.geometry.coordinates);
                        } else if (cheminObj.feature.geometry.type === 'Point') {
                            markerCoords = cheminObj.feature.geometry.coordinates.slice().reverse();
                        }
                        if (markerCoords) {
                            // ensure arrays exist
                            if (!window.departMarkerByEtage) window.departMarkerByEtage = [];
                            if (!Array.isArray(window.departMarkerByEtage)) window.departMarkerByEtage = [];
                            // remove existing markers
                            window.departMarkerByEtage.forEach((m, idx) => { if (m) map.removeLayer(m); window.departMarkerByEtage[idx] = null; });
                            const marker = L.marker(markerCoords, { icon: departIcon }).bindPopup('D\u00e9part : ' + name);
                            window.departMarkerByEtage[etageIdx] = marker;
                            if (batimentLayers[etageIdx] && map.hasLayer(batimentLayers[etageIdx])) {
                                marker.addTo(map).openPopup();
                            }
                            window.currentRouteStart = markerCoords;
                            window.currentRouteStartIdx = etageIdx;
                            if (window.currentRouteStart && window.currentRouteEnd && typeof getRouteAndPoints === 'function') {
                                getRouteAndPoints({
                                    map,
                                    start: window.currentRouteStart,
                                    end: window.currentRouteEnd,
                                    markers: [marker, window.arriveeMarkerByEtage && window.arriveeMarkerByEtage[window.currentRouteEndIdx]],
                                    layersEtages: batimentLayers,
                                    departIdx: window.currentRouteStartIdx,
                                    arriveeIdx: window.currentRouteEndIdx,
                                    ETAGES,
                                    batimentLayers,
                                    routeSegmentsByEtage: window.routeSegmentsByEtage,
                                    osrmUrl
                                });
                            }
                        }
                    }
                }
            }
        } catch (err) {
            // avoid breaking search flow if marker placement fails
            console.warn('Failed to place depart marker from search:', err);
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
            lastHighlightedLayers.forEach(l => {
                const orig = lastOriginalStyles.get(l);
                if (orig) l.setStyle(orig);
            });
            lastHighlightedLayers = [];
            lastOriginalStyles.clear();
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
                    // Stocke le style d'origine
                    if (!lastOriginalStyles.has(layer)) {
                        const orig = {
                            color: layer.options.color,
                            fillColor: layer.options.fillColor,
                            weight: layer.options.weight,
                            opacity: layer.options.opacity,
                            fillOpacity: layer.options.fillOpacity
                        };
                        lastOriginalStyles.set(layer, orig);
                    }
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
                lastHighlightedLayers.forEach(l => {
                    const orig = lastOriginalStyles.get(l);
                    if (orig) l.setStyle(orig);
                });
                lastHighlightedLayers = [];
                lastOriginalStyles.clear();
            }, 2000);
        }

        // --- Place an arrivee marker on the matching 'chemin' feature (same behaviour as clicking the feature) ---
        try {
            if (highlightFeatures.length > 0) {
                const target = highlightFeatures[0];
                const etageIdx = target.etageIdx;
                const name = target.feature.properties && target.feature.properties.name;
                if (name && cheminFeatures && Array.isArray(cheminFeatures[etageIdx])) {
                    const cheminObj = cheminFeatures[etageIdx].find(obj => obj.feature.properties.name === name);
                    if (cheminObj) {
                        let markerCoords = null;
                        if (cheminObj.feature.geometry.type === 'LineString') {
                            markerCoords = getLineCenter(cheminObj.feature.geometry.coordinates);
                        } else if (cheminObj.feature.geometry.type === 'Point') {
                            markerCoords = cheminObj.feature.geometry.coordinates.slice().reverse();
                        }
                        if (markerCoords) {
                            if (!window.arriveeMarkerByEtage) window.arriveeMarkerByEtage = [];
                            if (!Array.isArray(window.arriveeMarkerByEtage)) window.arriveeMarkerByEtage = [];
                            window.arriveeMarkerByEtage.forEach((m, idx) => { if (m) map.removeLayer(m); window.arriveeMarkerByEtage[idx] = null; });
                            const marker = L.marker(markerCoords, { icon: arriveeIcon }).bindPopup('Arriv\u00e9e : ' + name);
                            window.arriveeMarkerByEtage[etageIdx] = marker;
                            if (batimentLayers[etageIdx] && map.hasLayer(batimentLayers[etageIdx])) {
                                marker.addTo(map).openPopup();
                            }
                            window.currentRouteEnd = markerCoords;
                            window.currentRouteEndIdx = etageIdx;
                            if (window.currentRouteStart && window.currentRouteEnd && typeof getRouteAndPoints === 'function') {
                                getRouteAndPoints({
                                    map,
                                    start: window.currentRouteStart,
                                    end: window.currentRouteEnd,
                                    markers: [window.departMarkerByEtage && window.departMarkerByEtage[window.currentRouteStartIdx], marker],
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
                }
            }
        } catch (err) {
            console.warn('Failed to place arrivee marker from search:', err);
        }
    });
}