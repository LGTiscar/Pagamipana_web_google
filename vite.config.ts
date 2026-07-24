import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Las variables VITE_* se exponen automáticamente vía import.meta.env.
export default defineConfig({
  plugins: [react()],
});
