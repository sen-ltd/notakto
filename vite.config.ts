import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/portfolio/notakto/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    testTimeout: 180000,
  },
});
