import { getLineCenter } from './geoUtils.js';

// Icônes personnalisées pour les marqueurs (réutilisées depuis searchBar.js)
const departIcon = L.icon({
    iconUrl: "/images/start-icon.svg",
    iconSize: [15, 15],
    iconAnchor: [7.5, 7.5],
    popupAnchor: [0, -10],
});

const arriveeIcon = L.icon({
    iconUrl: '/images/end-icon.svg',
    iconSize: [15, 15],
    iconAnchor: [7.5, 7.5],
    popupAnchor: [0, -10],
});

// Liste noire des noms de features pour lesquels la popup ne doit pas s'afficher
const blacklist = ["sanitaire", "toilettes", "escalier", ""];

/**
 * Crée le contenu HTML du popup avec les boutons départ/arrivée
 * @param {string} name Le nom de la salle
 * @returns {string} Le contenu HTML du popup
 */
function createPopupContent(name) {
    return `
        <div class="popup-content">
            <div class="popup-title">${name}</div>
            <div class="popup-buttons">
                <button class="popup-button start-button">
                    <img src="/images/start-icon.svg" alt="Départ" class="button-icon">
                    Définir comme départ
                </button>
                <button class="popup-button end-button">
                    <img src="/images/end-icon.svg" alt="Arrivée" class="button-icon">
                    Définir comme arrivée
                </button>
            </div>
        </div>
    `;
}

/**
 * Ajoute l'événement de click sur une feature GeoJSON
 * @param {Object} feature La feature GeoJSON
 * @param {L.Layer} layer La couche Leaflet
 * @param {L.Map} map L'instance de la carte Leaflet
 * @param {Object} options Les options supplémentaires (etageIdx, batimentLayers, etc.)
 */
// Configuration des labels
const LABEL_MIN_ZOOM = 20;  // Niveau de zoom minimum pour afficher les labels
const LABEL_MAX_ZOOM = 23;  // Niveau de zoom maximum pour afficher les labels

