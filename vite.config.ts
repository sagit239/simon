import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

// Matches the GitHub Pages project site path (sagit239.github.io/simon/).
const base = '/simon/';

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      // A new version waits and loads on the next visit; no forced reload, no update dialog.
      registerType: 'prompt',
      // Registration lives in src/app/pwa.ts.
      injectRegister: false,
      manifest: {
        id: base,
        name: 'סיימון',
        short_name: 'סיימון',
        description: 'משחק זיכרון של רצף אורות וצלילים',
        lang: 'he',
        dir: 'rtl',
        display: 'standalone',
        start_url: base,
        scope: base,
        theme_color: '#F5F5F2',
        background_color: '#F5F5F2',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        cacheId: 'simon',
        // Modern browsers only load the woff2 font files, so woff is left out. The manifest is added by the plugin.
        globPatterns: ['**/*.{html,js,css,woff2,png,svg,ico}'],
        navigateFallback: 'index.html',
        navigateFallbackAllowlist: [/^\/simon\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
