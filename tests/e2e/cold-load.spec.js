import { test, expect } from '@playwright/test';
import { SETTLE_MS, headingLayout, expectHeadingsLaidOut } from './helpers.js';

// Regression test for the first-visit-of-the-day layout bug on iPhone. On a cold cache, WebKit
// ran the app before main.css (and its Google Fonts @imports) was applied, so SplitText measured
// unstyled headings and froze those line breaks and a left text-align into its line elements.
// Each test gets a fresh browser context, so the cache is always cold; the font hosts are slowed
// down further to mimic a mobile network. Runs against a production build in the webkit-iphone,
// chromium-android and firefox projects (see playwright.config.js).

const FONT_HOSTS = /fonts\.(googleapis|gstatic)\.com/;
const FONT_DELAY_MS = 1500;

test('cold load: headings are split against the final styles and fonts', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route(FONT_HOSTS, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, FONT_DELAY_MS));
    await route.continue();
  });

  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(FONT_DELAY_MS + SETTLE_MS);

  const cormorantLoaded = await page.evaluate(() => document.fonts.check('16px "Cormorant Garamond"'));
  expect(cormorantLoaded, 'Cormorant Garamond loaded').toBe(true);
  expectHeadingsLaidOut(await headingLayout(page));
  expect(errors).toEqual([]);
});
