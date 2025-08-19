import { getLineCenter } from './geoUtils.js';
import { updateRouteDisplay } from './routeDisplay.js';
import { getRouteColorByIndex } from './colors.js';

window.allRouteSegments = window.allRouteSegments || [];
const ANT_PATH_WEIGHT = 5;

// arrows per etage
window.routeArrowsByEtage = window.routeArrowsByEtage || [];
function equalsLatLng(a, b, eps = 1e-6) {
    if (!a || !b) return false;
    return Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps;
}

function createArrowMarker(latlng, direction, map, batimentLayers) {
    // direction: 'up' or 'down'
    const iconUrl = direction === 'up' ? '/images/arrow-up.svg' : '/images/arrow-down.svg';
    const icon = L.icon({ iconUrl, iconSize: [20, 20], iconAnchor: [10, 10], popupAnchor: [0, -10] });
    const marker = L.marker(latlng, { icon, interactive: true, zIndexOffset: 1000, riseOnHover: true });
    marker.on('click', () => {
        // switch base layer to the layer above or below if exists
        try {
            const currentIdx = batimentLayers.findIndex(l => map.hasLayer(l));
            if (currentIdx === -1) return;
            const targetIdx = direction === 'up' ? currentIdx + 1 : currentIdx - 1;
            if (targetIdx >= 0 && targetIdx < batimentLayers.length) {
                map.addLayer(batimentLayers[targetIdx]);
            }
        } catch (e) { console.error('arrow click error', e); }
    });
    return marker;
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
    routeSegmentsByEtage,
    osrmUrl
}) {
    // Debug: Vérification des paramètres
    console.log("[OSRM] Paramètres reçus:", {
        start,
        end,
        osrmUrl,
        departIdx,
        arriveeIdx
    });

    // Vérification cruciale
    if (!osrmUrl) {
        console.error("ERREUR CRITIQUE: osrmUrl est undefined!");
        return;
    }

    // Nettoyage global
    window.allRouteSegments.forEach(seg => {
        if (seg && map.hasLayer(seg)) {
            map.removeLayer(seg);
        }
    });
    window.allRouteSegments = [];

    // Clear arrows globally
    if (window.routeArrowsByEtage) {
        window.routeArrowsByEtage.forEach(arr => { if (arr) arr.forEach(a => { if (a && map.hasLayer(a)) map.removeLayer(a); }); });
    }
    window.routeArrowsByEtage = [];

    // Réinitialisation des segments par étage
    if (routeSegmentsByEtage) {
        for (let i = 0; i < layersEtages.length; i++) {
            routeSegmentsByEtage[i] = [];
        }
    }

    // Suppression de l'ancien écouteur
    if (window._routeLayerChangeFunction) {
        map.off('baselayerchange', window._routeLayerChangeFunction);
        window._routeLayerChangeFunction = null;
    }

    // Réinitialisation de l'état d'animation
    window.routeAnimationState = {};

    const routeUrl = `${osrmUrl}/${start[1]},${start[0]};${end[1]},${end[0]}?steps=true&geometries=geojson&overview=full`;
    console.log("[OSRM] URL complète:", routeUrl);
    console.time('osrm:fetch');
    console.log('[OSRM] Fetch start');

    fetch(routeUrl)
        .then(response => {
            console.timeLog('osrm:fetch', '[OSRM] Response received');
            // Vérifier le statut HTTP
            if (!response.ok) {
                throw new Error(`Erreur HTTP! statut: ${response.status}`);
            }
            return response.text();
        })
        .then(text => {
            console.timeLog('osrm:fetch', '[OSRM] Response text acquired, starting parse');
            try {
                // Essayer de parser le JSON
                return JSON.parse(text);
            } catch (e) {
                console.error("Erreur de parsing JSON. Réponse brute:", text.substring(0, 500));
                throw new Error("Réponse serveur invalide");
            }
        })
        .then(data => {
            console.timeEnd('osrm:fetch');
            console.log('[OSRM] Fetch+parse complete');
            if (data.routes && data.routes.length > 0) {
                var route = data.routes[0];
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

                    let stepCoordsRaw = step.geometry.coordinates;
                    let isMultiLine = Array.isArray(stepCoordsRaw[0][0]);

                    if (etageIdx !== currentEtageIdx) {
                        if (currentSeq.length > 1 && currentEtageIdx !== null) {
                            sequences.push({ etageIdx: currentEtageIdx, coords: currentSeq });
                        }
                        currentEtageIdx = etageIdx;
                        currentSeq = [];
                    }

                    if (isMultiLine) {
                        stepCoordsRaw.forEach((seg, segIdx) => {
                            let stepCoords = seg.map(([lng, lat]) => [lat, lng]);
                            if (stepCoords.length > 1) {
                                sequences.push({ etageIdx: currentEtageIdx, coords: stepCoords });
                            }
                        });
                    } else {
                        let stepCoords = stepCoordsRaw.map(([lng, lat]) => [lat, lng]);
                        if (currentSeq.length > 0) stepCoords = stepCoords.slice(1);
                        currentSeq.push(...stepCoords);
                    }
                });

                if (currentSeq.length > 1 && currentEtageIdx !== null) {
                    sequences.push({ etageIdx: currentEtageIdx, coords: currentSeq });
                }

                window.routeAnimationState = window.routeAnimationState || {};
                const currentEtageActiveIdx = batimentLayers.findIndex(l => map.hasLayer(l));

                function animateEtage(etageIdx) {
                    const etageSequences = sequences.filter(s => s.etageIdx === etageIdx && s.coords && s.coords.length > 1);
                    if (!etageSequences.length) return;

                    if (routeSegmentsByEtage[etageIdx]) {
                        routeSegmentsByEtage[etageIdx].forEach(seg => {
                            if (seg && map.hasLayer(seg)) map.removeLayer(seg);
                        });
                        routeSegmentsByEtage[etageIdx] = [];
                    }

                    // remove arrows for this etage from map and reset
                    if (window.routeArrowsByEtage && window.routeArrowsByEtage[etageIdx]) {
                        window.routeArrowsByEtage[etageIdx].forEach(a => { if (a && map.hasLayer(a)) map.removeLayer(a); });
                    }
                    window.routeArrowsByEtage[etageIdx] = [];

                    // Ajout d'un flag d'annulation pour l'animation de cet étage
                    window.routeAnimationState[etageIdx] = { cancelled: false, finished: false };

                    if (map.hasLayer(batimentLayers[etageIdx])) {
                        let finishedCount = 0;
                        etageSequences.forEach((sequence) => {
                            const coords = sequence.coords;
                            if (!coords || coords.length < 2) return;

                            const interpolatedCoords = [];
                            for (let i = 0; i < coords.length - 1; i++) {
                                const start = coords[i];
                                const end = coords[i + 1];
                                for (let j = 0; j <= 5; j++) {
                                    const fraction = j / 5;
                                    interpolatedCoords.push([
                                        start[0] + (end[0] - start[0]) * fraction,
                                        start[1] + (end[1] - start[1]) * fraction
                                    ]);
                                }
                            }
                            interpolatedCoords.push(coords[coords.length - 1]);

                            var seg = window.L.polyline([interpolatedCoords[0]], {
                                color: getRouteColorByIndex(etageIdx, layersEtages.length),
                                weight: ANT_PATH_WEIGHT
                            });
                            seg.addTo(map);

                            let idx = 1;
                            const totalDuration = 1500;
                            let startTime = null;

                            function animate(currentTime) {
                                // Vérifie si l'animation a été annulée (changement de layer)
                                if (window.routeAnimationState[etageIdx]?.cancelled) {
                                    // On arrête l'animation, on retire le segment
                                    if (seg && map.hasLayer(seg)) map.removeLayer(seg);
                                    return;
                                }
                                if (!startTime) startTime = currentTime;
                                const progress = (currentTime - startTime) / totalDuration;

                                if (progress < 1) {
                                    let easeProgress;
                                    if (progress < 0.5) {
                                        easeProgress = 0.5 * Math.pow(2 * progress, 4);
                                    } else {
                                        const t = 2 * (progress - 0.5);
                                        easeProgress = 0.5 + 0.5 * (1 - Math.pow(1 - t, 4));
                                    }
                                    const targetIndex = Math.min(
                                        Math.floor(easeProgress * interpolatedCoords.length),
                                        interpolatedCoords.length - 1
                                    );
                                    while (idx <= targetIndex) {
                                        seg.addLatLng(interpolatedCoords[idx]);
                                        idx++;
                                    }
                                    requestAnimationFrame(animate);
                                } else {
                                    while (idx < interpolatedCoords.length) {
                                        seg.addLatLng(interpolatedCoords[idx]);
                                        idx++;
                                    }
                                    routeSegmentsByEtage[etageIdx].push(seg);
                                    window.allRouteSegments.push(seg);
                                    finishedCount++;
                                    if (finishedCount === etageSequences.length) {
                                        window.routeAnimationState[etageIdx].finished = true;
                                    }
                                    // after segment finished, create arrows at sequence end and start when needed
                                    try {
                                        const seqIndex = sequences.findIndex(s => s === sequence);
                                        if (seqIndex !== -1) {
                                            const isGlobalEnd = (seqIndex === sequences.length - 1);
                                            const isGlobalStart = (seqIndex === 0);
                                            const nextSeq = sequences[seqIndex + 1];
                                            const prevSeq = sequences[seqIndex - 1];

                                            // end arrow: if not global end and next sequence is different floor
                                            if (!isGlobalEnd && nextSeq && nextSeq.etageIdx !== etageIdx) {
                                                const lastCoord = interpolatedCoords[interpolatedCoords.length - 1];
                                                // avoid overlapping with global arrivee marker
                                                const arriveeMarker = window.arriveeMarkerByEtage && window.arriveeMarkerByEtage[etageIdx] ? window.arriveeMarkerByEtage[etageIdx].getLatLng() : null;
                                                if (!arriveeMarker || !equalsLatLng([lastCoord[0], lastCoord[1]], [arriveeMarker.lat, arriveeMarker.lng])) {
                                                    const direction = nextSeq.etageIdx > etageIdx ? 'up' : 'down';
                                                    const marker = createArrowMarker(lastCoord, direction, map, batimentLayers);
                                                    window.routeArrowsByEtage[etageIdx] = window.routeArrowsByEtage[etageIdx] || [];
                                                    window.routeArrowsByEtage[etageIdx].push(marker);
                                                    if (map.hasLayer(batimentLayers[etageIdx])) marker.addTo(map);
                                                }
                                            }

                                            // start arrow: if not global start and previous sequence is different floor
                                            if (!isGlobalStart && prevSeq && prevSeq.etageIdx !== etageIdx) {
                                                const firstCoord = interpolatedCoords[0];
                                                const departMarker = window.departMarkerByEtage && window.departMarkerByEtage[etageIdx] ? window.departMarkerByEtage[etageIdx].getLatLng() : null;
                                                if (!departMarker || !equalsLatLng([firstCoord[0], firstCoord[1]], [departMarker.lat, departMarker.lng])) {
                                                    const direction = prevSeq.etageIdx > etageIdx ? 'up' : 'down';
                                                    const marker = createArrowMarker(firstCoord, direction, map, batimentLayers);
                                                    window.routeArrowsByEtage[etageIdx] = window.routeArrowsByEtage[etageIdx] || [];
                                                    window.routeArrowsByEtage[etageIdx].push(marker);
                                                    if (map.hasLayer(batimentLayers[etageIdx])) marker.addTo(map);
                                                }
                                            }
                                        }
                                    } catch (e) { console.error('arrow creation error', e); }
                                }
                            }
                            requestAnimationFrame(animate);
                        });
                    }
                }

                sequences.forEach(seq => animateEtage(seq.etageIdx));

                window._routeLayerChangeFunction = function (e) {
                    const idx = batimentLayers.findIndex(l => l === e.layer);
                    // Annule toutes les animations en cours sur tous les étages
                    Object.keys(window.routeAnimationState).forEach(etageKey => {
                        if (window.routeAnimationState[etageKey] && !window.routeAnimationState[etageKey].finished) {
                            window.routeAnimationState[etageKey].cancelled = true;
                        }
                    });
                    if (idx !== -1) {
                        if (routeSegmentsByEtage[idx]) {
                            routeSegmentsByEtage[idx].forEach(seg => {
                                if (seg && map.hasLayer(seg)) map.removeLayer(seg);
                            });
                            routeSegmentsByEtage[idx] = [];
                        }
                        // remove arrows for this layer and reset
                        if (window.routeArrowsByEtage && window.routeArrowsByEtage[idx]) {
                            window.routeArrowsByEtage[idx].forEach(a => { if (a && map.hasLayer(a)) map.removeLayer(a); });
                        }
                        window.routeArrowsByEtage[idx] = [];

                        const seq = sequences.find(s => s.etageIdx === idx);
                        if (seq) animateEtage(idx);
                    }
                };

                map.on('baselayerchange', window._routeLayerChangeFunction);

                updateRouteDisplay(map, routeSegmentsByEtage, window.departMarkerByEtage, window.arriveeMarkerByEtage, window.routeArrowsByEtage, currentEtageActiveIdx !== -1 ? currentEtageActiveIdx : departIdx);

                // Fit bounds conditionnel
                const routeBounds = L.latLngBounds([start, end]);
                if (!map.getBounds().contains(routeBounds)) {
                    map.fitBounds(routeBounds, { padding: [50, 50] });
                }
            } else {
                console.error('Aucune route trouvée');
            }
        })
        .catch(error => {
            console.error('[OSRM] Error during route fetch/parse:', error);
            try { console.timeEnd('osrm:fetch'); } catch (e) { }
            console.error('Erreur lors de la récupération de l\'itinéraire:', error);
        });
}