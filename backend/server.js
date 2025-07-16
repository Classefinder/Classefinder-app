const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// CORS pour permettre au frontend local d'accéder aux geojson
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
});

// Servir les fichiers geojson
app.use('/geojson', express.static(path.join(__dirname, 'geojson')));

app.listen(PORT, () => {
    console.log(`Serveur backend en écoute sur http://localhost:${PORT}`);
});
