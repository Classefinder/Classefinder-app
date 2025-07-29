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

    searchCtrlDepart.on('search:locationfound', function (e) {
        const matchingFeatures = [];
        batimentFeatures.forEach((features, idx) => {
            features.forEach(obj => {
                if (obj.feature.properties.name === e.layer.feature.properties.name) {
                    matchingFeatures.push({ feature: obj.feature, etageIdx: idx });
                }
            });
        });

        if (matchingFeatures.length > 1) {
            const bounds = L.latLngBounds();
            matchingFeatures.forEach(({ feature, etageIdx }) => {
                const layerBounds = batimentLayers[etageIdx].getBounds();
                bounds.extend(layerBounds);
            });
            map.fitBounds(bounds, { padding: [30, 30], maxZoom: 20 });
        } else if (matchingFeatures.length === 1) {
            const { feature, etageIdx } = matchingFeatures[0];
            const cheminObj = cheminFeatures[etageIdx] && cheminFeatures[etageIdx].find(obj => obj.feature.properties.name === feature.properties.name);

            if (cheminObj) {
                // Activer le bon calque avant tout traitement
                if (!map.hasLayer(batimentLayers[etageIdx])) {
                    batimentLayers.forEach(l => map.removeLayer(l));
                    batimentLayers[etageIdx].addTo(map);
                }

                if (window.departMarker) map.removeLayer(window.departMarker);
                let markerCoords;

                if (cheminObj.feature.geometry.type === 'LineString') {
                    const coords = cheminObj.feature.geometry.coordinates;
                    markerCoords = getLineCenter(coords);
                } else if (cheminObj.feature.geometry.type === 'Point') {
                    markerCoords = cheminObj.feature.geometry.coordinates.slice().reverse();
                }

                if (markerCoords) {
                    window.departMarkerByEtage.forEach((marker, idx) => {
                        if (marker) map.removeLayer(marker);
                        window.departMarkerByEtage[idx] = null;
                    });

                    const marker = L.marker(markerCoords, { icon: departIcon }).bindPopup('Départ : ' + feature.properties.name);
                    window.departMarkerByEtage[etageIdx] = marker;
                    marker.addTo(map).openPopup();

                    window.currentRouteStart = markerCoords;
                    window.currentRouteStartIdx = etageIdx;

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
                            routeSegmentsByEtage: window.routeSegmentsByEtage,
                            osrmUrl
                        });
                    }
                }
            }
            map.fitBounds(e.layer.getBounds());
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
        const matchingFeatures = [];
        batimentFeatures.forEach((features, idx) => {
            features.forEach(obj => {
                if (obj.feature.properties.name === e.layer.feature.properties.name) {
                    matchingFeatures.push({ feature: obj.feature, etageIdx: idx });
                }
            });
        });

        if (matchingFeatures.length > 1) {
            const bounds = L.latLngBounds();
            matchingFeatures.forEach(({ feature, etageIdx }) => {
                const layerBounds = batimentLayers[etageIdx].getBounds();
                bounds.extend(layerBounds);
            });
            map.fitBounds(bounds, { padding: [30, 30], maxZoom: 20 });
        } else if (matchingFeatures.length === 1) {
            const { feature, etageIdx } = matchingFeatures[0];
            const cheminObj = cheminFeatures[etageIdx] && cheminFeatures[etageIdx].find(obj => obj.feature.properties.name === feature.properties.name);

            if (cheminObj) {
                // Activer le bon calque avant tout traitement
                if (!map.hasLayer(batimentLayers[etageIdx])) {
                    batimentLayers.forEach(l => map.removeLayer(l));
                    batimentLayers[etageIdx].addTo(map);
                }

                window.arriveeMarkerByEtage.forEach((marker, idx) => {
                    if (marker) map.removeLayer(marker);
                    window.arriveeMarkerByEtage[idx] = null;
                });

                let markerCoords;
                if (cheminObj.feature.geometry.type === 'LineString') {
                    const coords = cheminObj.feature.geometry.coordinates;
                    markerCoords = getLineCenter(coords);
                } else if (cheminObj.feature.geometry.type === 'Point') {
                    markerCoords = cheminObj.feature.geometry.coordinates.slice().reverse();
                }

                if (markerCoords) {
                    const marker = L.marker(markerCoords, { icon: arriveeIcon }).bindPopup('Arrivée : ' + e.layer.feature.properties.name);
                    window.arriveeMarkerByEtage[etageIdx] = marker;
                    marker.addTo(map).openPopup();

                    window.currentRouteEnd = markerCoords;
                    window.currentRouteEndIdx = etageIdx;

                    if (window.currentRouteStart && window.currentRouteEnd) {
                        getRouteAndPoints({
                            map,
                            start: window.currentRouteStart,
                            end: window.currentRouteEnd,
                            markers: [window.departMarkerByEtage[window.currentRouteStartIdx], marker],
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
            map.fitBounds(e.layer.getBounds());
        }
    });
}