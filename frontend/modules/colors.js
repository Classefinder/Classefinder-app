// ======= Couleurs de base ======= //
// Modifie ici pour changer la couleur de base (ex: bleu par défaut)
export const BASE_HUE = 220;   // 220 = bleu, 0 = rouge, 120 = vert, etc.
export const BASE_SAT = 70;    // Saturation de base (0–100)
export const BASE_LIGHT = 55;  // Luminosité de base (0–100)

// Modifie ici pour changer la couleur de l’itinéraire (ex: rouge par défaut)
export const ROUTE_HUE = 0;
export const ROUTE_SAT = 80;
export const ROUTE_LIGHT = 40;

/**
 * Génère une couleur HSL à partir de la couleur de base,
 * en créant des variantes monochromes selon l’index.
 */
export function getBaseColorByIndex(idx, total, baseHue = BASE_HUE, baseSat = BASE_SAT, baseLight = BASE_LIGHT) {
    const variation = total > 1 ? idx / (total - 1) : 0;

    // Tu peux ajuster ces plages selon l’effet désiré :
    const sat = baseSat - 20 + variation * 40;    // Ex: de 50% à 90%
    const light = baseLight - 20 + variation * 40; // Ex: de 35% à 75%

    return `hsl(${baseHue}, ${sat}%, ${light}%)`;
}

/**
 * Variante pour les itinéraires (ex: par étage, segment, etc.)
 */
export function getRouteColorByIndex(idx, total, routeHue = ROUTE_HUE, routeSat = ROUTE_SAT, routeLight = ROUTE_LIGHT) {
    const variation = total > 1 ? idx / (total - 1) : 0;

    const sat = routeSat - 20 + variation * 40;
    const light = routeLight - 20 + variation * 40;

    return `hsl(${routeHue}, ${sat}%, ${light}%)`;
}
