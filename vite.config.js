import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@experience': fileURLToPath(new URL('./src/experience', import.meta.url)) } },
  server: {
    port: 3000,
    host: true
  }
});
