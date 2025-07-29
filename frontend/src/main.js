import { getLineCenter } from './modules/geoUtils.js';
import { updateRouteDisplay } from './modules/routeDisplay.js';
import { getRouteAndPoints } from './modules/route.js';
import { setupSearchBars } from './modules/searchBar.js';
import { setupLocationControl, addSetDepartButton, getCurrentUserPosition } from './modules/location.js';
import { loadGeojsonLayers } from './modules/geojsonLoader.js';
import { initThemeManager, getCurrentTheme, onThemeChange, toggleTheme, THEMES } from './modules/themeManager.js';
import { setupTheme } from './modules/themeSetup.js';
import { setupMapFeatures } from './modules/mapSetup.js';

import * as userConfig from './modules/userConfig.js';

// Variables de config dynamiques
let ETAGES = userConfig.ETAGES;
let perimeterCenter = userConfig.perimeterCenter;
let perimeterRadius = userConfig.perimeterRadius;
let BASE_HUE = userConfig.BASE_HUE;
let BASE_SAT = userConfig.BASE_SAT;
let BASE_LIGHT = userConfig.BASE_LIGHT;
let blacklist = userConfig.blacklist;

// Ajout d'un niveau de zoom libre
const map = L.map('map', {
    zoomDelta: 0.1,
    zoomSnap: 0
}).setView(perimeterCenter, 18);
// Gestion du sélecteur de config
async function loadConfigList() {
  try {
    const res = await fetch('/api/configs');
    const configs = await res.json();
    const selector = document.getElementById('config-selector');
    selector.innerHTML = '';
    configs.forEach(cfg => {
      const opt = document.createElement('option');
      opt.value = cfg;
      opt.textContent = cfg.replace(/\.json$/, '');
      selector.appendChild(opt);
    });
    return configs;
  } catch (e) {
    console.error('Erreur lors du chargement des configs:', e);
    return [];
  }
}

async function loadConfigFile(filename) {
  try {
    const res = await fetch(`/config/${filename}`);
    const data = await res.json();
    if (data.ETAGES) ETAGES = data.ETAGES;
    // Correction : bien charger perimeterCenter et perimeterRadius, et mettre à jour la vue de la carte si besoin
    let shouldUpdateView = false;
    let shouldUpdateRadius = false;
    if (data.perimeterCenter && Array.isArray(data.perimeterCenter) && data.perimeterCenter.length === 2) {
      perimeterCenter = data.perimeterCenter;
      shouldUpdateView = true;
    }
    if (typeof data.perimeterRadius !== 'undefined') {
      perimeterRadius = data.perimeterRadius;
      shouldUpdateRadius = true;
    }
    if (typeof data.BASE_HUE !== 'undefined') BASE_HUE = data.BASE_HUE;
    if (typeof data.BASE_SAT !== 'undefined') BASE_SAT = data.BASE_SAT;
    if (typeof data.BASE_LIGHT !== 'undefined') BASE_LIGHT = data.BASE_LIGHT;
    if (Array.isArray(data.blacklist)) blacklist = data.blacklist;
    // Si perimeterCenter ou perimeterRadius a changé, recentrer la carte et réinitialiser le contrôle de localisation
    if ((shouldUpdateView || shouldUpdateRadius) && typeof map !== 'undefined' && map.setView) {
      map.setView(perimeterCenter, 18);
      // Supprimer l'ancien cercle de périmètre si présent
      if (window.perimeterCircle && map.hasLayer(window.perimeterCircle)) {
        map.removeLayer(window.perimeterCircle);
        window.perimeterCircle = null;
      }
      // Réinitialiser le contrôle de localisation pour prendre en compte les nouveaux paramètres
      if (typeof setupLocationControl === 'function') {
        setupLocationControl({
          map,
          perimeterCenter,
          perimeterRadius,
          onInside: (e, perimeterCircle) => {
            map.removeLayer(perimeterCircle);
            if (!geojsonLoaded) {
              geojsonLoaded = true;
              loadGeojsonLayers({
                ETAGES,
                batimentLayers,
                batimentFeatures,
                cheminFeatures,
                layerControl: mapLayerControl,
                getRouteAndPoints,
                map,
                BASE_HUE,
                BASE_SAT,
                BASE_LIGHT,
                blacklist,
                onAllLoaded: () => {
                  if (!searchBarInitialized) {
                    searchBarInitialized = true;
                    setupSearchBars({
                      map,
                      batimentLayers,
                      batimentFeatures,
                      cheminFeatures,
                      ETAGES,
                      getRouteAndPoints
                    });
                  }
                  if (!departButtonAdded) {
                    departButtonAdded = true;
                    addSetDepartButton({
                      map,
                      getCurrentPosition: cb => getCurrentUserPosition(map, cb),
                      setDepartMarker: (latlng) => {
                        window.departMarkerByEtage.forEach((marker, idx) => {
                          if (marker) map.removeLayer(marker);
                          window.departMarkerByEtage[idx] = null;
                        });
                        const currentIdx = batimentLayers.findIndex(l => map.hasLayer(l));
                        if (currentIdx !== -1) {
                          const marker = L.marker(latlng, { icon: departIcon, className: 'start-marker' }).bindPopup('Départ : Ma position');
                          window.departMarkerByEtage[currentIdx] = marker;
                          marker.addTo(map).openPopup();
                          window.currentRouteStart = [latlng.lat, latlng.lng];
                          window.currentRouteStartIdx = currentIdx;
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
                              routeSegmentsByEtage: window.routeSegmentsByEtage,
                              markerOptions: { className: 'end-marker' }
                            });
                          }
                        }
                      }
                    });
                  }
                  batimentLayers.forEach((layer, idx) => {
                    if (idx === 0) {
                      if (!map.hasLayer(layer)) map.addLayer(layer);
                    } else {
                      if (map.hasLayer(layer)) map.removeLayer(layer);
                    }
                  });
                  const firstVisibleIdx = batimentLayers.findIndex(layer => map.hasLayer(layer));
                  if (firstVisibleIdx !== -1) {
                    setBackgroundForEtage(firstVisibleIdx);
                  }
                }
              });
            }
          },
          onOutside: (e, perimeterCircle) => {
            map.setView(perimeterCenter, 18);
          },
          onDenied: (e, perimeterCircle) => {
            map.setView(perimeterCenter, 18);
          }
        });
      }
    }
    return data;
  } catch (e) {
    console.error('Erreur lors du chargement du fichier de config:', e);
  }
}

