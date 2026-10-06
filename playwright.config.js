import { defineConfig, devices } from '@playwright/test';

// BASE_URL lets the same suite run against a deployed site, e.g.
//   BASE_URL=https://jasentenney.org npm test
// Without it, Playwright starts two local servers itself:
//   - the Vite dev server (port 5173) for the desktop Chromium suite;
//   - a production build served by `vite preview` (port 4173) for every other project. The first-load
//     and third-party-failure behaviour depends on the CSS being a separate stylesheet, which is only
//     true of a production build (in dev, Vite injects the CSS from JavaScript).
const usesLocalServers = !process.env.BASE_URL;
const devURL = process.env.BASE_URL || 'http://localhost:5173';
const buildURL = process.env.BASE_URL || 'http://localhost:4173';
const spec = (...names) => names.map((name) => new RegExp(`/${name}\\.spec\\.js$`));
// PW_SKIP_FIREFOX=1 drops the Firefox project. Firefox fails to start inside Claude Code's command
// sandbox on the author's Mac ("Could not find profile folder"), so .claude/settings.local.json sets
// it for Claude sessions there. CI and normal terminals always run Firefox.
const skipFirefox = process.env.PW_SKIP_FIREFOX === '1';

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
  // production.spec.js skips itself unless BASE_URL is set (it checks what CloudFront and the deploy add).
  projects: [
    // The full suite on desktop Chromium.
    {
      name: 'chromium',
      testMatch: spec('navigation', 'stress', 'accessibility', 'captions', 'budget', 'production'),
      use: { ...devices['Desktop Chrome'], baseURL: devURL },
    },
    // Desktop Firefox: navigation, captions and the load/failure behaviour.
    {
      name: 'firefox',
      testMatch: spec('navigation', 'captions', 'cold-load', 'resilience', 'production'),
      use: { ...devices['Desktop Firefox'], baseURL: buildURL },
    },
    // Safari's engine on an iPhone-sized touch screen, where the first-load bug was seen.
    {
      name: 'webkit-iphone',
      testMatch: spec('cold-load', 'touch', 'resilience', 'budget', 'production'),
      use: { ...devices['iPhone 13'], baseURL: buildURL },
    },
    {
      name: 'chromium-android',
      testMatch: spec('cold-load', 'touch', 'resilience'),
      use: { ...devices['Pixel 7'], baseURL: buildURL },
    },
  ].filter((project) => !(skipFirefox && project.name === 'firefox')),
  webServer: usesLocalServers
    ? [
        {
          command: 'npm run dev',
          url: devURL,
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
        {
          // Always a fresh build, so these projects never run against stale output.
          command: 'npm run build && npm run preview -- --port 4173 --strictPort',
          url: buildURL,
          reuseExistingServer: false,
          timeout: 120_000,
        },
      ]
    : undefined,
});
