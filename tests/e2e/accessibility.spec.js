import { test, expect } from '@playwright/test';
import { openSite, currentSlide, visibilityState, SLIDE_MS } from './helpers.js';

test('reduced motion: slides still change, instantly, with text fully visible', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openSite(page);

  const charOpacity = () =>
    page.evaluate(() => {
      const top = [...document.querySelectorAll('section')].find((s) => s.style.zIndex === '1');
      const firstChar = top.querySelector('.section-heading div div, .section-heading div');
      return parseFloat(getComputedStyle(firstChar).opacity);
    });

  expect(await charOpacity()).toBe(1);

  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(150);
  expect(await currentSlide(page)).toBe('second');
  expect(await charOpacity()).toBe(1);

  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(150);
  expect(await currentSlide(page)).toBe('third');
  expect(await charOpacity()).toBe(1);
});

test('header links have accessible names and working targets', async ({ page }) => {
  await openSite(page);

  const links = page.locator('header a');
  await expect(links).toHaveCount(5);

  const expected = [
    ['View my resume (PDF)', '/Jasen_Tenney_2026.pdf'],
    ['View my resume (PDF)', '/Jasen_Tenney_2026.pdf'],
    ['Email Jasen', 'mailto:jasen.tenney@gmail.com'],
    ['LinkedIn profile', 'https://www.linkedin.com/in/jasentenney/'],
    ['GitHub profile', 'https://github.com/jntenney'],
  ];
  for (const [i, [name, href]] of expected.entries()) {
    const link = links.nth(i);
    await expect(link).toHaveAttribute('aria-label', name);
    await expect(link).toHaveAttribute('title', name);
    await expect(link).toHaveAttribute('href', href);
  }

  // External links open safely in a new tab; the mailto link does not open a blank tab.
  await expect(links.nth(3)).toHaveAttribute('rel', 'noopener');
  await expect(links.nth(4)).toHaveAttribute('rel', 'noopener');
  await expect(links.nth(2)).not.toHaveAttribute('target', /.+/);

  // The resume actually downloads.
  const pdf = await page.request.get('/Jasen_Tenney_2026.pdf');
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()['content-type']).toContain('application/pdf');
  expect((await pdf.body()).length).toBeGreaterThan(100_000);
});

test('document head: title, descriptions, preview image tags and a single h1', async ({ page }) => {
  await openSite(page);

  await expect(page).toHaveTitle('Jasen Tenney');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('h1')).toContainText(/applied AI/i);

  const description = 'Jasen Tenney is an applied AI full-stack engineer';
  for (const selector of ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']) {
    const content = await page.locator(selector).getAttribute('content');
    expect(content, selector).toContain(description);
  }

  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://jasentenney.org/siteimage.png');
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '2400');
  await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute('content', '1260');
  await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute('content', /.+/);
  await expect(page.locator('meta[name="twitter:image:alt"]')).toHaveAttribute('content', /.+/);

  // The preview image itself is served.
  const image = await page.request.get('/siteimage.png');
  expect(image.status()).toBe(200);
});

test('text outside the slides can be selected', async ({ page }) => {
  await openSite(page);
  const userSelect = (selector) => page.evaluate((s) => getComputedStyle(document.querySelector(s)).userSelect, selector);
  expect(await userSelect('header .name-link')).toBe('auto');
  expect(await userSelect('section h1')).toBe('none');
});

test('phone viewport: hero fits with no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await openSite(page);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  const box = await page.locator('h1').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(375 + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(700);

  // Every slide still renders at this width.
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(SLIDE_MS + 900);
    const state = await visibilityState(page);
    expect(state.topShown).toBe(true);
    expect(state.topHasImage).toBe(true);
  }
});