async function setupConfigSelector() {
  const configs = await loadConfigList();
  const selector = document.getElementById('config-selector');
  if (!configs.length) {
    selector.innerHTML = '<option>Aucune config</option>';
    selector.disabled = true;
    return;
  }
  selector.disabled = false;
  // Charger la config mémorisée si présente, sinon la première par défaut
  let configToLoad = configs[0];
  const storedConfig = localStorage.getItem('selectedConfig');
  if (storedConfig && configs.includes(storedConfig)) {
    configToLoad = storedConfig;
    localStorage.removeItem('selectedConfig');
  }
  await loadConfigFile(configToLoad);
  selector.value = configToLoad;
  selector.addEventListener('change', async (e) => {
    // Mémoriser le choix et recharger la page
    localStorage.setItem('selectedConfig', e.target.value);
    window.location.reload();
  });
}

// Initialiser le sélecteur de config au chargement
setupConfigSelector();
// URLs MapTiler vectoriel pour le fond universel
const UNIVERSAL_BASE_URLS = {
    light: 'https://api.maptiler.com/maps/3b544fc3-420c-4a93-a594-a99b71d941bb/style.json?key=BiyHHi8FTQZ233ADqskZ',
    dark: 'https://api.maptiler.com/maps/04c03a5d-804b-4c6f-9736-b7103fdb530b/style.json?key=BiyHHi8FTQZ233ADqskZ'
};

let universalBaseLayer = null;

function setUniversalBaseLayer(theme) {
    if (universalBaseLayer) {
        map.removeLayer(universalBaseLayer);
    }
    const styleUrl = theme === 'dark' ? UNIVERSAL_BASE_URLS.dark : UNIVERSAL_BASE_URLS.light;
    universalBaseLayer = L.maplibreGL({
        style: styleUrl,
        attribution: '© MapTiler, OpenStreetMap contributors'
    });
    universalBaseLayer.addTo(map);
}


// Initialisation du gestionnaire de thème
initThemeManager();
setUniversalBaseLayer(getCurrentTheme());
onThemeChange(setUniversalBaseLayer);

// Initialisation du thème
setupTheme(map, UNIVERSAL_BASE_URLS);

