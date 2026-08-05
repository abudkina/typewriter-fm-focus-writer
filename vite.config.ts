import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2022',
    cssMinify: true,
  },
  server: {
    port: 8765,
    strictPort: true,
    open: false,
  },
  worker: {
    format: 'es',
  },
});
