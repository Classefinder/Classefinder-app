// Configuration dynamique des étages
const ETAGES = [
    {
        nom: "Etage 1",
        cheminUrl: "http://localhost:3000/geojson/chemin_etage1.geojson",
        batimentUrl: "http://localhost:3000/geojson/batiment_etage1.geojson"
    },
    {
        nom: "Etage 2",
        cheminUrl: "http://localhost:3000/geojson/chemin_etage1.geojson",
        batimentUrl: "http://localhost:3000/geojson/batiment_etage1.geojson"
    },
    // Ajoute ici d'autres étages si besoin
];

const map = L.map('map').setView([48.8566, 2.3522], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
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

// Ajout du contrôle de recherche sur tous les bâtiments de tous les étages
setTimeout(() => {
    // Fusionne toutes les features de tous les étages pour la recherche
    const allBatimentLayers = L.featureGroup(batimentLayers);
    const searchCtrl = new L.Control.Search({
        layer: allBatimentLayers,
        propertyName: 'name',
        initial: false,
        zoom: 16,
        marker: false
    });
    map.addControl(searchCtrl);

    // Lorsqu'on trouve un bâtiment, place le départ sur le chemin correspondant et zoome sur le bâtiment
    searchCtrl.on('search:locationfound', function (e) {
        // Trouve l'étage et la feature bâtiment
        let etageIdx = -1;
        let batFeature = null;
        batimentFeatures.forEach((features, idx) => {
            features.forEach(obj => {
                if (obj.feature.properties.name === e.layer.feature.properties.name) {
                    etageIdx = idx;
                    batFeature = obj;
                }
            });
        });
        if (etageIdx !== -1) {
            // Cherche le chemin correspondant (nom = 'Chemin ' + nom du bâtiment)
            const cheminName = 'Chemin ' + e.layer.feature.properties.name;
            const cheminObj = cheminFeatures[etageIdx] && cheminFeatures[etageIdx].find(obj => obj.feature.properties.name === cheminName);
            if (cheminObj) {
                // Place un marqueur sur le chemin
                if (window.departMarker) map.removeLayer(window.departMarker);
                window.departMarker = L.marker(cheminObj.feature.geometry.coordinates.slice().reverse()).addTo(map);
                window.departMarker.bindPopup('Départ : ' + cheminName).openPopup();
            }
            // Affiche/zoome sur la forme du bâtiment
            if (!map.hasLayer(batimentLayers[etageIdx])) {
                batimentLayers.forEach(l => map.removeLayer(l));
                batimentLayers[etageIdx].addTo(map);
            }
            map.fitBounds(e.layer.getBounds());
        }
    });
}, 1000);
