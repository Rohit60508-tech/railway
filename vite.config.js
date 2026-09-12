import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  root: '.',
  publicDir: 'public',
  server: {
    port: 5173,
    host: '0.0.0.0',
    open: false,
    proxy: {
      '/api/v1': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/ai': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ai/, '/api/v1'),
      },
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://127.0.0.1:5000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'frontend/pages/login.html'),
        login: resolve(__dirname, 'frontend/pages/login.html'),
        admin: resolve(__dirname, 'frontend/pages/admin-dashboard.html'),
        control: resolve(__dirname, 'frontend/pages/control-office.html'),
        maintenance: resolve(__dirname, 'frontend/pages/maintenance-dashboard.html'),
        surveillance: resolve(__dirname, 'frontend/pages/surveillance-dashboard.html'),
        aimodels: resolve(__dirname, 'frontend/pages/ai-model-management.html'),
        datasources: resolve(__dirname, 'frontend/pages/data-sources.html'),
        summary: resolve(__dirname, 'frontend/pages/project-summary.html'),
      },
    },
  },
});
