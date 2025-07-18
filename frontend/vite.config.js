import { defineConfig } from 'vite'

export default defineConfig({
    server: {
        proxy: {
            '/geojson': {
                target: 'http://localhost:3000',
                changeOrigin: true
            }
        }
    }
})
