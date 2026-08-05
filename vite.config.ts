import { defineConfig } from 'vite';

/** Для GitHub Pages: VITE_BASE=/typewriter-fm-focus-writer/ */
const base = process.env.VITE_BASE || '/';

export default defineConfig({
  base,
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
