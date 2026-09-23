import { test, expect } from '@playwright/test';
import { openSite, currentSlide, pressAndSettle } from './helpers.js';

// Each topic slide carries a one-line caption; the Applied AI slide also links to CoDeveloper.
const CAPTIONS = {
  second: /Technical lead, IFT CoDeveloper/,
  third: /20\+ years of production software/,
  fourth: /React 19 and TypeScript/,
  fifth: /ASP\.NET Core, FastAPI and LangGraph/,
  sixth: /Azure architecture in Bicep/,
};

test('every topic slide shows its caption once the slide has settled', async ({ page }) => {
  await openSite(page);
  expect(await page.locator('.first .section-caption').count()).toBe(0);

  for (const [slide, text] of Object.entries(CAPTIONS)) {
    await pressAndSettle(page, 'ArrowDown');
    expect(await currentSlide(page)).toBe(slide);

    const caption = page.locator(`.${slide} .section-caption`);
    await expect(caption).toHaveText(text);
    await expect(caption).toBeVisible();
    expect(await caption.evaluate((el) => parseFloat(getComputedStyle(el).opacity))).toBe(1);
  }
});

test('Applied AI links open CoDeveloper in a new tab without moving the slide', async ({ page, context }) => {
  await openSite(page);
  await pressAndSettle(page, 'ArrowDown');
  expect(await currentSlide(page)).toBe('second');

  const link = page.locator('.second .caption-links a');
  await expect(link).toHaveCount(1);
  await expect(link).toHaveAttribute('href', 'https://codeveloper.ift.org/');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener');
  await expect(link).toHaveAttribute('aria-label', /learn more/i);

  // A click opens a new tab and leaves the deck where it was.
  const [popup] = await Promise.all([context.waitForEvent('page'), link.click()]);
  expect(popup.url()).toBe('https://codeveloper.ift.org/');
  await popup.close();
  await page.waitForTimeout(500);
  expect(await currentSlide(page)).toBe('second');

  // Keyboard: focus and Enter open the link, again without navigating the deck.
  await link.focus();
  const [popup2] = await Promise.all([context.waitForEvent('page'), page.keyboard.press('Enter')]);
  expect(popup2.url()).toBe('https://codeveloper.ift.org/');
  await popup2.close();
  await page.waitForTimeout(500);
  expect(await currentSlide(page)).toBe('second');
});

test('the CoDeveloper destination responds', async ({ request }) => {
  const response = await request.get('https://codeveloper.ift.org/', { timeout: 20_000 });
  expect(response.status()).toBeLessThan(400);
});
