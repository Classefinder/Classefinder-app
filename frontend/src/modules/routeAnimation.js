// Module pour l'animation des itinéraires
import { getRouteColorByIndex } from './colors.js';

export function animateRoute(map, sequences, etageIdx, layersEtages, ANT_PATH_WEIGHT) {
    const etageSequences = sequences.filter(s => s.etageIdx === etageIdx && s.coords && s.coords.length > 1);
    if (!etageSequences.length) return;

    console.log('[routeAnimation] animateRoute start for etage', etageIdx, 'sequences:', etageSequences.length);
    console.time(`routeAnimation:etage:${etageIdx}`);

    if (window.routeSegmentsByEtage[etageIdx]) {
        window.routeSegmentsByEtage[etageIdx].forEach(seg => {
            if (seg && map.hasLayer(seg)) map.removeLayer(seg);
        });
        window.routeSegmentsByEtage[etageIdx] = [];
    }

    window.routeAnimationState[etageIdx] = { cancelled: false, finished: false };

    if (map.hasLayer(layersEtages[etageIdx])) {
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
                if (window.routeAnimationState[etageIdx]?.cancelled) {
                    if (seg && map.hasLayer(seg)) map.removeLayer(seg);
                    return;
                }
                if (!startTime) startTime = currentTime;
                const progress = (currentTime - startTime) / totalDuration;

                if (progress < 1) {
                    const nextIdx = Math.min(Math.floor(progress * interpolatedCoords.length), interpolatedCoords.length - 1);
                    seg.setLatLngs(interpolatedCoords.slice(0, nextIdx + 1));
                    requestAnimationFrame(animate);
                } else {
                    seg.setLatLngs(interpolatedCoords);
                    finishedCount++;
                    if (finishedCount === etageSequences.length) {
                        window.routeAnimationState[etageIdx].finished = true;
                        console.timeEnd(`routeAnimation:etage:${etageIdx}`);
                        console.log('[routeAnimation] animateRoute finished for etage', etageIdx);
                    }
                }
            }

            requestAnimationFrame(animate);
        });
    }
}
