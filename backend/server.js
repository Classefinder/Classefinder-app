
const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 3000;

// CORS pour permettre au frontend local d'accéder aux geojson
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
});

// Servir les fichiers geojson
app.use('/geojson', express.static(path.join(__dirname, 'geojson')));

// Vérifier si le dossier frontend/dist existe
const frontendDistPath = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
    // Servir les fichiers statiques du frontend
    app.use(express.static(frontendDistPath));

    // Fallback SPA : servir index.html pour toute route non API/geojson
    app.use((req, res, next) => {
        // Ne pas interférer avec les routes API ou geojson
        if (req.path.startsWith('/geojson')) return next();
        // Si la requête est pour une ressource existante, laisser express.static gérer
        const filePath = path.join(frontendDistPath, req.path);
        if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
            return res.sendFile(filePath);
        }
        // Sinon, servir index.html
        res.sendFile(path.join(frontendDistPath, 'index.html'));
    });
    console.log('Le serveur sert aussi le frontend depuis /frontend/dist');
}

app.listen(PORT, () => {
    console.log(`Serveur backend en écoute sur http://localhost:${PORT}`);
});
