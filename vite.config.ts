import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
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
          // PNG first for browsers that pick the first usable entry (older
          // Android Chrome splash, iOS install icon). SVG kept as a
          // resolution-independent fallback.
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
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
    // Per-file: use //@vitest-environment jsdom to opt into DOM in component
    // tests. Default stays 'node' so pure-logic tests run fast.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
