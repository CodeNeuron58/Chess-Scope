import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves the site under /<repo>/; set BASE_PATH there (see .github/workflows/deploy.yml)
  base: process.env.BASE_PATH ?? '/',
  define: { __APP_VERSION__: JSON.stringify(version) },
})
