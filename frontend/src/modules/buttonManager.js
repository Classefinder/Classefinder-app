// Module pour gérer l'affichage des boutons Départ/Arrivée pour les formes GeoJSON
// Chaque forme aura ses boutons qui apparaîtront sous le nom de la salle

/**
 * Crée et gère les boutons Départ/Arrivée pour une feature GeoJSON
 * @param {Object} feature La feature GeoJSON
 * @param {L.Layer} layer La couche Leaflet
 * @param {L.Map} map L'instance de la carte Leaflet
 * @param {number} LABEL_MIN_ZOOM Zoom minimum pour affichage
 * @param {number} LABEL_MAX_ZOOM Zoom maximum pour affichage
 * @param {Function} onSelectStart Callback quand on sélectionne le point de départ
 * @param {Function} onSelectEnd Callback quand on sélectionne le point d'arrivée
 * @returns {L.Marker} Le marker contenant le label et les boutons
 */
export function createButtonsWithLabel(feature, layer, map, LABEL_MIN_ZOOM, LABEL_MAX_ZOOM, onSelectStart, onSelectEnd) {
    // Créer le HTML pour le label et les boutons
    const html = `
        <div class="geojson-label-container">
            <div class="label-text">${feature.properties.name}</div>
            <div class="label-buttons">
                <button type="button" class="start-button" data-feature-id="${feature.properties.id}">
                    <img src="/images/start-icon.svg" alt="Départ" width="16" height="16">
                    <span>Départ</span>
                </button>
                <button type="button" class="end-button" data-feature-id="${feature.properties.id}">
                    <img src="/images/end-icon.svg" alt="Arrivée" width="16" height="16">
                    <span>Arrivée</span>
                </button>
            </div>
        </div>
    `;

    // Créer l'icône personnalisée
    const icon = L.divIcon({
        className: 'custom-label-with-buttons',
        html: html,
        iconSize: [0, 0],  // Taille nulle pour que l'icône n'interfère pas avec le positionnement
        iconAnchor: [0, 0] // Point d'ancrage au centre exact
    });

    // Créer le marker avec position fixe
    let position;

    try {
        // D'abord, essayer d'utiliser le centre des limites de la couche
        const bounds = layer.getBounds();
        if (bounds && bounds.isValid()) {
            position = bounds.getCenter();
        }
        // Si ça ne marche pas, on essaie d'autres méthodes
        else if (feature.geometry && feature.geometry.type) {
            switch (feature.geometry.type) {
                case 'Point':
                    if (Array.isArray(feature.geometry.coordinates) && feature.geometry.coordinates.length >= 2) {
                        position = L.latLng(feature.geometry.coordinates[1], feature.geometry.coordinates[0]);
                    }
                    break;
                case 'Polygon':
                    if (Array.isArray(feature.geometry.coordinates) && feature.geometry.coordinates[0]) {
                        const points = feature.geometry.coordinates[0];
                        let lat = 0, lng = 0, count = 0;
                        for (const point of points) {
                            if (Array.isArray(point) && point.length >= 2) {
                                lat += point[1];
                                lng += point[0];
                                count++;
                            }
                        }
                        if (count > 0) {
                            position = L.latLng(lat / count, lng / count);
                        }
                    }
                    break;
                case 'LineString':
                    if (Array.isArray(feature.geometry.coordinates)) {
                        let lat = 0, lng = 0, count = 0;
                        for (const point of feature.geometry.coordinates) {
                            if (Array.isArray(point) && point.length >= 2) {
                                lat += point[1];
                                lng += point[0];
                                count++;
                            }
                        }
                        if (count > 0) {
                            position = L.latLng(lat / count, lng / count);
                        }
                    }
                    break;
            }
        }

        // Si on n'a toujours pas de position valide, on essaie une dernière méthode
        if (!position || !position.lat || !position.lng) {
            const latLngs = layer.getLatLngs();
            if (Array.isArray(latLngs)) {
                const flat = latLngs.flat(2).filter(coord => coord && coord.lat && coord.lng);
                if (flat.length > 0) {
                    let lat = 0, lng = 0;
                    flat.forEach(coord => {
                        lat += coord.lat;
                        lng += coord.lng;
                    });
                    position = L.latLng(lat / flat.length, lng / flat.length);
                }
            }
        }

        // Si on n'a toujours pas de position valide, on lance une erreur
        if (!position || isNaN(position.lat) || isNaN(position.lng)) {
            throw new Error('Impossible de déterminer une position valide pour le label');
        }
    } catch (error) {
        console.error('Erreur lors du calcul de la position du label:', error);
        // Position par défaut au centre de la carte
        position = map.getCenter();
    }

    const marker = L.marker(position, {
        icon: icon,
        interactive: true,
        zIndexOffset: 1000,
        pane: 'markerPane' // Force l'affichage au-dessus des autres éléments
    });

    // Gérer la visibilité selon le zoom
    function updateVisibility() {
        const currentZoom = map.getZoom();
        const isLayerVisible = map.hasLayer(layer);

        // Si on n'est pas dans le bon niveau de zoom, on nettoie le forçage d'affichage
        if (currentZoom < LABEL_MIN_ZOOM || currentZoom > LABEL_MAX_ZOOM) {
            if (window.forcedFeatureId === feature.properties.id) {
                window.forcedFeatureId = null;
            }
        }

        const shouldShow = (currentZoom >= LABEL_MIN_ZOOM && currentZoom <= LABEL_MAX_ZOOM && isLayerVisible) ||
            (window.forcedFeatureId === feature.properties.id);

        if (shouldShow && !map.hasLayer(marker)) {
            marker.addTo(map);
        } else if (!shouldShow && map.hasLayer(marker)) {
            marker.remove();
        }
    }

    // Écouter les événements de zoom et visibilité
    map.on('zoomend', updateVisibility);
    map.on('layeradd layerremove', (e) => {
        if (e.layer === layer) {
            updateVisibility();
        }
    });

    // Ajouter les écouteurs d'événements aux boutons quand le marker est ajouté
    marker.on('add', () => {
        const container = marker.getElement();
        if (!container) return;

        // Trouver les boutons dans le DOM du marker
        const startBtn = container.querySelector('.start-button');
        const endBtn = container.querySelector('.end-button');

        if (startBtn) {
            startBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                onSelectStart(feature, layer, map);
            });
        }

        if (endBtn) {
            endBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                onSelectEnd(feature, layer, map);
            });
        }
    });

    // Faire la première mise à jour de visibilité
    updateVisibility();
    return marker;
}

/**
 * Force l'affichage des boutons pour une feature spécifique
 * @param {string} featureId L'ID de la feature
 */
export function forceShowButtons(featureId) {
    window.forcedFeatureId = featureId;
}

/**
 * Cache les boutons forcés
 */
export function hideButtons() {
    window.forcedFeatureId = null;
}
