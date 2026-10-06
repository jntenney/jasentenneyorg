import { test, expect } from '@playwright/test';
import { openSite, imageWidthFor } from './helpers.js';

// Image payload budget. A mismatch between the preload URLs in index.html and the URLs src/App.vue
// requests once made the browser download backgrounds twice, and one typo fetched a 4.5 MB original,
// for 15 MB on first load. These tests pin down what is fetched, how often and how big.
// Runs in the chromium (desktop) and webkit-iphone projects.

const UNSPLASH = /images\.unsplash\.com/;

// Largest single background accepted per width tier. Today's largest are about 0.5, 0.9 and 1.8 MB.
const MAX_IMAGE_BYTES = { 1080: 1_000_000, 1440: 1_500_000, 1920: 2_500_000 };

/** Collect every Unsplash request, with its response size once it finishes. */
function trackImages(page) {
  const images = [];
  page.on('request', (request) => {
    if (UNSPLASH.test(request.url())) images.push({ request, url: request.url(), bytes: null });
  });
  page.on('requestfinished', async (request) => {
    const image = images.find((i) => i.request === request);
    if (image) image.bytes = (await request.sizes()).responseBodySize;
  });
  return images;
}

test('first load fetches only the two preloaded backgrounds, at the viewport width tier', async ({ page }) => {
  const images = trackImages(page);
  await openSite(page);

  const tier = imageWidthFor(page.viewportSize().width);
  expect(images.map((i) => i.url).length, 'background requests on first load').toBe(2);
  expect(new Set(images.map((i) => i.url)).size, 'no background fetched twice').toBe(2);
  for (const image of images) expect(image.url, 'width tier').toContain(`w=${tier}`);
});

test('a full tour fetches each background once and within the size budget', async ({ page }) => {
  const images = trackImages(page);
  await openSite(page);
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(1600);
  }
  await expect
    .poll(() => images.every((i) => i.bytes !== null), { message: 'all image requests finished', timeout: 20_000 })
    .toBe(true);

  const tier = imageWidthFor(page.viewportSize().width);
  const urls = images.map((i) => i.url);
  // Two preloaded, then each of the six navigations shows one and warms the next.
  expect(urls.length, 'background requests for a six-slide tour').toBeLessThanOrEqual(8);
  expect(new Set(urls).size, 'no background fetched twice').toBe(urls.length);
  for (const image of images) {
    expect(image.url, 'width tier').toContain(`w=${tier}`);
    expect(image.bytes, `${image.url.slice(28, 68)} size`).toBeLessThanOrEqual(MAX_IMAGE_BYTES[tier]);
  }
});
