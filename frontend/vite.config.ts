/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // Not needed for unit tests (and it would build the service worker on every run).
    process.env.VITEST
      ? null
      : // Installable app + service worker (src-sw/sw.ts): offline app shell and push notifications.
        VitePWA({
          strategies: 'injectManifest',
          srcDir: 'src-sw',
          filename: 'sw.ts',
          registerType: 'prompt',
          injectRegister: false,
          injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
          includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png', 'icons/badge-96.png'],
          manifest: {
            id: '/',
            name: 'Hearth — your day and your family',
            short_name: 'Hearth',
            description: 'Your own schedule, your family’s shared tasks, chat, health notes and papers in one place.',
            start_url: '/today',
            scope: '/',
            display: 'standalone',
            orientation: 'portrait-primary',
            background_color: '#F6F3EE',
            theme_color: '#3C739C',
            lang: 'en',
            categories: ['productivity', 'lifestyle'],
            icons: [
              { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
              { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
              { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            ],
            shortcuts: [
              { name: 'My day', url: '/today', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
              { name: 'New task', url: '/tasks/new', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
              { name: 'Family chat', url: '/chat', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
            ],
          },
          devOptions: { enabled: false },
        }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    alias: { 'virtual:pwa-register': fileURLToPath(new URL('./src/test/pwa-register.ts', import.meta.url)) },
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/mocks/**', 'src/main.tsx', 'src/vite-env.d.ts'],
      reporter: ['text-summary', 'html', 'lcov'],
    },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 3000 },
  preview: { port: 4173 },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
