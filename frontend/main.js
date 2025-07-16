// Configuration des calques (modulable)
const LAYER_CONFIG = [
    { name: 'Calque 1', url: 'http://localhost:3000/geojson/layer1.geojson' },
    { name: 'Calque 2', url: 'http://localhost:3000/geojson/layer2.geojson' },
    { name: 'Calque 3', url: 'http://localhost:3000/geojson/layer3.geojson' },
    { name: 'Calque 2', url: 'http://localhost:3000/geojson/layer4.geojson' },
    { name: 'Calque 3', url: 'http://localhost:3000/geojson/layer5.geojson' }
];

const map = L.map('map').setView([48.8566, 2.3522], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(map);

const layerControl = L.control.layers(null, null, { collapsed: false }).addTo(map);
const geoJsonLayers = {};
const searchLayers = [];

// Chargement dynamique des calques
LAYER_CONFIG.forEach((layerCfg, idx) => {
    fetch(layerCfg.url)
        .then(res => res.json())
        .then(data => {
            const geoJsonLayer = L.geoJSON(data, {
                onEachFeature: (feature, layer) => {
                    if (feature.properties && feature.properties.name) {
                        layer.bindPopup(feature.properties.name);
                    }
                }
            });
            // Utilise un nom unique pour chaque calque
            const uniqueName = layerCfg.name + ' (' + (idx + 1) + ')';
            geoJsonLayers[uniqueName] = geoJsonLayer;
            layerControl.addBaseLayer(geoJsonLayer, uniqueName);
            searchLayers.push(geoJsonLayer);
            // Affiche le premier calque par défaut
            if (Object.keys(geoJsonLayers).length === 1) {
                geoJsonLayer.addTo(map);
            }
        });
});

// Ajout du contrôle de recherche après chargement de tous les calques
setTimeout(() => {
    const searchCtrl = new L.Control.Search({
        layer: L.featureGroup(searchLayers),
        propertyName: 'name',
        initial: false,
        zoom: 16,
        marker: false
    });
    map.addControl(searchCtrl);

    // Quand une recherche trouve une feature, active le calque correspondant
    searchCtrl.on('search:locationfound', function (e) {
        let foundLayer = null;
        // On cherche le calque qui contient une feature avec le même nom
        for (const [name, layer] of Object.entries(geoJsonLayers)) {
            let match = false;
            layer.eachLayer(l => {
                if (l.feature && l.feature.properties && e.layer.feature && l.feature.properties.name === e.layer.feature.properties.name) {
                    match = true;
                }
            });
            if (match) {
                foundLayer = layer;
                break;
            }
        }
        if (foundLayer && !map.hasLayer(foundLayer)) {
            Object.values(geoJsonLayers).forEach(l => map.removeLayer(l));
            foundLayer.addTo(map);
        }
    });
}, 1000);