export function addFeatureClickHandler(feature, layer, map, { etageIdx, batimentFeatures, cheminFeatures, batimentLayers, ETAGES, getRouteAndPoints }) {
    // Ajoute le label si la feature a un nom
    if (feature.properties && feature.properties.name && !blacklist.includes(feature.properties.name.toLowerCase())) {
        const label = L.divIcon({
            className: 'geojson-label',
            html: `<div>${feature.properties.name}</div>`,
            iconSize: null
        });

        const center = layer.getBounds().getCenter();
        const labelMarker = L.marker(center, {
            icon: label,
            interactive: false,  // Désactive l'interaction avec le label
            zIndexOffset: 1000  // Place le label au-dessus des autres éléments
        });

        // Fonction pour mettre à jour la visibilité du label
        function updateLabelVisibility() {
            const currentZoom = map.getZoom();
            const isLayerVisible = map.hasLayer(layer);

            if (currentZoom >= LABEL_MIN_ZOOM && currentZoom <= LABEL_MAX_ZOOM && isLayerVisible) {
                if (!map.hasLayer(labelMarker)) {
                    labelMarker.addTo(map);
                }
            } else {
                if (map.hasLayer(labelMarker)) {
                    map.removeLayer(labelMarker);
                }
            }
        }

        // Gestion de la visibilité du label en fonction du zoom et de la visibilité du layer
        map.on('zoomend', updateLabelVisibility);

        // Vérifie la visibilité du label quand le layer est ajouté/retiré de la carte
        map.on('layeradd layerremove', function (e) {
            if (e.layer === layer) {
                updateLabelVisibility();
            }
        });
    }

    layer.on('click', function (e) {
        // Empêche la propagation du clic à la carte
        L.DomEvent.stopPropagation(e);

        // Vérifie si le nom de la feature est dans la liste noire
        if (feature.properties && blacklist.includes(feature.properties.name.toLowerCase())) {
            return; // Ne fait rien si le nom est dans la liste noire
        }

        // Calcule les limites de la feature et zoom
        const bounds = layer.getBounds();
        map.fitBounds(bounds, {
            padding: [50, 50],
            maxZoom: 22,
            animate: true
        });

        // Crée et bind le popup avec les boutons
        if (feature.properties && feature.properties.name) {
            const popup = L.popup()
                .setContent(createPopupContent(feature.properties.name));

            layer.bindPopup(popup);
            layer.openPopup();

            // Une fois que le popup est ouvert, on ajoute les événements aux boutons
            setTimeout(() => {
                const startButton = document.querySelector('.popup-button.start-button');
                const endButton = document.querySelector('.popup-button.end-button');

                if (startButton) {
                    startButton.addEventListener('click', () => {
                        // Trouve le chemin correspondant
                        const cheminObj = cheminFeatures[etageIdx]?.find(obj =>
                            obj.feature.properties.name === feature.properties.name
                        );

                        if (cheminObj) {
                            // Supprime l'ancien marqueur de départ
                            if (window.departMarker) map.removeLayer(window.departMarker);

                            // Calcule les coordonnées du marqueur
                            let markerCoords;
                            if (cheminObj.feature.geometry.type === 'LineString') {
                                markerCoords = getLineCenter(cheminObj.feature.geometry.coordinates);
                            } else if (cheminObj.feature.geometry.type === 'Point') {
                                markerCoords = cheminObj.feature.geometry.coordinates.slice().reverse();
                            }

                            if (markerCoords) {
                                // Supprime tous les anciens marqueurs de départ
                                window.departMarkerByEtage.forEach((marker, idx) => {
                                    if (marker) map.removeLayer(marker);
                                    window.departMarkerByEtage[idx] = null;
                                });

                                // Crée le nouveau marqueur
                                const marker = L.marker(markerCoords, {
                                    icon: departIcon
                                }).bindPopup('Départ : ' + feature.properties.name);

                                window.departMarkerByEtage[etageIdx] = marker;
                                if (batimentLayers[etageIdx] && map.hasLayer(batimentLayers[etageIdx])) {
                                    marker.addTo(map).openPopup();
                                }

                                // Met à jour les variables globales
                                window.currentRouteStart = markerCoords;
                                window.currentRouteStartIdx = etageIdx;

                                // Si on a déjà un point d'arrivée, on calcule l'itinéraire
                                if (window.currentRouteStart && window.currentRouteEnd) {
                                    getRouteAndPoints({
                                        map,
                                        start: window.currentRouteStart,
                                        end: window.currentRouteEnd,
                                        markers: [marker, window.arriveeMarkerByEtage[window.currentRouteEndIdx]],
                                        layersEtages: batimentLayers,
                                        departIdx: window.currentRouteStartIdx,
                                        arriveeIdx: window.currentRouteEndIdx,
                                        ETAGES,
                                        batimentLayers,
                                        routeSegmentsByEtage: window.routeSegmentsByEtage
                                    });
                                }
                            }
                        }
                        layer.closePopup();
                    });
                }

                if (endButton) {
                    endButton.addEventListener('click', () => {
                        // Code similaire pour le point d'arrivée
                        const cheminObj = cheminFeatures[etageIdx]?.find(obj =>
                            obj.feature.properties.name === feature.properties.name
                        );

                        if (cheminObj) {
                            if (window.arriveeMarker) map.removeLayer(window.arriveeMarker);

                            let markerCoords;
                            if (cheminObj.feature.geometry.type === 'LineString') {
                                markerCoords = getLineCenter(cheminObj.feature.geometry.coordinates);
                            } else if (cheminObj.feature.geometry.type === 'Point') {
                                markerCoords = cheminObj.feature.geometry.coordinates.slice().reverse();
                            }

                            if (markerCoords) {
                                window.arriveeMarkerByEtage.forEach((marker, idx) => {
                                    if (marker) map.removeLayer(marker);
                                    window.arriveeMarkerByEtage[idx] = null;
                                });

                                const marker = L.marker(markerCoords, {
                                    icon: arriveeIcon
                                }).bindPopup('Arrivée : ' + feature.properties.name);

                                window.arriveeMarkerByEtage[etageIdx] = marker;
                                if (batimentLayers[etageIdx] && map.hasLayer(batimentLayers[etageIdx])) {
                                    marker.addTo(map).openPopup();
                                }

                                window.currentRouteEnd = markerCoords;
                                window.currentRouteEndIdx = etageIdx;

                                if (window.currentRouteStart && window.currentRouteEnd) {
                                    getRouteAndPoints({
                                        map,
                                        start: window.currentRouteStart,
                                        end: window.currentRouteEnd,
                                        markers: [window.departMarkerByEtage[window.currentRouteStartIdx], marker],
                                        layersEtages: batimentLayers,
                                        departIdx: window.currentRouteStartIdx,
                                        arriveeIdx: window.currentRouteEndIdx,
                                        ETAGES,
                                        batimentLayers,
                                        routeSegmentsByEtage: window.routeSegmentsByEtage
                                    });
                                }
                            }
                        }
                        layer.closePopup();
                    });
                }
            }, 100);
        }
    });
}
