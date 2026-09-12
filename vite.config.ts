import react from '@vitejs/plugin-react'
import 'dotenv/config'
import { defineConfig } from 'vite'
import { rulesApiPlugin } from './server/rulesApiPlugin.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), rulesApiPlugin()],
})
