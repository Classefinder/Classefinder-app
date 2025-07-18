import { getLineCenter } from './geoUtils.js';

// Initialise et gère les barres de recherche pour départ et arrivée
export function setupSearchBars({
    map,
    batimentLayers,
    batimentFeatures,
    cheminFeatures,
    ETAGES,
    getRouteAndPoints
}) {
    let depart = null;
    let departEtageIdx = null;
    let arrivee = null;
    let arriveeEtageIdx = null;
    const allBatimentLayers = L.featureGroup(batimentLayers);
    const searchCtrlDepart = new L.Control.Search({
        layer: allBatimentLayers,
        propertyName: 'name',
        initial: false,
        collapsed: false,
        zoom: 16,
        marker: false,
        textPlaceholder: 'Départ...'
    });
    map.addControl(searchCtrlDepart);
    searchCtrlDepart.on('search:locationfound', function (e) {
        let etageIdx = -1;
        batimentFeatures.forEach((features, idx) => {
            features.forEach(obj => {
                if (obj.feature.properties.name === e.layer.feature.properties.name) {
                    etageIdx = idx;
                }
            });
        });
        if (etageIdx !== -1) {
            const cheminObj = cheminFeatures[etageIdx] && cheminFeatures[etageIdx].find(obj => obj.feature.properties.name === e.layer.feature.properties.name);
            if (cheminObj) {
                if (window.departMarker) map.removeLayer(window.departMarker);
                let markerCoords;
                if (cheminObj.feature.geometry.type === 'LineString') {
                    const coords = cheminObj.feature.geometry.coordinates;
                    markerCoords = getLineCenter(coords);
                } else if (cheminObj.feature.geometry.type === 'Point') {
                    markerCoords = cheminObj.feature.geometry.coordinates.slice().reverse();
                }
                if (markerCoords) {
                    if (window.departMarkerByEtage[etageIdx]) map.removeLayer(window.departMarkerByEtage[etageIdx]);
                    const marker = L.marker(markerCoords).bindPopup('Départ : ' + e.layer.feature.properties.name);
                    window.departMarkerByEtage[etageIdx] = marker;
                    if (batimentLayers[etageIdx] && map.hasLayer(batimentLayers[etageIdx])) {
                        marker.addTo(map).openPopup();
                    }
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
                            routeSegmentsByEtage: window.routeSegmentsByEtage
                        });
                    }
                }
            }
            if (!map.hasLayer(batimentLayers[etageIdx])) {
                batimentLayers.forEach(l => map.removeLayer(l));
                batimentLayers[etageIdx].addTo(map);
            }
            map.fitBounds(e.layer.getBounds());
        }
    });
    const searchCtrlArrivee = new L.Control.Search({
        layer: allBatimentLayers,
        propertyName: 'name',
        collapsed: false,
        initial: false,
        zoom: 16,
        marker: false,
        textPlaceholder: 'Arrivée...'
    });
    map.addControl(searchCtrlArrivee);
    searchCtrlArrivee.on('search:locationfound', function (e) {
        let etageIdx = -1;
        batimentFeatures.forEach((features, idx) => {
            features.forEach(obj => {
                if (obj.feature.properties.name === e.layer.feature.properties.name) {
                    etageIdx = idx;
                }
            });
        });
        if (etageIdx !== -1) {
            const cheminObj = cheminFeatures[etageIdx] && cheminFeatures[etageIdx].find(obj => obj.feature.properties.name === e.layer.feature.properties.name);
            if (cheminObj) {
                if (window.arriveeMarker) map.removeLayer(window.arriveeMarker);
                let markerCoords;
                if (cheminObj.feature.geometry.type === 'LineString') {
                    const coords = cheminObj.feature.geometry.coordinates;
                    markerCoords = getLineCenter(coords);
                } else if (cheminObj.feature.geometry.type === 'Point') {
                    markerCoords = cheminObj.feature.geometry.coordinates.slice().reverse();
                }
                if (markerCoords) {
                    if (window.arriveeMarkerByEtage[etageIdx]) map.removeLayer(window.arriveeMarkerByEtage[etageIdx]);
                    const marker = L.marker(markerCoords).bindPopup('Arrivée : ' + e.layer.feature.properties.name);
                    window.arriveeMarkerByEtage[etageIdx] = marker;
                    if (batimentLayers[etageIdx] && map.hasLayer(batimentLayers[etageIdx])) {
                        marker.addTo(map).openPopup();
                    }
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
                            routeSegmentsByEtage: window.routeSegmentsByEtage
                        });
                    }
                }
            }
            if (!map.hasLayer(batimentLayers[etageIdx])) {
                batimentLayers.forEach(l => map.removeLayer(l));
                batimentLayers[etageIdx].addTo(map);
            }
            map.fitBounds(e.layer.getBounds());
        }
        if (depart && arrivee) {
            getRouteAndPoints({
                map,
                start: depart,
                end: arrivee,
                markers: [window.departMarker, window.arriveeMarker],
                layersEtages: batimentLayers,
                departIdx: departEtageIdx,
                arriveeIdx: arriveeEtageIdx,
                ETAGES,
                batimentLayers,
                routeSegmentsByEtage: window.routeSegmentsByEtage
            });
        }
    });
}
