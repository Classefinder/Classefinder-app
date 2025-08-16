// Gestion de l'affichage et du masquage des segments et marqueurs d'itinéraire
export function updateRouteDisplay(map, routeSegmentsByEtage, departMarkerByEtage, arriveeMarkerByEtage, currentEtageIdx) {
    console.log('[routeDisplay] updateRouteDisplay start, currentEtageIdx=', currentEtageIdx);
    console.time('routeDisplay:update');
    // Masque tous les segments
    routeSegmentsByEtage.forEach((segments, idx) => {
        if (segments) segments.forEach(seg => map.removeLayer(seg));
    });
    // Affiche uniquement les segments de l'étage courant
    if (routeSegmentsByEtage[currentEtageIdx]) {
        routeSegmentsByEtage[currentEtageIdx].forEach(seg => seg.addTo(map));
    }
    // Masque tous les marqueurs
    departMarkerByEtage.forEach(m => { if (m) map.removeLayer(m); });
    arriveeMarkerByEtage.forEach(m => { if (m) map.removeLayer(m); });
    // Affiche le marqueur de départ/arrivée de l'étage courant
    if (departMarkerByEtage[currentEtageIdx]) map.addLayer(departMarkerByEtage[currentEtageIdx]);
    if (arriveeMarkerByEtage[currentEtageIdx]) map.addLayer(arriveeMarkerByEtage[currentEtageIdx]);
    console.timeEnd('routeDisplay:update');
    console.log('[routeDisplay] updateRouteDisplay end');
}
