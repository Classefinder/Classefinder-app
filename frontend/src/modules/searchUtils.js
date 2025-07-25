// Module pour les utilitaires de recherche

export function handleSearchLocationFound(e, map, batimentFeatures, cheminFeatures, batimentLayers, getRouteAndPoints, departIcon, arriveeIcon, isDepart = true) {
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
            if (!map.hasLayer(batimentLayers[etageIdx])) {
                batimentLayers.forEach(l => map.removeLayer(l));
                batimentLayers[etageIdx].addTo(map);
            }

            let markerCoords;

            if (cheminObj.feature.geometry.type === 'LineString') {
                const coords = cheminObj.feature.geometry.coordinates;
                markerCoords = getLineCenter(coords);
            } else if (cheminObj.feature.geometry.type === 'Point') {
                markerCoords = cheminObj.feature.geometry.coordinates.slice().reverse();
            }

            if (markerCoords) {
                const marker = L.marker(markerCoords, { icon: isDepart ? departIcon : arriveeIcon }).bindPopup((isDepart ? 'Départ' : 'Arrivée') + ' : ' + feature.properties.name);
                marker.addTo(map).openPopup();

                if (isDepart) {
                    window.currentRouteStart = markerCoords;
                    window.currentRouteStartIdx = etageIdx;
                } else {
                    window.currentRouteEnd = markerCoords;
                    window.currentRouteEndIdx = etageIdx;
                }

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
        map.fitBounds(e.layer.getBounds());
    }
}