// Initialisation des fonctionnalités de la carte
const { batimentLayers, batimentFeatures, cheminFeatures, layerControl: mapLayerControl } = setupMapFeatures({
    map,
    ETAGES,
    perimeterCenter,
    perimeterRadius,
    getRouteAndPoints
});
// Les modules qui utilisent BASE_HUE, BASE_SAT, BASE_LIGHT, blacklist doivent être adaptés pour prendre les valeurs dynamiques si besoin.

// Stockage des couches et features par étage

// Flags pour empêcher l'initialisation multiple
let geojsonLoaded = false;
let searchBarInitialized = false;
let departButtonAdded = false;

// Logique de localisation obligatoire et chargement conditionnel
document.addEventListener('DOMContentLoaded', () => {
    setupLocationControl({
        map,
        perimeterCenter,
        perimeterRadius,
        onInside: (e, perimeterCircle) => {
            map.removeLayer(perimeterCircle);
            if (!geojsonLoaded) {
                geojsonLoaded = true;
                loadGeojsonLayers({
                    ETAGES,
                    batimentLayers,
                    batimentFeatures,
                    cheminFeatures,
                    layerControl: mapLayerControl,
                    getRouteAndPoints,
                    map,
                    BASE_HUE,
                    BASE_SAT,
                    BASE_LIGHT,
                    blacklist,
                    onAllLoaded: () => {
                        if (!searchBarInitialized) {
                            searchBarInitialized = true;
                            setupSearchBars({
                                map,
                                batimentLayers,
                                batimentFeatures,
                                cheminFeatures,
                                ETAGES,
                                getRouteAndPoints
                            });
                        }
                        if (!departButtonAdded) {
                            departButtonAdded = true;
                            addSetDepartButton({
                                map,
                                getCurrentPosition: cb => getCurrentUserPosition(map, cb),
                                setDepartMarker: (latlng) => {
                                    // Supprime tous les anciens marqueurs de départ sur tous les étages
                                    window.departMarkerByEtage.forEach((marker, idx) => {
                                        if (marker) map.removeLayer(marker);
                                        window.departMarkerByEtage[idx] = null;
                                    });
                                    // Place le marqueur de départ sur l'étage courant
                                    const currentIdx = batimentLayers.findIndex(l => map.hasLayer(l));
                                    if (currentIdx !== -1) {
                                        const marker = L.marker(latlng, { icon: departIcon, className: 'start-marker' }).bindPopup('Départ : Ma position');
                                        window.departMarkerByEtage[currentIdx] = marker;
                                        marker.addTo(map).openPopup();
                                        window.currentRouteStart = [latlng.lat, latlng.lng];
                                        window.currentRouteStartIdx = currentIdx;
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
                                                routeSegmentsByEtage: window.routeSegmentsByEtage,
                                                markerOptions: { className: 'end-marker' }
                                            });
                                        }
                                    }
                                }
                            });
                        }
                        // Masquer tous les layers sauf celui de l'étage actif (0) après chargement
                        batimentLayers.forEach((layer, idx) => {
                            if (idx === 0) {
                                if (!map.hasLayer(layer)) map.addLayer(layer);
                            } else {
                                if (map.hasLayer(layer)) map.removeLayer(layer);
                            }
                        });
                        // Synchronise dynamiquement le fond de carte avec le premier layer affiché
                        const firstVisibleIdx = batimentLayers.findIndex(layer => map.hasLayer(layer));
                        if (firstVisibleIdx !== -1) {
                            setBackgroundForEtage(firstVisibleIdx);
                        }
                    }
                });
            }
        },
        onOutside: (e, perimeterCircle) => {
            // L'utilisateur est hors zone : on montre juste le cercle
            map.setView(perimeterCenter, 18);
            // La position de l'utilisateur est affichée par le plugin
        },
        onDenied: (e, perimeterCircle) => {
            // L'utilisateur refuse la localisation : on montre juste le cercle
            map.setView(perimeterCenter, 18);
        }
    });
    // Gestion du bouton dark mode (toggle + icône dynamique)
    const darkModeBtn = document.getElementById('dark-mode-toggle');
    if (darkModeBtn) {
        darkModeBtn.addEventListener('click', () => {
            toggleTheme();
            let img = darkModeBtn.querySelector('img');
            if (!img) {
                img = document.createElement('img');
                img.style.width = '24px';
                img.style.height = '24px';
                darkModeBtn.appendChild(img);
            }
            img.src = document.body.classList.contains('dark-mode') ? '/images/light-icon.svg' : '/images/dark-icon.svg';
            img.alt = document.body.classList.contains('dark-mode') ? 'Mode clair' : 'Mode sombre';
        });
        // Met à jour l'icône au chargement et lors des changements de thème
        const updateBtnIcon = () => {
            let img = darkModeBtn.querySelector('img');
            if (!img) {
                img = document.createElement('img');
                img.style.width = '24px';
                img.style.height = '24px';
                darkModeBtn.appendChild(img);
            }
            img.src = document.body.classList.contains('dark-mode') ? '/images/light-icon.svg' : '/images/dark-icon.svg';
            img.alt = document.body.classList.contains('dark-mode') ? 'Mode clair' : 'Mode sombre';
        };
        updateBtnIcon();
        onThemeChange(updateBtnIcon);
    }
});

