import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        gym: path.resolve(__dirname, 'gym.html'),
        inspector: path.resolve(__dirname, 'enemy-inspector.html'),
        combatLab: path.resolve(__dirname, 'combat-lab.html'),
        worldStudy: path.resolve(__dirname, 'rift-worlds.html'),
      },
    },
  },
});
