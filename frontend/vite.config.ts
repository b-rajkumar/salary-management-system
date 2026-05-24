import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Point Vite at the TS source so Rollup can statically analyse named exports
    // from @app/shared (its dist is CJS with __exportStar, which Rollup can't enumerate).
    alias: {
      '@app/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' },
  },
  preview: {
    port: 4173,
    proxy: { '/api': 'http://localhost:3000' },
  },
});
