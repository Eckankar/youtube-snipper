import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    strictPort: true,
    watch: {
      // Helpful in Docker containers
      usePolling: process.env.CHOKIDAR_USEPOLLING === 'true',
    },
    proxy: {
      '/api': {
        target: 'http://backend:5000',
        changeOrigin: true
      },
      '/projects': {
        target: 'http://backend:5000',
        changeOrigin: true
      }
    }
  },
  preview: {
    host: true,
    port: 3000,
    strictPort: true
  }
});
