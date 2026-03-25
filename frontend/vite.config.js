// PATH: frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy /api calls to FastAPI backend during development
    proxy: {
      '/agents':    { target: 'http://localhost:8000', changeOrigin: true },
      '/tools':     { target: 'http://localhost:8000', changeOrigin: true },
      '/llm':       { target: 'http://localhost:8000', changeOrigin: true },
      '/tasks':     { target: 'http://localhost:8000', changeOrigin: true },
      '/task-runs': { target: 'http://localhost:8000', changeOrigin: true },
      '/dashboard': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})