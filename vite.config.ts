import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Matches the GitHub Pages project site path (sagit239.github.io/simon/).
  base: '/simon/',
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
