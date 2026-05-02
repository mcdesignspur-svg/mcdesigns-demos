import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                westside: resolve(__dirname, 'westside/index.html'),
                westsideDashboard: resolve(__dirname, 'westside/dashboard.html'),
                westsideContent: resolve(__dirname, 'westside/content.html'),
                westsideCalendar: resolve(__dirname, 'westside/calendar.html'),
                aviation: resolve(__dirname, 'aviation/index.html'),
                aviationDashboard: resolve(__dirname, 'aviation/dashboard.html'),
                aviationEmailParse: resolve(__dirname, 'aviation/email-parse.html'),
                burbuja: resolve(__dirname, 'burbuja/index.html'),
                burbujaDashboard: resolve(__dirname, 'burbuja/dashboard.html'),
                eco: resolve(__dirname, 'eco/index.html'),
                ecoBuilder: resolve(__dirname, 'eco/builder.html'),
                ecoStudio: resolve(__dirname, 'eco/studio.html'),
                prototypesWestside: resolve(__dirname, 'prototypes/westside/index.html'),
            },
        },
    },
})
