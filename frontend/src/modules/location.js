// Module de gestion de la localisation et du périmètre
export function setupLocationControl({ map, config, perimeterCenter, perimeterRadius, onInside, onOutside, onDenied, allowAutoCenter = true }) {
    // Allow calling setupLocationControl multiple times without duplicating the locate control or perimeter circle.
    // Prefer config object if provided, otherwise use perimeterCenter and perimeterRadius parameters.
    const center = (config && config.perimeterCenter) || perimeterCenter;
    const radius = (config && config.perimeterRadius) || perimeterRadius;

    // If a locate control already exists on the window, reuse it.
    if (!window._cf_locateControl) {
        // Disable the plugin auto-centering (setView:false) so we control recenter behavior explicitly.
        window._cf_locateControl = L.control.locate({
            setView: false,
            flyTo: false,
            keepCurrentZoomLevel: true,
            drawCircle: false,
            showPopup: false,
            locateOptions: {
                enableHighAccuracy: true
            }
        }).addTo(map);
        // Defensive: ensure the control isn't already running on some browsers/plugins
        try { window._cf_locateControl.stop(); } catch (e) { /* ignore */ }
    }

    const lc = window._cf_locateControl;

    // Create or update the perimeter circle
    if (!window.perimeterCircle) {
        if (center && typeof radius === 'number') {
            window.perimeterCircle = L.circle(center, {
                radius: radius,
                color: 'red',
                fillColor: '#f03',
                fillOpacity: 0.2
            }).addTo(map);
        }
    } else {
        // update if new center/radius provided
        if (center) window.perimeterCircle.setLatLng(center);
        if (typeof radius === 'number') window.perimeterCircle.setRadius(radius);
    }

    // Helper to check if a latlng is inside the configured perimeter
    function isInPerimeter(latlng) {
        if (!window.perimeterCircle) return true; // if no perimeter, treat as inside
        const d = map.distance(latlng, window.perimeterCircle.getLatLng());
        return d <= window.perimeterCircle.getRadius();
    }

    // To avoid adding multiple identical handlers, remove previous handlers we added (if any)
    if (window._cf_locationHandlersAdded) {
        map.off('locationfound', window._cf_locationFoundHandler);
        map.off('locationerror', window._cf_locationErrorHandler);
    }

    // Define handlers and store references for potential removal
    window._cf_locationFoundHandler = function (e) {
        // If the user manually moved the map, avoid forcing a recenter here.
        const userMoved = !!window._cf_userMovedMap;

        if (isInPerimeter(e.latlng)) {
            if (typeof onInside === 'function') onInside(e, window.perimeterCircle, { userMoved });
            // Only auto-center once per locate session and only if the user hasn't moved the map
            if (allowAutoCenter && !userMoved && !window._cf_hasAutoCentered) {
                try { map.setView(e.latlng, map.getZoom()); window._cf_hasAutoCentered = true; } catch (err) { /* ignore */ }
            }
            // If auto-centering is disabled, ensure the view remains on the configured perimeter center
            if (!allowAutoCenter && !userMoved) {
                // Defer slightly to override any later setView from other listeners/plugins
                setTimeout(() => {
                    try {
                        const zoom = (config && config.initialZoom) || map.getZoom();
                        map.setView(center, zoom);
                    } catch (err) { /* ignore */ }
                }, 50);
            }
        } else {
            if (typeof onOutside === 'function') onOutside(e, window.perimeterCircle, { userMoved });
            if (allowAutoCenter && !userMoved && !window._cf_hasAutoCentered) {
                try { map.setView(e.latlng, map.getZoom()); window._cf_hasAutoCentered = true; } catch (err) { /* ignore */ }
            }
            if (!allowAutoCenter && !userMoved) {
                setTimeout(() => {
                    try {
                        const zoom = (config && config.initialZoom) || map.getZoom();
                        map.setView(center, zoom);
                    } catch (err) { /* ignore */ }
                }, 50);
            }
        }
    };
    window._cf_locationErrorHandler = function (e) {
        if (typeof onDenied === 'function') onDenied(e, window.perimeterCircle);
    };

    map.on('locationfound', window._cf_locationFoundHandler);
    map.on('locationerror', window._cf_locationErrorHandler);
    window._cf_locationHandlersAdded = true;

    // Track if the user manually moved the map to avoid auto-recentering after manual pans/zooms.
    // We add these listeners only once.
    if (!window._cf_userMoveListenersAdded) {
        window._cf_userMovedMap = false;
        // mark as user-moved
        const markUserMoved = () => { window._cf_userMovedMap = true; };
        // Leaflet events
        map.on('movestart', markUserMoved);
        map.on('zoomstart', markUserMoved);
        map.on('dragstart', markUserMoved);
        // More generic DOM interactions (some browsers may not fire the Leaflet move events in every case)
        try {
            const container = map.getContainer();
            container.addEventListener('pointerdown', markUserMoved, { passive: true });
            container.addEventListener('mousedown', markUserMoved, { passive: true });
            container.addEventListener('touchstart', markUserMoved, { passive: true });
            container.addEventListener('wheel', markUserMoved, { passive: true });
        } catch (e) { /* ignore if getContainer not available */ }
        window._cf_userMoveListenersAdded = true;
    }

    // Do NOT start locating automatically. Some browsers (Firefox/Safari) trigger geolocation
    // as soon as the control is created. Keep control creation idempotent and expose helpers
    // to start/stop locate explicitly from application code.
    function startLocate() {
        try {
            window._cf_userMovedMap = false;
            window._cf_hasAutoCentered = false;
            lc.start();
        } catch (e) { /* ignore */ }
    }

    function stopLocate() {
        try { lc.stop(); } catch (e) { /* ignore */ }
    }

    return { lc, perimeterCircle: window.perimeterCircle, startLocate, stopLocate };
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