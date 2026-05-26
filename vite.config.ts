import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Poker Settler',
        short_name: 'Poker',
        description: 'Rozlicz pokera ze znajomymi błyskawicznie',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#052e16',
        theme_color: '#052e16',
        orientation: 'portrait',
        lang: 'pl',
        icons: [
          { src: 'icon.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: 'icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // Bypass Supabase API/Realtime entirely — always go to network.
            urlPattern: /^https:\/\/[a-z0-9]+\.supabase\.co\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          supabase: ['@supabase/supabase-js'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
