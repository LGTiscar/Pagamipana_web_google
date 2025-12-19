import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Ya no definimos process.env.API_KEY aquí para el frontend.
  // El frontend ahora llama a /api/parse-receipt que es donde vivirá la clave.
  server: {
    proxy: {
      // Configuración para desarrollo local: redirige las llamadas a /api al servidor de funciones
      '/api': {
        target: 'http://localhost:3001', // O el puerto donde corras tus funciones locales
        changeOrigin: true,
      }
    }
  }
});