import { getLineCenter } from './geoUtils.js';
import { updateRouteDisplay } from './routeDisplay.js';
import { getRouteColorByIndex } from './colors.js';

// Réglages animation AntPath
const ANT_PATH_DELAY = 4000; // Vitesse (ms) - plus petit = plus rapide
const ANT_PATH_WEIGHT = 5;  // Épaisseur du trait

export function getRouteAndPoints({
    map,
    start,
    end,
    markers,
    layersEtages,
    departIdx,
    arriveeIdx,
    ETAGES,
    batimentLayers,
    routeSegmentsByEtage
}) {
    if (routeSegmentsByEtage) {
        routeSegmentsByEtage.forEach(segments => {
            if (segments) segments.forEach(l => map.removeLayer(l));
        });
    }
    for (let i = 0; i < layersEtages.length; i++) {
        routeSegmentsByEtage[i] = [];
    }
    var osrmUrl = `https://classefinder.duckdns.org/osrm/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?steps=true&geometries=geojson&overview=full`;
    fetch(osrmUrl)
        .then(response => response.json())
        .then(data => {
            if (data.routes && data.routes.length > 0) {
                var route = data.routes[0];
                route.legs[0].steps.forEach((step, index) => {
                    var startName = step.name || "";
                    var segment = {
                        type: "Feature",
                        geometry: {
                            type: "LineString",
                            coordinates: step.geometry.coordinates
                        },
                        properties: {
                            name: startName
                        }
                    };
                    for (let i = 0; i < layersEtages.length; i++) {
                        const codeEtage = ETAGES[i].code;
                        if (startName.includes(codeEtage)) {
                            // Utilisation d'AntPath si disponible, sinon fallback sur polyline classique
                            var coords = step.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
                            var seg = (L.polyline && L.polyline.antPath)
                                ? L.polyline.antPath(coords, {
                                    color: getRouteColorByIndex(i, layersEtages.length),
                                    weight: ANT_PATH_WEIGHT,
                                    delay: ANT_PATH_DELAY,
                                    dashArray: [10, 20],
                                    pulseColor: '#FFFFFF',
                                    paused: false,
                                    reverse: false
                                })
                                : L.polyline(coords, {
                                    color: getRouteColorByIndex(i, layersEtages.length),
                                    weight: ANT_PATH_WEIGHT
                                });
                            routeSegmentsByEtage[i].push(seg);
                        }
                    }
                });
                const currentIdx = batimentLayers.findIndex(l => map.hasLayer(l));
                updateRouteDisplay(map, routeSegmentsByEtage, window.departMarkerByEtage, window.arriveeMarkerByEtage, currentIdx !== -1 ? currentIdx : departIdx);
                map.fitBounds(L.latLngBounds([start, end]));
            } else {
                console.error('Aucune route trouvée');
            }
        })
        .catch(error => {
            console.error('Erreur lors de la récupération de l\'itinéraire:', error);
        });
}
