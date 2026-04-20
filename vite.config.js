import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                westside: resolve(__dirname, 'westside/index.html'),
                westsideDashboard: resolve(__dirname, 'westside/dashboard.html'),
                aviation: resolve(__dirname, 'aviation/index.html'),
                burbuja: resolve(__dirname, 'burbuja/index.html'),
                burbujaDashboard: resolve(__dirname, 'burbuja/dashboard.html'),
            },
        },
    },
})
