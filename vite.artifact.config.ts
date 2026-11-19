import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Single-page build for the Claude artifact: one JS bundle, inlined by scripts/inline-html.mjs.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist-artifact',
    chunkSizeWarningLimit: 4000,
    rollupOptions: { input: 'artifact.html', output: { inlineDynamicImports: true } },
  },
});
