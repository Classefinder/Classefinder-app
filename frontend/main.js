// Configuration dynamique des étages
const ETAGES = [
    {
        nom: "Etage 0",
        cheminUrl: "http://localhost:3000/geojson/chemins_etage0.geojson",
        batimentUrl: "http://localhost:3000/geojson/salles_etage0.geojson"
    },
    {
        nom: "Etage 1",
        cheminUrl: "http://localhost:3000/geojson/chemins_etage1.geojson",
        batimentUrl: "http://localhost:3000/geojson/salles_etage1.geojson"
    },
    {
        nom: "Etage 2",
        cheminUrl: "http://localhost:3000/geojson/chemins_etage2.geojson",
        batimentUrl: "http://localhost:3000/geojson/salles_etage2.geojson"
    },
];

const map = L.map('map').setView([48.8566, 2.3522], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 23,
    attribution: '© OpenStreetMap'
}).addTo(map);

const layerControl = L.control.layers(null, null, { collapsed: false }).addTo(map);

// Stockage des couches et features par étage
const batimentLayers = [];
const batimentFeatures = [];
const cheminFeatures = [];

// Chargement dynamique des calques pour chaque étage
ETAGES.forEach((etage, idx) => {
    // Calque chemin (jamais affiché, ni dans le control layer)
    fetch(etage.cheminUrl)
        .then(res => res.json())
        .then(data => {
            const features = [];
            L.geoJSON(data, {
                onEachFeature: (feature, layer) => {
                    features.push({ feature, layer });
                }
            });
            cheminFeatures[idx] = features;
        });

    // Calque batiment (affiché dans le control layer)
    fetch(etage.batimentUrl)
        .then(res => res.json())
        .then(data => {
            const features = [];
            const batLayer = L.geoJSON(data, {
                onEachFeature: (feature, layer) => {
                    features.push({ feature, layer });
                    if (feature.properties && feature.properties.name) {
                        layer.bindPopup(feature.properties.name);
                    }
                }
            });
            batimentLayers[idx] = batLayer;
            batimentFeatures[idx] = features;
            layerControl.addBaseLayer(batLayer, etage.nom);
            // Affiche le premier étage par défaut
            if (idx === 0) {
                batLayer.addTo(map);
            }
        });
});

