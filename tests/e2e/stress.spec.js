import { test, expect } from '@playwright/test';
import { openSite, visibilityState, wheel, seededRandom } from './helpers.js';

// Regression test for the blank page that appeared after rapid navigation: a transition that
// started while the previous one was still finishing could have its destination slide hidden by
// the previous timeline's cleanup. Random fast key and wheel input reproduced it reliably.
test('rapid random key and wheel input never leaves the page blank', async ({ page }) => {
  test.setTimeout(180_000);
  await openSite(page);

  const rand = seededRandom(42);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  for (let round = 1; round <= 8; round++) {
    const inputs = 6 + Math.floor(rand() * 8);
    for (let i = 0; i < inputs; i++) {
      const r = rand();
      if (r < 0.35) await page.keyboard.press('ArrowDown');
      else if (r < 0.7) await page.keyboard.press('ArrowUp');
      else await wheel(page, r < 0.85 ? 200 : -200);
      await page.waitForTimeout(40 + Math.floor(rand() * 500));
    }
    await page.waitForTimeout(3500);

    const state = await visibilityState(page);
    expect(state.top, `round ${round}: no slide on top`).not.toBeNull();
    expect(state.topShown, `round ${round}: top slide ${state.top} is hidden`).toBe(true);
    expect(state.topHasImage, `round ${round}: top slide ${state.top} has no background`).toBe(true);
    expect(state.shownCount, `round ${round}: expected exactly one visible slide`).toBe(1);
  }

  expect(errors).toEqual([]);
});
