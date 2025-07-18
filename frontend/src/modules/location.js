// Module de gestion de la localisation et du périmètre
// Utilise leaflet-control-locate (doit être chargé dans index.html)

export function setupLocationControl({ map, perimeterCenter, perimeterRadius, onInside, onOutside, onDenied }) {
    // Ajoute le contrôle de localisation
    const lc = L.control.locate({
        setView: 'once',
        flyTo: true,
        keepCurrentZoomLevel: true,
        drawCircle: false,
        showPopup: false,
        locateOptions: {
            enableHighAccuracy: true
        }
    }).addTo(map);

    // Fonction pour vérifier si la position est dans le périmètre
    function isInPerimeter(latlng) {
        const d = map.distance(latlng, perimeterCenter);
        return d <= perimeterRadius;
    }

    // Affiche le cercle du périmètre
    let perimeterCircle = L.circle(perimeterCenter, {
        radius: perimeterRadius,
        color: 'red',
        fillColor: '#f03',
        fillOpacity: 0.2
    }).addTo(map);

    // Gestion des événements du plugin
    map.on('locationfound', function (e) {
        if (isInPerimeter(e.latlng)) {
            onInside(e, perimeterCircle);
        } else {
            onOutside(e, perimeterCircle);
        }
    });
    map.on('locationerror', function (e) {
        onDenied(e, perimeterCircle);
    });

    // Démarre la localisation automatiquement
    lc.start();

    return { lc, perimeterCircle };
}

// Ajoute un bouton pour placer le marqueur de départ à la position utilisateur
export function addSetDepartButton({ map, getCurrentPosition, setDepartMarker }) {
    const btn = L.control({ position: 'topleft' });
    btn.onAdd = function () {
        const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        div.style.background = 'white';
        div.style.cursor = 'pointer';
        div.title = 'Définir le départ à ma position';
        div.innerHTML = '<span style="display:inline-block;padding:4px 8px;">📍 Départ ici</span>';
        div.onclick = function (e) {
            e.preventDefault();
            getCurrentPosition(function (latlng) {
                setDepartMarker(latlng);
            });
        };
        return div;
    };
    btn.addTo(map);
}

// Utilitaire pour obtenir la position courante via leaflet-control-locate
export function getCurrentUserPosition(map, callback) {
    map.once('locationfound', function (e) {
        callback(e.latlng);
    });
    map.locate({ setView: false, watch: false, enableHighAccuracy: true });
}
