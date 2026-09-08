import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo el frontend corre en :5173 y la API en :8000. El proxy permite
// que el codigo llame siempre a rutas relativas (/api/...), igual que en
// produccion detras de nginx.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
