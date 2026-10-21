import { defineConfig, devices } from '@playwright/test';

// Minimal typing so the project does not need Node types (which would leak into src).
declare const process: { env: Record<string, string | undefined> };

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: 'e2e',
  reporter: 'list',
  forbidOnly: isCI,
  use: {
    baseURL: 'http://localhost:4173/simon/',
  },
  projects: [{ name: 'mobile-chromium', use: { ...devices['Pixel 7'] } }],
  // Tests run against the real production build, not the dev server.
  // In CI the dist is built by an earlier workflow step and is the exact
  // artifact that gets deployed, so it is only served here, never rebuilt.
  webServer: {
    command: isCI ? 'npm run preview' : 'npm run build && npm run preview',
    url: 'http://localhost:4173/simon/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
