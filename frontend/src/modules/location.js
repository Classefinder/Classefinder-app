// Module de gestion de la localisation et du périmètre
export function setupLocationControl({ map, config, onInside, onOutside, onDenied }) {
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
        const d = map.distance(latlng, config.perimeterCenter);
        return d <= config.perimeterRadius; // Utilisation directe du rayon
    }

    // Création du cercle avec les paramètres dynamiques
    const perimeterCircle = L.circle(config.perimeterCenter, {
        radius: config.perimeterRadius, // Paramètre crucial
        color: 'red',
        fillColor: '#f03',
        fillOpacity: 0.2
    }).addTo(map);
    
    // Stocker la référence globale
    window.perimeterCircle = perimeterCircle;

    // Gestion des événements
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

export function addSetDepartButton({ map, getCurrentPosition, setDepartMarker }) {
    setTimeout(() => {
        const searchStart = document.querySelector('.search-control-start');
        if (searchStart) {
            const div = document.createElement('div');
            div.className = 'leaflet-bar leaflet-control set-depart-btn';
            div.style.background = 'white';
            div.style.cursor = 'pointer';
            div.title = 'Définir le départ à ma position';
            div.innerHTML = '<span class="depart-icon"></span>';
            div.onclick = function (e) {
                e.preventDefault();
                getCurrentPosition(function (latlng) {
                    setDepartMarker(latlng);
                });
            };
            const searchBtn = searchStart.querySelector('.search-button');
            if (searchBtn) {
                searchStart.insertBefore(div, searchBtn);
            } else {
                searchStart.appendChild(div);
            }
        }
    }, 300);
}

export function getCurrentUserPosition(map, callback) {
    map.once('locationfound', function (e) {
        callback(e.latlng);
    });
    map.locate({ setView: false, watch: false, enableHighAccuracy: true });
}