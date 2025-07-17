// Fonctions utilitaires pour les coordonnées et calculs géographiques
export function getLineCenter(coords) {
    let lat = 0, lng = 0;
    coords.forEach(c => {
        lng += c[0];
        lat += c[1];
    });
    lat /= coords.length;
    lng /= coords.length;
    return [lat, lng];
}
