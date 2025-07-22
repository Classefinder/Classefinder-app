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
                // Découper l'itinéraire en séquences consécutives d'étage
                let sequences = [];
                let currentEtageIdx = null;
                let currentSeq = [];
                route.legs[0].steps.forEach((step, idx) => {
                    var startName = step.name || "";
                    let etageIdx = -1;
                    for (let i = 0; i < layersEtages.length; i++) {
                        if (startName.includes(ETAGES[i].code)) {
                            etageIdx = i;
                            break;
                        }
                    }
                    let stepCoords = step.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
                    if (etageIdx !== currentEtageIdx) {
                        if (currentSeq.length > 1 && currentEtageIdx !== null) {
                            sequences.push({ etageIdx: currentEtageIdx, coords: currentSeq });
                        }
                        currentEtageIdx = etageIdx;
                        currentSeq = [];
                    }
                    // Pour éviter les doublons de points
                    if (currentSeq.length > 0) stepCoords = stepCoords.slice(1);
                    currentSeq.push(...stepCoords);
                });
                if (currentSeq.length > 1 && currentEtageIdx !== null) {
                    sequences.push({ etageIdx: currentEtageIdx, coords: currentSeq });
                }

                // Vide les segments précédents
                for (let i = 0; i < layersEtages.length; i++) routeSegmentsByEtage[i] = [];

                // Animation par étage, uniquement sur le layer actif
                window.routeAnimationState = window.routeAnimationState || {};
                // Trouver l'étage actif
                const currentEtageActiveIdx = batimentLayers.findIndex(l => map.hasLayer(l));
                // Fonction d'animation d'une séquence d'étage
                function animateEtage(etageIdx) {
                    const seq = sequences.find(s => s.etageIdx === etageIdx);
                    if (!seq || !seq.coords || seq.coords.length < 2) return;
                    // Toujours retirer les segments existants de l'étage courant
                    if (routeSegmentsByEtage[etageIdx]) {
                        routeSegmentsByEtage[etageIdx].forEach(seg => map.removeLayer(seg));
                        routeSegmentsByEtage[etageIdx] = [];
                    }
                    // Toujours rejouer l'animation, même si déjà animée
                    window.routeAnimationState[etageIdx] = false;
                    var seg = window.L.polyline([seq.coords[0]], {
                        color: getRouteColorByIndex(etageIdx, layersEtages.length),
                        weight: ANT_PATH_WEIGHT
                    });
                    seg.addTo(map);
                    let idx = 1;
                    const totalDuration = 1500; // 10s pour tout le trajet
                    const drawSpeed = totalDuration / seq.coords.length;
                    const interval = setInterval(() => {
                        if (idx < seq.coords.length) {
                            seg.addLatLng(seq.coords[idx]);
                            idx++;
                        } else {
                            clearInterval(interval);
                            window.routeAnimationState[etageIdx] = true;
                        }
                    }, drawSpeed);
                    routeSegmentsByEtage[etageIdx].push(seg);
                }
                // Anime uniquement l'étage actif au départ
                animateEtage(currentEtageActiveIdx !== -1 ? currentEtageActiveIdx : 0);
                // Ajoute un listener pour animer les autres étages à la demande
                if (!window._routeLayerChangeListener) {
                    window._routeLayerChangeListener = true;
                    map.on('baselayerchange', function (e) {
                        const idx = batimentLayers.findIndex(l => l === e.layer);
                        if (idx !== -1) {
                            animateEtage(idx);
                        }
                    });
                }
                const currentIdx = batimentLayers.findIndex(l => map.hasLayer(l));
                updateRouteDisplay(map, routeSegmentsByEtage, window.departMarkerByEtage, window.arriveeMarkerByEtage, currentEtageActiveIdx !== -1 ? currentEtageActiveIdx : departIdx);
                map.fitBounds(L.latLngBounds([start, end]));
            } else {
                console.error('Aucune route trouvée');
            }
        })
        .catch(error => {
            console.error('Erreur lors de la récupération de l\'itinéraire:', error);
        });
}
