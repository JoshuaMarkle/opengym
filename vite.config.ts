/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

// Relative base + hash routing: the build works from any path on any static host
// (Cloudflare Pages, GitHub Pages, a sub-folder on your own domain) with no rewrites.
export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon-180.png'],
      manifest: {
        id: './',
        name: 'OpenGym',
        short_name: 'OpenGym',
        description: 'A free, offline-first lifting log. Your data stays on your phone.',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#000000',
        theme_color: '#000000',
        categories: ['health', 'fitness', 'sports'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // The food database (≈1 MB gzipped) and the barcode decoder load on first use, not at
        // install; once fetched they stay cached so both work offline (nutrition-plan §3.8).
        runtimeCaching: [
          {
            urlPattern: /\/foods\/usda-.*\.json$/,
            handler: 'CacheFirst',
            options: { cacheName: 'og-foods', expiration: { maxEntries: 2 } },
          },
          {
            urlPattern: /\.wasm$/,
            handler: 'CacheFirst',
            options: { cacheName: 'og-wasm', expiration: { maxEntries: 4 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        // Libraries change rarely; keeping them in their own chunk means app updates
        // re-download less, and no single chunk trips the size warning.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/ },
            // zxing-wasm stays out: the scanner loads it the first time you scan.
            { name: 'vendor', test: /node_modules[\\/](?!zxing-wasm)/ },
          ],
        },
      },
    },
  },
  server: { host: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
});
