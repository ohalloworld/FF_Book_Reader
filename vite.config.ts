import react from '@vitejs/plugin-react'
import 'dotenv/config'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { bookTranscriptionPlugin } from './server/bookTranscriptionPlugin.js'
import { rulesApiPlugin } from './server/rulesApiPlugin.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    rulesApiPlugin(),
    bookTranscriptionPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      // Enabled in dev too, so "Add to Home Screen" works straight from
      // `npm run dev` over the LAN — no separate production build needed.
      devOptions: { enabled: true },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'FF Book Reader',
        short_name: 'FF Reader',
        description: 'An interactive gamebook reading and playing tool.',
        theme_color: '#8b1e1e',
        background_color: '#f6efe3',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    // Bind to the LAN, not just localhost, so a phone on the same WiFi can
    // open this dev server too (Vite prints the Network URL to use).
    host: true,
  },
})
