import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFile } from 'node:fs/promises'
import { resolve } from 'node:path'

function pagesFallback() {
  let output
  return {
    name: 'zelvora-pages-fallback',
    apply: 'build',
    configResolved(config) { output = resolve(config.root, config.build.outDir) },
    async closeBundle() {
      // Pages serves this shell at a deep URL. Absolute BASE_URL asset paths
      // and BrowserRouter's basename let React render it without a redirect.
      // The host still returns HTTP 404; a true 200 SPA rewrite is hosting work.
      await copyFile(resolve(output, 'index.html'), resolve(output, '404.html'))
    },
  }
}

export default defineConfig(({ mode }) => {
  // VITE_BASE=/ is used by the single-origin Docker/Render build. The default
  // keeps the existing GitHub Pages project path working.
  const env = loadEnv(mode, process.cwd(), '')
  const base = (env.VITE_BASE || '/Vehicle-Rental-Management-System/').replace(/\/?$/, '/')
  const proxy = { '/api': { target: env.VITE_PROXY_TARGET || 'http://127.0.0.1:8000', changeOrigin: true } }

  // The Python API runs on port 8000. The proxy lets the browser call "/api/..."
  // on the same address as the website, so no cross-origin setup is needed.
  return {
    plugins: [react(), pagesFallback()],
    base,
    server: {
      host: '127.0.0.1',
      port: 5173,
      proxy,
    },
    preview: { host: '127.0.0.1', port: 4173, proxy },
  }
})
