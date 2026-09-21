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
      // NOT 'autoUpdate': that mode force-calls `window.location.reload()`
      // the instant a new service worker activates, with no regard for
      // anything in flight -- and in dev mode specifically, the generated
      // service worker embeds a fresh random revision on every single
      // `npm run dev` process start, so a plain server restart looks like
      // a brand-new deploy to any tab still open from before. That reload
      // firing mid-request (e.g. mid-way through the slow "Parse Rules"
      // or "Attach PDF" calls) is what surfaces as a network error plus
      // an unexplained page refresh. 'prompt' still installs updates in
      // the background, but a new worker only ever activates if something
      // calls the `updateSW()` function `virtual:pwa-register` returns --
      // nothing in this app does, so it simply never force-reloads you.
      registerType: 'prompt',
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
    port: 5173,
  },
  preview: {
    // Same host+port as `server` above, on purpose: `npm run preview`
    // (a production build) is what actually gives reliable offline PWA
    // caching — `npm run dev`'s service worker can't precache its
    // on-the-fly unbundled modules the way a real build's fingerprinted
    // bundle lets it. Keeping the same origin means switching between
    // `npm run dev` (to add new content — its local /api/* endpoints only
    // exist there) and `npm run preview` (to read what's already cached,
    // reliably, even offline) doesn't lose anything: localStorage and
    // IndexedDB are scoped per-origin, and a different port would count
    // as a different origin with its own empty storage.
    host: true,
    port: 5173,
  },
})
