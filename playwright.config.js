import { defineConfig, devices } from '@playwright/test';

// BASE_URL lets the same suite run against a deployed site, e.g.
//   BASE_URL=https://jasentenney.org npm test
// Without it, Playwright starts the Vite dev server itself.
const baseURL = process.env.BASE_URL || 'http://localhost:5173';
const usesDevServer = !process.env.BASE_URL;

export default defineConfig({
  testDir: './tests/e2e',
  // The navigation tests measure timing, so run them one at a time.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: usesDevServer
    ? {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      }
    : undefined,
});
