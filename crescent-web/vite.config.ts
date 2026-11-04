import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

function apiCompileDevMiddleware(): Plugin {
  return {
    name: 'crescent-api-compile-dev-middleware',
    configureServer(server) {
      server.middlewares.use('/api/compile', async (req, res) => {
        const modulePath = './api/compile.js';
        const mod = await import(modulePath);
        const handler = mod.default ?? mod;
        await handler(req, res);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), apiCompileDevMiddleware()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
