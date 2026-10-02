import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Writes precache-manifest.json listing every built file, so the service worker
 * can download the whole app at install time and open fully offline.
 */
function precacheManifest(): Plugin {
  return {
    name: 'precache-manifest',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const extra = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];
      const version = Object.keys(bundle).filter((f) => f.startsWith('assets/index-')).sort().join('|');
      this.emitFile({ type: 'asset', fileName: 'precache-manifest.json', source: JSON.stringify({ version, files: [...extra, ...files] }) });
    },
  };
}

// `base: './'` lets the built app be hosted from any sub-path (e.g. GitHub Pages).
export default defineConfig({
  base: './',
  plugins: [react(), precacheManifest()],
  build: {
    chunkSizeWarningLimit: 1600,
  },
  test: {
    environment: 'node',
  },
} as never);
