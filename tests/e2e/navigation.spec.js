import { test, expect } from '@playwright/test';
import { openSite, currentSlide, visibilityState, pressAndSettle, wheel, SLIDES, SLIDE_MS, SETTLE_MS } from './helpers.js';

test.describe('slide navigation', () => {
  test.beforeEach(async ({ page }) => {
    await openSite(page);
  });

  test('arrow keys visit every slide in order and wrap around', async ({ page }) => {
    expect(await currentSlide(page)).toBe('first');

    const imageRequests = [];
    page.on('request', (r) => {
      if (r.url().includes('images.unsplash.com')) imageRequests.push(r.url());
    });

    for (const expected of SLIDES.slice(1)) {
      await pressAndSettle(page, 'ArrowDown');
      const state = await visibilityState(page);
      expect(state.top).toBe(expected);
      expect(state.topShown).toBe(true);
      expect(state.topHasImage).toBe(true);
    }

    // Desktop viewports get the full 1920px renditions.
    expect(imageRequests.length).toBeGreaterThan(0);
    for (const url of imageRequests) expect(url, 'desktop image width').toContain('w=1920');

    await pressAndSettle(page, 'ArrowDown');
    expect(await currentSlide(page)).toBe('first');

    await pressAndSettle(page, 'ArrowUp');
    expect(await currentSlide(page)).toBe('sixth');
  });

  test('PageDown, Space, PageUp and Shift+Space navigate; other keys are ignored', async ({ page }) => {
    await pressAndSettle(page, 'PageDown');
    expect(await currentSlide(page)).toBe('second');
    await pressAndSettle(page, 'Space');
    expect(await currentSlide(page)).toBe('third');
    await pressAndSettle(page, 'PageUp');
    expect(await currentSlide(page)).toBe('second');
    await pressAndSettle(page, 'Shift+Space');
    expect(await currentSlide(page)).toBe('first');
    await pressAndSettle(page, 'ArrowRight');
    expect(await currentSlide(page)).toBe('first');
  });

  test('mouse wheel navigates in both directions', async ({ page }) => {
    await wheel(page, 200);
    await page.waitForTimeout(SETTLE_MS);
    expect(await currentSlide(page)).toBe('second');

    await wheel(page, -200);
    await page.waitForTimeout(SETTLE_MS);
    expect(await currentSlide(page)).toBe('first');
  });

  test('input is accepted as soon as the slide settles', async ({ page }) => {
    // Press once, then keep pressing until the deck moves again. The second move should start
    // right after the slide motion ends, well before the text entrance (~1.8s) finishes.
    const start = await currentSlide(page);
    const t0 = Date.now();
    await page.keyboard.press('ArrowDown');
    let mid = start;
    while (mid === start) {
      await page.waitForTimeout(20);
      mid = await currentSlide(page);
    }

    let next = mid;
    let acceptedAt = null;
    while (next === mid && Date.now() - t0 < 5000) {
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(50);
      next = await currentSlide(page);
      if (next !== mid) acceptedAt = Date.now() - t0;
    }

    expect(acceptedAt, 'second navigation never happened').not.toBeNull();
    expect(acceptedAt).toBeGreaterThanOrEqual(SLIDE_MS - 100);
    expect(acceptedAt).toBeLessThan(SLIDE_MS + 450);
  });

  test('a key pressed mid-transition is replayed exactly once', async ({ page }) => {
    // Two quick presses advance two slides.
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(400);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(SLIDE_MS + SETTLE_MS);
    expect(await currentSlide(page)).toBe('third');

    // Down then Up mid-transition: only the last press replays, so we end where we started.
    // The replay goes back to the slide the first transition was leaving, which once ended up
    // hidden by that transition's cleanup (a blank page), so check it is actually visible.
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(300);
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(SLIDE_MS + SETTLE_MS);
    const afterReplay = await visibilityState(page);
    expect(afterReplay.top).toBe('third');
    expect(afterReplay.topShown, 'slide navigated back to must be visible').toBe(true);
    expect(afterReplay.shownCount).toBe(1);

    // A held key (many repeats within one transition) advances exactly two slides.
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(80);
    }
    await page.waitForTimeout(SLIDE_MS + SETTLE_MS);
    expect(await currentSlide(page)).toBe('fifth');
  });
});
