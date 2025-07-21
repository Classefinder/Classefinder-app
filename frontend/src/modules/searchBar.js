// Suppression de l'import inutile de Leaflet (L est global)
// import L from 'leaflet';
import { getLineCenter } from './geoUtils.js';

// Icônes personnalisés pour les marqueurs de départ et d'arrivée
const departIcon = L.icon({
    iconUrl: "/images/start-icon.svg",
    iconSize: [15, 15], // size of the icon
    iconAnchor: [7.5, 7.5], // point of the icon which will correspond to marker's location
    popupAnchor: [0, -10], // point from which the popup should open relative to the iconAnchor
});
const arriveeIcon = L.icon({
    iconUrl: '/images/end-icon.svg',
    iconSize: [15, 15], // size of the icon
    iconAnchor: [7.5, 7.5], // point of the icon which will correspond to marker's location
    popupAnchor: [0, -10], // point from which the popup should open relative
});

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
        textPlaceholder: 'Départ...',
        id: 'search-control-start', // Ajout de l'id
        className: 'search-control-start' // Ajout de la classe
    });
    map.addControl(searchCtrlDepart);
    // Correction : Ajout manuel de l'id et de la classe après insertion dans le DOM
    setTimeout(() => {
        const searchStart = document.querySelectorAll('.leaflet-control-search');
        if (searchStart && searchStart.length > 0) {
            searchStart[0].id = 'search-control-start';
            searchStart[0].classList.add('search-control-start');
        }
    }, 100);
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
                    // Supprime tous les anciens marqueurs de départ sur tous les étages
                    window.departMarkerByEtage.forEach((marker, idx) => {
                        if (marker) map.removeLayer(marker);
                        window.departMarkerByEtage[idx] = null;
                    });
                    const marker = L.marker(markerCoords, { icon: departIcon }).bindPopup('Départ : ' + e.layer.feature.properties.name);
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
        textPlaceholder: 'Arrivée...',
        id: 'search-control-end', // Ajout de l'id
        className: 'search-control-end' // Ajout de la classe
    });
    map.addControl(searchCtrlArrivee);
    // Correction : Ajout manuel de l'id et de la classe après insertion dans le DOM
    setTimeout(() => {
        const searchEnd = document.querySelectorAll('.leaflet-control-search');
        if (searchEnd && searchEnd.length > 1) {
            searchEnd[1].id = 'search-control-end';
            searchEnd[1].classList.add('search-control-end');
        }
    }, 100);
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
                // Supprime tous les anciens marqueurs d'arrivée sur tous les étages
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
