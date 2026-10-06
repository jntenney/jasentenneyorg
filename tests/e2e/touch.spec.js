import { test, expect } from '@playwright/test';
import { openSite, currentSlide, visibilityState, SETTLE_MS } from './helpers.js';

// Touch input on phones. On touch devices GSAP's Observer listens to touch events (it only cancels
// touchmove, never touchstart, so taps still click links). Swipe up = next slide, swipe down = previous.
// Runs in the webkit-iphone and chromium-android projects (see playwright.config.js).

/** Drag one finger vertically across the middle of the screen. */
async function swipe(page, direction) {
  const { width, height } = page.viewportSize();
  const x = Math.round(width / 2);
  const [fromY, toY] = direction === 'up' ? [height * 0.75, height * 0.25] : [height * 0.25, height * 0.75];
  const body = page.locator('body');
  const at = (y) => [{ identifier: 1, clientX: x, clientY: Math.round(y) }];

  await body.dispatchEvent('touchstart', { touches: at(fromY), changedTouches: at(fromY), targetTouches: at(fromY) });
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    const y = fromY + ((toY - fromY) * i) / steps;
    await body.dispatchEvent('touchmove', { touches: at(y), changedTouches: at(y), targetTouches: at(y) });
    await page.waitForTimeout(16);
  }
  await body.dispatchEvent('touchend', { touches: [], changedTouches: at(toY), targetTouches: [] });
}

async function swipeAndSettle(page, direction) {
  await swipe(page, direction);
  await page.waitForTimeout(SETTLE_MS);
}

test.beforeEach(async ({ page }) => {
  await openSite(page);
});

test('swipe up advances, swipe down goes back, and both wrap around', async ({ page }) => {
  expect(await currentSlide(page)).toBe('first');

  for (const [direction, expected] of [
    ['up', 'second'],
    ['up', 'third'],
    ['down', 'second'],
    ['down', 'first'],
    ['down', 'sixth'],
    ['up', 'first'],
  ]) {
    await swipeAndSettle(page, direction);
    const state = await visibilityState(page);
    expect(state.top, `after swipe ${direction}`).toBe(expected);
    expect(state.topShown, `${expected} visible`).toBe(true);
    expect(state.shownCount, 'exactly one visible slide').toBe(1);
  }
});

test('a tap on the slide does not navigate', async ({ page }) => {
  const { width, height } = page.viewportSize();
  await page.touchscreen.tap(Math.round(width / 2), Math.round(height * 0.75));
  await page.waitForTimeout(SETTLE_MS);
  expect(await currentSlide(page)).toBe('first');
});

test('tapping the CoDeveloper link opens it once and leaves the slide where it is', async ({ page, context }) => {
  await swipeAndSettle(page, 'up');
  expect(await currentSlide(page)).toBe('second');

  const opened = [];
  context.on('page', (p) => opened.push(p));
  await page.locator('.second .caption-links a').tap();
  await expect.poll(() => opened.length, { message: 'a new tab opened' }).toBe(1);
  await opened[0].waitForLoadState('domcontentloaded');
  expect(opened[0].url()).toBe('https://codeveloper.ift.org/');

  // Give any duplicate synthetic click a chance to appear, then check nothing else happened.
  await page.waitForTimeout(800);
  expect(opened.length, 'opened exactly once').toBe(1);
  expect(await currentSlide(page)).toBe('second');
});
