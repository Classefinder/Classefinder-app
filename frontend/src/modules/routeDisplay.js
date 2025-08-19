// Gestion de l'affichage et du masquage des segments et marqueurs d'itinéraire
export function updateRouteDisplay(map, routeSegmentsByEtage, departMarkerByEtage, arriveeMarkerByEtage, routeArrowsByEtage, currentEtageIdx) {
    console.log('[routeDisplay] updateRouteDisplay start, currentEtageIdx=', currentEtageIdx);
    console.time('routeDisplay:update');
    // Masque tous les segments
    routeSegmentsByEtage.forEach((segments, idx) => {
        if (segments) segments.forEach(seg => { if (seg && map.hasLayer(seg)) map.removeLayer(seg); });
    });
    // Affiche uniquement les segments de l'étage courant
    if (routeSegmentsByEtage[currentEtageIdx]) {
        routeSegmentsByEtage[currentEtageIdx].forEach(seg => seg.addTo(map));
    }
    // Masque tous les marqueurs
    departMarkerByEtage.forEach(m => { if (m && map.hasLayer(m)) map.removeLayer(m); });
    arriveeMarkerByEtage.forEach(m => { if (m && map.hasLayer(m)) map.removeLayer(m); });
    // Affiche le marqueur de départ/arrivée de l'étage courant
    if (departMarkerByEtage[currentEtageIdx]) map.addLayer(departMarkerByEtage[currentEtageIdx]);
    if (arriveeMarkerByEtage[currentEtageIdx]) map.addLayer(arriveeMarkerByEtage[currentEtageIdx]);

    // Masque toutes les flèches
    if (Array.isArray(routeArrowsByEtage)) {
        routeArrowsByEtage.forEach((arr, idx) => {
            if (arr) arr.forEach(a => { if (a && map.hasLayer(a)) map.removeLayer(a); });
        });
        // Affiche les flèches de l'étage courant
        if (routeArrowsByEtage[currentEtageIdx]) {
            routeArrowsByEtage[currentEtageIdx].forEach(a => a.addTo(map));
        }
    }

    console.timeEnd('routeDisplay:update');
    console.log('[routeDisplay] updateRouteDisplay end');
}
