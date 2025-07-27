import { getLineCenter } from './geoUtils.js';
import { departIcon, arriveeIcon } from './icons.js';
import { createLabel } from './labelManager.js';
import { createButtonsWithLabel, forceShowButtons, hideButtons } from './buttonManager.js';
import { getBaseColorByIndex } from './colors.js';
// Les paramètres dynamiques sont passés depuis main.js
// Liste noire des noms de features pour lesquels la popup ne doit pas s'afficher

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
                    départ
                </button>
                <button class="popup-button end-button">
                    <img src="/images/end-icon.svg" alt="Arrivée" class="button-icon">
                    arrivée
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

const LABEL_MIN_ZOOM = 20;  // Niveau de zoom minimum pour afficher les labels
const LABEL_MAX_ZOOM = 23;  // Niveau de zoom maximum pour afficher les labels

export function addFeatureClickHandler(feature, layer, map, { etageIdx, batimentFeatures, cheminFeatures, batimentLayers, ETAGES, getRouteAndPoints, BASE_HUE, BASE_SAT, BASE_LIGHT, blacklist }) {
    // Ajoute le label et les boutons si la feature a un nom
    if (feature.properties && feature.properties.name && !blacklist.includes(feature.properties.name.toLowerCase())) {
        createButtonsWithLabel(
            feature,
            layer,
            map,
            LABEL_MIN_ZOOM,
            LABEL_MAX_ZOOM,
            // Callback pour le bouton Départ
            (feature, layer, map) => {
                const cheminObj = cheminFeatures[etageIdx]?.find(obj =>
                    obj.feature.properties.name === feature.properties.name
                );
                if (cheminObj) {
                    if (window.departMarker) map.removeLayer(window.departMarker);
                    let markerCoords;
                    if (cheminObj.feature.geometry.type === 'LineString') {
                        markerCoords = getLineCenter(cheminObj.feature.geometry.coordinates);
                    } else if (cheminObj.feature.geometry.type === 'Point') {
                        markerCoords = cheminObj.feature.geometry.coordinates.slice().reverse();
                    }
                    if (markerCoords) {
                        window.departMarkerByEtage.forEach((marker, idx) => {
                            if (marker) map.removeLayer(marker);
                            window.departMarkerByEtage[idx] = null;
                        });
                        const marker = L.marker(markerCoords, {
                            icon: departIcon
                        }).bindPopup('Départ : ' + feature.properties.name);
                        window.departMarkerByEtage[etageIdx] = marker;
                        if (batimentLayers[etageIdx] && map.hasLayer(batimentLayers[etageIdx])) {
                            marker.addTo(map).openPopup();
                        }
                        window.currentRouteStart = markerCoords;
                        window.currentRouteStartIdx = etageIdx;
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
            },
            // Callback pour le bouton Arrivée
            (feature, layer, map) => {
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
            }
        );
    }

    // Gestion du style dynamique (hover/click)
    // On ne fait l'effet que si la feature a un nom et n'est pas blacklistée
    if (feature.properties && feature.properties.name && !blacklist.includes(feature.properties.name.toLowerCase())) {
        // On sauvegarde le style d'origine
        const originalStyle = { ...layer.options };
        // Couleur de base
        const baseColor = getBaseColorByIndex(etageIdx, ETAGES.length, BASE_HUE, BASE_SAT, BASE_LIGHT);
        // Hover: vert "horrible"
        const hoverColor = 'hsl(120, 100%, 45%)'; // Vert vif
        // Click: +30% saturation (garde le style précédent)
        const activeSat = Math.min(BASE_SAT + 30, 100);
        const activeColor = `hsl(${BASE_HUE}, ${activeSat}%, ${BASE_LIGHT}%)`;

        // Pour savoir si la feature est sélectionnée
        let isSelected = false;

        // Hover effect
        layer.on('mouseover', function () {
            if (!isSelected) {
                layer.setStyle({ color: hoverColor, fillColor: hoverColor });
            }
        });
        layer.on('mouseout', function () {
            if (!isSelected) {
                layer.setStyle({ color: baseColor, fillColor: baseColor });
            }
        });

        // Click effect (sélection)
        layer.on('click', function () {
            isSelected = true;
            layer.setStyle({ color: activeColor, fillColor: activeColor });
            // On désélectionne après un court délai (ou à la fermeture du popup)
            setTimeout(() => {
                isSelected = false;
                layer.setStyle({ color: baseColor, fillColor: baseColor });
            }, 800);
        });
    }

    // Gestion du forçage d'affichage des boutons au clic
    layer.on('click', function (e) {
        L.DomEvent.stopPropagation(e);
        if (feature.properties && blacklist.includes(feature.properties.name.toLowerCase())) {
            return;
        }
        // On recentre/zoome sur la salle comme avant
        const bounds = layer.getBounds();
        map.fitBounds(bounds, {
            padding: [50, 50],
            maxZoom: 22,
            animate: true
        });
        // On force l'affichage des boutons pour cette feature
        if (feature.properties && feature.properties.id) {
            window.forcedFeatureId = feature.properties.id;
            // On déclenche un update du marker (le label + boutons)
            map.fire('zoomend');
        }
    });
}