// Stockage global des segments d'itinéraire par étage
window.routeSegmentsByEtage = [];
window.currentRouteStart = null;
window.currentRouteEnd = null;
window.currentRouteStartIdx = null;
window.currentRouteEndIdx = null;

// Stockage des marqueurs par étage
window.departMarkerByEtage = [];
window.arriveeMarkerByEtage = [];

// Icônes personnalisés pour les marqueurs de départ et d'arrivée
const departIcon = L.icon({
    iconUrl: "./images/start-icon.svg",
    iconSize: [15, 15], // size of the icon
    iconAnchor: [7.5, 7.5], // point of the icon which will correspond to marker's location
    popupAnchor: [0, -10], // point from which the popup should open relative to the iconAnchor
});
const arriveeIcon = L.icon({
    iconUrl: '/images/end-icon.svg',
    iconSize: [15, 15], // size of the icon
    iconAnchor: [7.5, 7.5], // point of the icon which will correspond to marker's location
    popupAnchor: [0, -10], // point from which the popup should open relative
});

// Ajout d'une gestion dynamique du fond de carte par étage et par thème
let currentBaseLayer = null;
let currentEtageIdx = 0;
function setBackgroundForEtage(idx) {
    const etage = ETAGES[idx];
    if (!etage || !etage.backgroundUrl) return;
    if (currentBaseLayer) {
        map.removeLayer(currentBaseLayer);
    }
    const theme = getCurrentTheme() || THEMES.LIGHT;
    const url = etage.backgroundUrl[theme] || etage.backgroundUrl.light;
    currentBaseLayer = L.tileLayer(url, {
        maxZoom: 23,
        attribution: '© OpenStreetMap'
    });
    currentBaseLayer.addTo(map);
    currentEtageIdx = idx;
}
// Initialisation avec le fond du premier étage
setBackgroundForEtage(0);

// Réagit au changement de thème pour changer le fond de carte
onThemeChange(() => {
    setBackgroundForEtage(currentEtageIdx);
});

// Ajoute un listener sur le changement de baseLayer pour afficher les bons segments et marqueurs
map.on('baselayerchange', function (e) {
    const idx = batimentLayers.findIndex(l => l === e.layer);
    if (idx !== -1) {
        setBackgroundForEtage(idx);
        updateRouteDisplay(map, window.routeSegmentsByEtage, window.departMarkerByEtage, window.arriveeMarkerByEtage, idx);
    }
});

// Synchronise le fond de carte personnalisé avec le layer GeoJSON d'étage affiché (utile pour la recherche)
map.on('layeradd', function (e) {
    const idx = batimentLayers.findIndex(l => l === e.layer);
    if (idx !== -1) {
        setBackgroundForEtage(idx);
        updateRouteDisplay(map, window.routeSegmentsByEtage, window.departMarkerByEtage, window.arriveeMarkerByEtage, idx);
    }
});

// Après le chargement des layers et de la localisation
// Déplace le control layer dans le conteneur custom
setTimeout(() => {
    const leafletLayerControl = document.querySelector('.leaflet-control-layers');
    const customLayerControl = document.getElementById('custom-layer-control');
    if (leafletLayerControl && customLayerControl && !customLayerControl.hasChildNodes()) {
        customLayerControl.appendChild(leafletLayerControl);
    }
    // Déplace le bouton locate dans le conteneur custom
    const leafletLocate = document.querySelector('.leaflet-control-locate');
    const customLocateBtn = document.getElementById('custom-locate-btn');
    if (leafletLocate && customLocateBtn && !customLocateBtn.hasChildNodes()) {
        customLocateBtn.appendChild(leafletLocate);
    }
}, 500);
