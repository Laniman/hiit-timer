import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * `./` keeps assets, the manifest, and the service worker relative to the page.
 * On GitHub Pages set BASE_PATH to `/<repository>/` so the worker scope matches the project site.
 */
function resolveBase(value: string | undefined): string {
  if (!value || value === '.' || value === './') return './'
  const withLeading = value.startsWith('/') || value.startsWith('./') ? value : `/${value}`
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`
}

const base = resolveBase(process.env.BASE_PATH)

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Simple HIIT Timer',
        short_name: 'HIIT Timer',
        description: 'Minimal offline HIIT interval timer',
        theme_color: '#132338',
        background_color: '#132338',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'en',
        categories: ['health', 'fitness'],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
