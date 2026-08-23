import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'BasBuddy',
        short_name: 'BasBuddy',
        description: 'Live transit tracker for buses and rail across Malaysia.',
        theme_color: '#F4A100',        // Mango Peel (§11)
        background_color: '#101B2D',   // Harbour Navy (§11)
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cache the API shell (HTML/CSS/JS) for offline load — but NOT live bus data.
        // The app should still open offline; it just won't show live ETAs.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Don't cache API responses — always go to network for live data
            urlPattern: /\/api\//,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      // Proxy /api calls to the backend during development
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@basbuddy/shared': new URL('../shared/src/index.ts', import.meta.url).pathname,
    },
  },
});
