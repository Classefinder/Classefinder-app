// Module pour gérer les labels des fonctionnalités GeoJSON

export function createLabel(feature, layer, map, LABEL_MIN_ZOOM, LABEL_MAX_ZOOM) {
    const label = L.divIcon({
        className: 'geojson-label',
        html: `<div>${feature.properties.name}</div>`,
        iconSize: null
    });

    const center = layer.getBounds().getCenter();
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
