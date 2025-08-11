import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174, // Frontend runs here
    proxy: {
      '/api': {
        target: 'http://localhost:5001', // Backend API
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
