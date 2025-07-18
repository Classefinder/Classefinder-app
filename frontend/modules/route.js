import { getLineCenter } from './geoUtils.js';
import { updateRouteDisplay } from './routeDisplay.js';

// Fonction pour récupérer et filtrer les segments d'itinéraire
function getColorByIndex(idx, total, baseHue = 150, baseSat = 70, baseLight = 55) {
    // Génère une couleur HSL en variant la teinte
    const hue = (baseHue + (idx * (360 / total))) % 360;
    return `hsl(${hue}, ${baseSat}%, ${baseLight}%)`;
}

function getRedShadeByIndex(idx, total, baseLight = 40) {
    // Déclinaison rouge HSL, teinte 0, saturation 80%, luminosité variable
    return `hsl(0, 80%, ${baseLight + idx * Math.floor(40 / Math.max(1, total - 1))}%)`;
}

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
                            // Utilisation d'AntPath pour l'animation
                            var seg = new L.antPath(
                                step.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
                                {
                                    color: getRedShadeByIndex(i, layersEtages.length, 40),
                                    weight: 5,
                                    delay: 400,
                                    dashArray: [10, 20],
                                    pulseColor: '#FFFFFF',
                                    paused: false,
                                    reverse: false
                                }
                            );
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
