import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` lets the built app be hosted from any sub-path (e.g. GitHub Pages).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: 'node',
  },
} as never);
