// frontend/modules/themeManager.js
// Gère le thème (clair/sombre) de façon automatique et modulaire

const THEME_LIGHT = 'light';
const THEME_DARK = 'dark';
const THEME_AUTO = 'auto';

let currentTheme = null; // 'light' | 'dark'
let userOverride = null; // null | 'light' | 'dark'
let onThemeChangeCallbacks = [];

function detectSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? THEME_DARK : THEME_LIGHT;
}

function applyTheme(theme) {
    document.body.classList.remove('light-mode', 'dark-mode');
    if (theme === THEME_DARK) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.add('light-mode');
    }
    currentTheme = theme;
    onThemeChangeCallbacks.forEach(cb => cb(theme));
}

function handleSystemThemeChange(e) {
    if (!userOverride) {
        const newTheme = e.matches ? THEME_DARK : THEME_LIGHT;
        applyTheme(newTheme);
    }
}

export function initThemeManager() {
    // Vérifie si l'utilisateur a forcé un thème précédemment (localStorage)
    userOverride = localStorage.getItem('theme-override');
    if (userOverride !== THEME_DARK && userOverride !== THEME_LIGHT) {
        userOverride = null;
        localStorage.removeItem('theme-override');
    }
    let initialTheme;
    if (userOverride === THEME_DARK || userOverride === THEME_LIGHT) {
        initialTheme = userOverride;
    } else {
        initialTheme = detectSystemTheme();
    }
    applyTheme(initialTheme);
    // Debug : log le thème détecté
    console.log('[themeManager] Thème initial appliqué :', initialTheme, '| Override:', userOverride);
    // Écoute les changements système
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', handleSystemThemeChange);
}

export function getCurrentTheme() {
    return currentTheme;
}

export function onThemeChange(callback) {
    if (typeof callback === 'function') {
        onThemeChangeCallbacks.push(callback);
    }
}

export function toggleTheme() {
    // Si override, on repasse en auto
    if (userOverride) {
        userOverride = null;
        localStorage.removeItem('theme-override');
        applyTheme(detectSystemTheme());
    } else {
        // Force le thème opposé à celui du système
        const forced = detectSystemTheme() === THEME_DARK ? THEME_LIGHT : THEME_DARK;
        userOverride = forced;
        localStorage.setItem('theme-override', forced);
        applyTheme(forced);
    }
}

export const THEMES = { LIGHT: THEME_LIGHT, DARK: THEME_DARK, AUTO: THEME_AUTO };
