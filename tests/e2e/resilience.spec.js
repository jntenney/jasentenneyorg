import { test, expect } from '@playwright/test';
import { SETTLE_MS, SLIDES, visibilityState, headingLayout, expectHeadingsLaidOut } from './helpers.js';

// What happens when the third parties fail. Ad blockers and some networks block Google Fonts, CDNs stall,
// and Unsplash can be unreachable. In each case the page must still lay out its headings correctly and
// navigate. waitForStylesAndFonts() in src/App.vue holds the split until main.css is applied (capped at
// 5 s) and then until the web fonts load (capped at 3 s); these tests pin down both behaviours.
// Runs against a production build in the firefox, webkit-iphone and chromium-android projects.

// Record when the hero heading was split, in ms since navigation start.
const recordSplitTime = () => {
  window.__splitAt = null;
  new MutationObserver((mutations, observer) => {
    if (document.querySelector('h1 .clip-text')) {
      window.__splitAt = performance.now();
      observer.disconnect();
    }
  }).observe(document, { childList: true, subtree: true });
};

async function splitTime(page) {
  await expect.poll(() => page.evaluate(() => window.__splitAt), { timeout: 10_000 }).not.toBeNull();
  return page.evaluate(() => window.__splitAt);
}

/** Visit every slide by keyboard and back to the hero, checking each one is the only visible slide. */
async function expectFullTour(page) {
  for (const expected of [...SLIDES.slice(1), SLIDES[0]]) {
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(1600);
    const state = await visibilityState(page);
    expect(state.top).toBe(expected);
    expect(state.topShown, `${expected} visible`).toBe(true);
    expect(state.shownCount, 'exactly one visible slide').toBe(1);
  }
}

const mainCssApplied = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor === 'rgb(0, 0, 0)');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(recordSplitTime);
});

test('Google Fonts blocked: no waiting, headings laid out with the fallback font, navigation works', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  // A failed @import still lets main.css apply, so neither cap should be reached.
  expect(await splitTime(page), 'split without waiting for a cap').toBeLessThan(2500);
  await page.waitForTimeout(SETTLE_MS);

  expect(await mainCssApplied(page), 'main.css applied').toBe(true);
  expectHeadingsLaidOut(await headingLayout(page));
  await expectFullTour(page);
  expect(errors).toEqual([]);
});

test('font files stall: the 3-second font cap releases the page, laid out and navigable', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // The font CSS arrives but the font files never do.
  await page.route(/fonts\.gstatic\.com/, () => {});

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const splitAt = await splitTime(page);
  expect(splitAt, 'held back by the font wait').toBeGreaterThanOrEqual(2900);
  expect(splitAt, 'released by the 3 s cap').toBeLessThan(6000);
  await page.waitForTimeout(SETTLE_MS);

  expect(await mainCssApplied(page), 'main.css applied').toBe(true);
  expectHeadingsLaidOut(await headingLayout(page));
  await expectFullTour(page);
  expect(errors).toEqual([]);
});

test('Unsplash blocked: every slide still shows and the deck navigates', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route(/images\.unsplash\.com/, (route) => route.abort());

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await splitTime(page);
  await page.waitForTimeout(SETTLE_MS);

  expectHeadingsLaidOut(await headingLayout(page));
  await expectFullTour(page);
  expect(errors).toEqual([]);
});
