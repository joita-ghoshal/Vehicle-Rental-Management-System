import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The Python API runs on port 8000. The proxy lets the browser call "/api/..."
// on the same address as the website, so no cross-origin setup is needed.
export default defineConfig({
  plugins: [react()],
  base: '/Vehicle-Rental-Management-System/',
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
})
