import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180, // Puerto exclusivo para Construcción
    strictPort: true,
    host: true,
    proxy: {
      // Redirige las llamadas a /api hacia el backend Flask en 5001
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  preview: {
    port: 5180,
    strictPort: true,
    host: true,
    allowedHosts: ['moduloconstruccion-production.up.railway.app']
  }
})