import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // Importante: asegura que todas las rutas sean absolutas
  server: {
    port: 5180, // Puerto exclusivo para Construcción
    strictPort: true,
    host: true,
    proxy: {
      // Redirige las llamadas a /api hacia el backend Flask en 5001
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  preview: {
    port: 5180,
    strictPort: true,
    host: true,
    allowedHosts: [
      'produccionsomyl2026-production.up.railway.app',
      'moduloconstruccion-production.up.railway.app'
    ]
  }
})