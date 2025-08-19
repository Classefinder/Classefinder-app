// Module pour l'initialisation des couches et des fonctionnalités
import { loadGeojsonLayers } from './geojsonLoader.js';
import { setupSearchBars } from './searchBar.js';
import { setupLocationControl, addSetDepartButton, getCurrentUserPosition } from './location.js';
import { departIcon } from './icons.js';

export function setupMapFeatures({ map, ETAGES, perimeterCenter, perimeterRadius, getRouteAndPoints, osrmUrl, onLayersReady }) {
    const batimentLayers = [];
    const batimentFeatures = [];
    const cheminFeatures = [];

    const layerControl = L.control.layers(null, null, { collapsed: false }).addTo(map);

    let geojsonLoaded = false;
    let searchBarInitialized = false;
    let departButtonAdded = false;

    // Charge les geojson une seule fois et initialise searchbars / depart button
    function loadOnceWithParams(params) {
        if (geojsonLoaded) return;
        console.time('mapSetup:loadOnceWithParams');
        console.log('[mapSetup] loadOnceWithParams start');
        geojsonLoaded = true;
        // Ensure global arrays exist to avoid undefined errors elsewhere
        if (!window.departMarkerByEtage || !Array.isArray(window.departMarkerByEtage)) window.departMarkerByEtage = [];
        if (!window.arriveeMarkerByEtage || !Array.isArray(window.arriveeMarkerByEtage)) window.arriveeMarkerByEtage = [];
        if (!window.routeSegmentsByEtage || !Array.isArray(window.routeSegmentsByEtage)) window.routeSegmentsByEtage = [];
        loadGeojsonLayers({
            ETAGES: params.ETAGES || ETAGES,
            batimentLayers,
            batimentFeatures,
            cheminFeatures,
            layerControl,
            getRouteAndPoints: params.getRouteAndPoints || getRouteAndPoints,
            map,
            BASE_HUE: params.BASE_HUE,
            BASE_SAT: params.BASE_SAT,
            BASE_LIGHT: params.BASE_LIGHT,
            blacklist: params.blacklist,
            osrmUrl: params.osrmUrl || osrmUrl,
            onAllLoaded: () => {
                console.timeEnd('mapSetup:loadOnceWithParams');
                console.log('[mapSetup] loadOnceWithParams -> onAllLoaded');
                if (!searchBarInitialized) {
                    searchBarInitialized = true;
                    setupSearchBars({
                        map,
                        batimentLayers,
                        batimentFeatures,
                        cheminFeatures,
                        ETAGES: params.ETAGES || ETAGES,
                        getRouteAndPoints: params.getRouteAndPoints || getRouteAndPoints,
                        osrmUrl: params.osrmUrl || osrmUrl
                        ,
                        BASE_HUE: params.BASE_HUE,
                        BASE_SAT: params.BASE_SAT,
                        BASE_LIGHT: params.BASE_LIGHT
                    });
                }
                if (!departButtonAdded) {
                    departButtonAdded = true;
                    addSetDepartButton({
                        map,
                        getCurrentPosition: cb => getCurrentUserPosition(map, cb),
                        setDepartMarker: (latlng) => {
                            window.departMarkerByEtage.forEach((marker, idx) => {
                                if (marker) map.removeLayer(marker);
                                window.departMarkerByEtage[idx] = null;
                            });
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
                                        ETAGES: params.ETAGES || ETAGES,
                                        batimentLayers,
                                        routeSegmentsByEtage: window.routeSegmentsByEtage,
                                        osrmUrl: params.osrmUrl || osrmUrl
                                    });
                                }
                            }
                        }
                    });
                }

                batimentLayers.forEach((layer, idx) => {
                    if (idx === 0) {
                        if (!map.hasLayer(layer)) map.addLayer(layer);
                    } else {
                        if (map.hasLayer(layer)) map.removeLayer(layer);
                    }
                });

                const firstVisibleIdx = batimentLayers.findIndex(layer => map.hasLayer(layer));
                if (firstVisibleIdx !== -1) {
                    if (typeof onLayersReady === 'function') {
                        try { onLayersReady(firstVisibleIdx); } catch (e) { /* ignore */ }
                    }
                }
            }
        });
    }

    // Permet de recharger dynamiquement la configuration (ETAGES, périmètre, osrmUrl, couleurs, blacklist)
    function reloadConfig({ ETAGES: newETAGES, perimeterCenter: newCenter, perimeterRadius: newRadius, getRouteAndPoints: newGetRouteAndPoints, osrmUrl: newOsrmUrl, BASE_HUE, BASE_SAT, BASE_LIGHT, blacklist }) {
        // Retirer les anciens calques de la carte et du contrôle
        if (batimentLayers && batimentLayers.length) {
            batimentLayers.forEach(layer => {
                try { if (map.hasLayer(layer)) map.removeLayer(layer); } catch (e) { }
                try { layerControl.removeLayer(layer); } catch (e) { }
            });
        }
        // Réinitialiser les tableaux en place pour garder les références
        batimentLayers.length = 0;
        batimentFeatures.length = 0;
        cheminFeatures.length = 0;

        // Reset flags so UI elements can be re-initialized
        geojsonLoaded = false;
        searchBarInitialized = false;
        departButtonAdded = false;

        // Update perimeter circle/control (idempotent)
        try {
            // Preserve non-auto-centering behavior by default to avoid sudden recentering
            setupLocationControl({ map, config: { perimeterCenter: newCenter, perimeterRadius: newRadius }, perimeterCenter: newCenter, perimeterRadius: newRadius, allowAutoCenter: false });
        } catch (e) { /* ignore */ }

        // Charger immédiatement les geojson avec les nouveaux paramètres
        loadOnceWithParams({ ETAGES: newETAGES, getRouteAndPoints: newGetRouteAndPoints, osrmUrl: newOsrmUrl, BASE_HUE, BASE_SAT, BASE_LIGHT, blacklist });
        // If layers ready callback provided, try to call with first visible
        if (typeof onLayersReady === 'function') {
            const firstVisibleIdx = batimentLayers.findIndex(layer => map.hasLayer(layer));
            if (firstVisibleIdx !== -1) {
                try { onLayersReady(firstVisibleIdx); } catch (e) { /* ignore */ }
            }
        }
    }

    return { batimentLayers, batimentFeatures, cheminFeatures, layerControl, reloadConfig, loadOnceWithParams };
}