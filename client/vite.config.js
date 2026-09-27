import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // In dev, Vite serves the UI and forwards API calls to the Express server.
    proxy: {
      '/api': `http://127.0.0.1:${process.env.PORT || 3000}`,
    },
  },
});
