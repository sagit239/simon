import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173/simon/',
  },
  projects: [{ name: 'mobile-chromium', use: { ...devices['Pixel 7'] } }],
  // Tests run against the real production build, not the dev server.
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173/simon/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
