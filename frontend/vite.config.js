import { defineConfig } from 'vite'

export default defineConfig({
    base: '/app/',
    server: {
        proxy: {
            '/geojson': {
                target: 'http://localhost:3000',
                changeOrigin: true
            },
            '/config': {
                target: 'http://localhost:3000',
                changeOrigin: true
            },
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true
            }
        }
    }
})
