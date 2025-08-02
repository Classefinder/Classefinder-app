// Module pour gérer les labels des fonctionnalités GeoJSON

export function createLabel(feature, layer, map, LABEL_MIN_ZOOM, LABEL_MAX_ZOOM) {
    // N'affiche jamais de label si le nom est vide ou absent
    if (!feature.properties || !feature.properties.name || feature.properties.name.trim() === "") {
        return null;
    }


    const label = L.divIcon({
        className: 'geojson-label',
        html: `<div>${feature.properties.name}</div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0]
    });

    // Calcul du centre selon le type de géométrie
    let center;
    if (feature.geometry && feature.geometry.type === 'Point') {
        // Pour un point, on prend directement les coordonnées
        const coords = feature.geometry.coordinates;
        center = L.latLng(coords[1], coords[0]);
    } else if (feature.geometry && feature.geometry.type === 'LineString') {
        // Pour une ligne, on prend le point du milieu
        const coords = feature.geometry.coordinates;
        const midIdx = Math.floor(coords.length / 2);
        center = L.latLng(coords[midIdx][1], coords[midIdx][0]);
    } else {
        // Pour un polygone ou autre, on garde le centre des bounds
        center = layer.getBounds().getCenter();
    }

    const labelMarker = L.marker(center, {
        icon: label,
        interactive: false,
        zIndexOffset: 1000
    });

    function updateLabelVisibility() {
        const currentZoom = map.getZoom();
        const isLayerVisible = map.hasLayer(layer);

        if (currentZoom >= LABEL_MIN_ZOOM && currentZoom <= LABEL_MAX_ZOOM && isLayerVisible) {
            if (!map.hasLayer(labelMarker)) {
                labelMarker.addTo(map);
            }
        } else {
            if (map.hasLayer(labelMarker)) {
                map.removeLayer(labelMarker);
            }
        }
    }

    map.on('zoomend', updateLabelVisibility);
    map.on('layeradd layerremove', function (e) {
        if (e.layer === layer) {
            updateLabelVisibility();
        }
    });

    return labelMarker;
}
