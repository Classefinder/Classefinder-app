// Module pour la gestion des thèmes
import { initThemeManager, getCurrentTheme, onThemeChange } from './themeManager.js';

export function setupTheme(map, UNIVERSAL_BASE_URLS) {
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

    initThemeManager();
    setUniversalBaseLayer(getCurrentTheme());
    onThemeChange(setUniversalBaseLayer);
}