// On attend que tous les calques soient chargés avant d'initialiser les barres de recherche
Promise.all([
    ...ETAGES.map((etage, idx) => fetch(etage.batimentUrl).then(res => res.json())),
]).then(() => {
    // Ajout du contrôle de recherche sur tous les bâtiments de tous les étages (pour le départ)
    let depart = null;
    let departEtageIdx = null;
    const allBatimentLayers = L.featureGroup(batimentLayers);
    const searchCtrlDepart = new L.Control.Search({
        layer: allBatimentLayers,
        propertyName: 'name',
        initial: false,
        zoom: 16,
        marker: false,
        textPlaceholder: 'Départ...'
    });
    map.addControl(searchCtrlDepart);

    searchCtrlDepart.on('search:locationfound', function (e) {
        // Trouve l'étage et la feature bâtiment
        let etageIdx = -1;
        batimentFeatures.forEach((features, idx) => {
            features.forEach(obj => {
                if (obj.feature.properties.name === e.layer.feature.properties.name) {
                    etageIdx = idx;
                }
            });
        });
        if (etageIdx !== -1) {
            // Cherche la feature du chemin avec le même nom
            const cheminObj = cheminFeatures[etageIdx] && cheminFeatures[etageIdx].find(obj => obj.feature.properties.name === e.layer.feature.properties.name);
            if (cheminObj) {
                if (window.departMarker) map.removeLayer(window.departMarker);
                // Si c'est une ligne, place le marqueur sur le premier point ou au centre
                let markerCoords;
                if (cheminObj.feature.geometry.type === 'LineString') {
                    const coords = cheminObj.feature.geometry.coordinates;
                    // Option 1 : premier point
                    markerCoords = [coords[0][1], coords[0][0]];
                    // Option 2 : centre de la ligne (décommente si tu préfères)
                    // const lat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;
                    // const lng = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
                    // markerCoords = [lat, lng];
                } else if (cheminObj.feature.geometry.type === 'Point') {
                    markerCoords = cheminObj.feature.geometry.coordinates.slice().reverse();
                }
                if (markerCoords) {
                    window.departMarker = L.marker(markerCoords).addTo(map);
                    window.departMarker.bindPopup('Départ : ' + e.layer.feature.properties.name).openPopup();
                    depart = markerCoords;
                    departEtageIdx = etageIdx;
                }
            }
            if (!map.hasLayer(batimentLayers[etageIdx])) {
                batimentLayers.forEach(l => map.removeLayer(l));
                batimentLayers[etageIdx].addTo(map);
            }
            map.fitBounds(e.layer.getBounds());
        }
    });

    // Ajout du contrôle de recherche sur tous les bâtiments de tous les étages (pour l'arrivée)
    let arrivee = null;
    let arriveeEtageIdx = null;
    const searchCtrlArrivee = new L.Control.Search({
        layer: allBatimentLayers,
        propertyName: 'name',
        initial: false,
        zoom: 16,
        marker: false,
        textPlaceholder: 'Arrivée...'
    });
    map.addControl(searchCtrlArrivee);

    searchCtrlArrivee.on('search:locationfound', function (e) {
        // Trouve l'étage et la feature bâtiment
        let etageIdx = -1;
        batimentFeatures.forEach((features, idx) => {
            features.forEach(obj => {
                if (obj.feature.properties.name === e.layer.feature.properties.name) {
                    etageIdx = idx;
                }
            });
        });
        if (etageIdx !== -1) {
            const cheminObj = cheminFeatures[etageIdx] && cheminFeatures[etageIdx].find(obj => obj.feature.properties.name === e.layer.feature.properties.name);
            if (cheminObj) {
                if (window.arriveeMarker) map.removeLayer(window.arriveeMarker);
                let markerCoords;
                if (cheminObj.feature.geometry.type === 'LineString') {
                    const coords = cheminObj.feature.geometry.coordinates;
                    markerCoords = [coords[0][1], coords[0][0]];
                } else if (cheminObj.feature.geometry.type === 'Point') {
                    markerCoords = cheminObj.feature.geometry.coordinates.slice().reverse();
                }
                if (markerCoords) {
                    window.arriveeMarker = L.marker(markerCoords).addTo(map);
                    window.arriveeMarker.bindPopup('Arrivée : ' + e.layer.feature.properties.name).openPopup();
                    arrivee = markerCoords;
                    arriveeEtageIdx = etageIdx;
                }
            }
            if (!map.hasLayer(batimentLayers[etageIdx])) {
                batimentLayers.forEach(l => map.removeLayer(l));
                batimentLayers[etageIdx].addTo(map);
            }
            map.fitBounds(e.layer.getBounds());
        }
        if (depart && arrivee) {
            getRouteAndPoints(depart, arrivee, [window.departMarker, window.arriveeMarker], batimentLayers, departEtageIdx, arriveeEtageIdx);
        }
    });
});

// Fonction pour récupérer et filtrer les segments
function getRouteAndPoints(start, end, markers, layersEtages, departIdx, arriveeIdx) {
    // Nettoie les anciens itinéraires
    if (window.routeLines) {
        window.routeLines.forEach(l => map.removeLayer(l));
    }
    window.routeLines = [];

    var osrmUrl = `https://classefinder.duckdns.org/osrm/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?steps=true&geometries=geojson&overview=full`;

    fetch(osrmUrl)
        .then(response => response.json())
        .then(data => {
            if (data.routes && data.routes.length > 0) {
                var route = data.routes[0];
                // Affiche la ligne complète (optionnel)
                // var routeLine = L.polyline(routeCoordinates, { color: 'blue' }).addTo(map);
                // window.routeLines.push(routeLine);

                // Découpe et affiche chaque segment sur le bon étage
                route.legs[0].steps.forEach((step, index) => {
                    var startName = step.name || "";
                    var endName = (route.legs[0].steps[index + 1] || {}).name || "";
                    var segment = {
                        type: "Feature",
                        geometry: {
                            type: "LineString",
                            coordinates: step.geometry.coordinates
                        },
                        properties: {
                            name: startName
                        }
                    };
                    // Logique d'étage : si le nom contient "1" -> étage 1, "2" -> étage 2, etc.
                    for (let i = 0; i < layersEtages.length; i++) {
                        if (startName.includes((i + 1).toString()) || endName.includes((i + 1).toString())) {
                            var seg = L.geoJSON(segment, { color: 'red' }).addTo(map);
                            window.routeLines.push(seg);
                        }
                    }
                });
                // Centrer la carte sur l'itinéraire
                map.fitBounds(L.latLngBounds([start, end]));
            } else {
                console.error('Aucune route trouvée');
            }
        })
        .catch(error => {
            console.error('Erreur lors de la récupération de l\'itinéraire:', error);
        });
}
