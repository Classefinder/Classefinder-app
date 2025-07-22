import { getLineCenter } from './geoUtils.js';
import { updateRouteDisplay } from './routeDisplay.js';
import { getRouteColorByIndex } from './colors.js';

// Réglages animation AntPath
const ANT_PATH_DELAY = 4000; // Vitesse (ms) - plus petit = plus rapide
const ANT_PATH_WEIGHT = 5;  // Épaisseur du trait

// Variable globale pour suivre tous les segments de route
window.allRouteSegments = window.allRouteSegments || [];

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
    // 1. NETTOYAGE GLOBAL - Supprime TOUS les segments existants
    window.allRouteSegments.forEach(seg => {
        if (seg && map.hasLayer(seg)) {
            map.removeLayer(seg);
        }
    });
    window.allRouteSegments = []; // Réinitialise la liste

    // 2. Réinitialise les segments par étage
    if (routeSegmentsByEtage) {
        for (let i = 0; i < layersEtages.length; i++) {
            routeSegmentsByEtage[i] = [];
        }
    }

    // 3. Gestion de l'écouteur - Supprime l'ancien s'il existe
    if (window._routeLayerChangeFunction) {
        map.off('baselayerchange', window._routeLayerChangeFunction);
        window._routeLayerChangeFunction = null;
    }

    // Réinitialiser l'état d'animation
    window.routeAnimationState = {};

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

                // Animation par étage : on prépare tous les segments, mais on n'affiche que sur le layer actif
                window.routeAnimationState = window.routeAnimationState || {};
                const currentEtageActiveIdx = batimentLayers.findIndex(l => map.hasLayer(l));

                function animateEtage(etageIdx) {
                    const seq = sequences.find(s => s.etageIdx === etageIdx);
                    if (!seq || !seq.coords || seq.coords.length < 2) return;

                    // Toujours retirer les segments existants de l'étage courant
                    if (routeSegmentsByEtage[etageIdx]) {
                        routeSegmentsByEtage[etageIdx].forEach(seg => {
                            if (seg && map.hasLayer(seg)) map.removeLayer(seg);
                        });
                        routeSegmentsByEtage[etageIdx] = [];
                    }

                    window.routeAnimationState[etageIdx] = false;

                    // N'affiche le segment que si le layer est actif
                    if (map.hasLayer(batimentLayers[etageIdx])) {
                        var seg = window.L.polyline([seq.coords[0]], {
                            color: getRouteColorByIndex(etageIdx, layersEtages.length),
                            weight: ANT_PATH_WEIGHT
                        });
                        seg.addTo(map);
                        let idx = 1;
                        const totalDuration = 1500;
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

                        // Ajouter le segment à la liste par étage et à la liste globale
                        routeSegmentsByEtage[etageIdx].push(seg);
                        window.allRouteSegments.push(seg);
                    }
                }

                // Anime tous les étages concernés (prépare les segments, mais n'affiche que sur le layer actif)
                sequences.forEach(seq => animateEtage(seq.etageIdx));

                // 4. NOUVEL ÉCOUTEUR avec closure actuelle
                window._routeLayerChangeFunction = function (e) {
                    const idx = batimentLayers.findIndex(l => l === e.layer);
                    if (idx !== -1) {
                        // Nettoie seulement les segments actuels de l'étage
                        if (routeSegmentsByEtage[idx]) {
                            routeSegmentsByEtage[idx].forEach(seg => {
                                if (seg && map.hasLayer(seg)) map.removeLayer(seg);
                            });
                            routeSegmentsByEtage[idx] = [];
                        }
                        // Réanime si nécessaire
                        const seq = sequences.find(s => s.etageIdx === idx);
                        if (seq) animateEtage(idx);
                    }
                };

                // Installe le nouvel écouteur
                map.on('baselayerchange', window._routeLayerChangeFunction);

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