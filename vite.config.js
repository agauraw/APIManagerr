import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// vite.config.js intentionally uses ESM syntax (Vite auto-detects it)
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173 },
});
