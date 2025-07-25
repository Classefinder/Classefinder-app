// Module pour l'initialisation des couches et des fonctionnalités
import { loadGeojsonLayers } from './geojsonLoader.js';
import { setupSearchBars } from './searchBar.js';
import { addSetDepartButton, getCurrentUserPosition } from './location.js';

export function setupMapFeatures({ map, ETAGES, perimeterCenter, perimeterRadius, getRouteAndPoints }) {
    const batimentLayers = [];
    const batimentFeatures = [];
    const cheminFeatures = [];

    const layerControl = L.control.layers(null, null, { collapsed: false }).addTo(map);

    let geojsonLoaded = false;
    let searchBarInitialized = false;
    let departButtonAdded = false;

    document.addEventListener('DOMContentLoaded', () => {
        setupLocationControl({
            map,
            perimeterCenter,
            perimeterRadius,
            onInside: (e, perimeterCircle) => {
                map.removeLayer(perimeterCircle);
                if (!geojsonLoaded) {
                    geojsonLoaded = true;
                    loadGeojsonLayers({
                        ETAGES,
                        batimentLayers,
                        batimentFeatures,
                        cheminFeatures,
                        layerControl,
                        getRouteAndPoints,
                        map,
                        onAllLoaded: () => {
                            if (!searchBarInitialized) {
                                searchBarInitialized = true;
                                setupSearchBars({
                                    map,
                                    batimentLayers,
                                    batimentFeatures,
                                    cheminFeatures,
                                    ETAGES,
                                    getRouteAndPoints
                                });
                            }
                            if (!departButtonAdded) {
                                departButtonAdded = true;
                                addSetDepartButton({
                                    map,
                                    getCurrentPosition: cb => getCurrentUserPosition(map, cb),
                                    setDepartMarker: (latlng) => {
                                        // Supprime tous les anciens marqueurs de départ sur tous les étages
                                        window.departMarkerByEtage.forEach((marker, idx) => {
                                            if (marker) map.removeLayer(marker);
                                            window.departMarkerByEtage[idx] = null;
                                        });
                                        // Place le marqueur de départ sur l'étage courant
                                        const currentIdx = batimentLayers.findIndex(l => map.hasLayer(l));
                                        if (currentIdx !== -1) {
                                            const marker = L.marker(latlng, { icon: departIcon, className: 'start-marker' }).bindPopup('Départ : Ma position');
                                            window.departMarkerByEtage[currentIdx] = marker;
                                            marker.addTo(map).openPopup();
                                            window.currentRouteStart = [latlng.lat, latlng.lng];
                                            window.currentRouteStartIdx = currentIdx;
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
                                                });
                                            }
                                        }
                                    }
                                });
                            }
                        }
                    });
                }
            }
        });
    });

    return { batimentLayers, batimentFeatures, cheminFeatures, layerControl };
}
