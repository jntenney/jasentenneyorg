import { test, expect } from '@playwright/test';
import { SETTLE_MS } from './helpers.js';

// Regression test for the first-visit-of-the-day layout bug on iPhone. On a cold cache, WebKit
// ran the app before main.css (and its Google Fonts @imports) was applied, so SplitText measured
// unstyled headings and froze those line breaks and a left text-align into its line elements.
// Each test gets a fresh browser context, so the cache is always cold; the font hosts are slowed
// down further to mimic a mobile network. Runs in the webkit-iphone and chromium-android projects
// against a production build (see playwright.config.js).

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

  const result = await page.evaluate(() => {
    const headings = [...document.querySelectorAll('.section-heading')];
    return {
      cormorantLoaded: document.fonts.check('16px "Cormorant Garamond"'),
      headings: headings.map((heading) => {
        const box = heading.getBoundingClientRect();
        const fontSize = parseFloat(getComputedStyle(heading).fontSize);
        return {
          name: heading.textContent.replace(/\s+/g, ' ').trim().slice(0, 30),
          fontSize,
          lines: [...heading.querySelectorAll('.clip-text')].map((line) => {
            const range = document.createRange();
            range.selectNodeContents(line);
            const content = range.getBoundingClientRect();
            const char = line.querySelector(':scope > div > div');
            return {
              text: line.textContent.replace(/\s+/g, ' ').trim(),
              textAlign: line.style.textAlign,
              height: line.getBoundingClientRect().height,
              charHeight: char ? char.getBoundingClientRect().height : 0,
              offCentre: Math.abs((content.left + content.right) / 2 - (box.left + box.right) / 2),
            };
          }),
        };
      }),
    };
  });

  expect(result.cormorantLoaded, 'Cormorant Garamond loaded').toBe(true);
  expect(result.headings.length).toBe(6);

  for (const heading of result.headings) {
    expect(heading.lines.length, `${heading.name}: split into lines`).toBeGreaterThan(0);
    for (const line of heading.lines) {
      const where = `${heading.name} / "${line.text}"`;
      // SplitText copies the heading's text-align at split time; "start" means styles were not live yet.
      expect(line.textAlign, `${where}: text-align`).toBe('center');
      // A line measured against the wrong styles or font overflows and wraps inside its line element.
      expect(line.height, `${where}: one visual row`).toBeLessThanOrEqual(line.charHeight * 1.5);
      // Centred within the heading, allowing for the trailing letter-spacing.
      expect(line.offCentre, `${where}: centred`).toBeLessThanOrEqual(heading.fontSize * 0.6);
    }
  }

  expect(errors).toEqual([]);
});
