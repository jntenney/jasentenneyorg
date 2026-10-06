import { defineConfig, devices } from '@playwright/test';

// BASE_URL lets the same suite run against a deployed site, e.g.
//   BASE_URL=https://jasentenney.org npm test
// Without it, Playwright starts two local servers itself:
//   - the Vite dev server (port 5173) for the main suite;
//   - a production build served by `vite preview` (port 4173) for the cold-load tests. The
//     first-load race they guard against only exists in a production build, where the CSS is a
//     separate stylesheet; in dev, Vite injects the CSS from JavaScript.
const usesLocalServers = !process.env.BASE_URL;
const devURL = process.env.BASE_URL || 'http://localhost:5173';
const buildURL = process.env.BASE_URL || 'http://localhost:4173';
const coldLoad = /cold-load\.spec\.js/;

export default defineConfig({
  testDir: './tests/e2e',
  // The navigation tests measure timing, so run them one at a time.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', testIgnore: coldLoad, use: { ...devices['Desktop Chrome'], baseURL: devURL } },
    // Safari's engine on an iPhone-sized screen, where the first-load bug was seen.
    { name: 'cold-load-webkit', testMatch: coldLoad, use: { ...devices['iPhone 13'], baseURL: buildURL } },
    { name: 'cold-load-chromium', testMatch: coldLoad, use: { ...devices['Pixel 7'], baseURL: buildURL } },
  ],
  webServer: usesLocalServers
    ? [
        {
          command: 'npm run dev',
          url: devURL,
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
        {
          // Always a fresh build, so the cold-load tests never run against stale output.
          command: 'npm run build && npm run preview -- --port 4173 --strictPort',
          url: buildURL,
          reuseExistingServer: false,
          timeout: 120_000,
        },
      ]
    : undefined,
});
