// Shared helpers for driving the slide deck.

// How long the slide movement lasts (see the timeline defaults in src/App.vue).
export const SLIDE_MS = 1250;

// The text entrance can still be running for a while after the slide settles; wait this long
// after a navigation before asserting on the result.
export const SETTLE_MS = 2200;

export const SLIDES = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];

/** Open the site and wait for the hero to be interactive. */
export async function openSite(page, path = '/') {
  await page.goto(path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(SETTLE_MS);
}

/** Class name of the slide on top (the one the visitor sees). */
export function currentSlide(page) {
  return page.evaluate(() => {
    const top = [...document.querySelectorAll('section')].find((s) => s.style.zIndex === '1');
    return top ? top.className : null;
  });
}

/** Visibility facts used to detect the "blank page" failure mode. */
export function visibilityState(page) {
  return page.evaluate(() => {
    const sections = [...document.querySelectorAll('section')];
    const isShown = (el) => {
      const cs = getComputedStyle(el);
      return cs.visibility === 'visible' && parseFloat(cs.opacity) > 0.99;
    };
    const top = sections.find((s) => s.style.zIndex === '1');
    const bg = top ? getComputedStyle(top.querySelector('.bg')).backgroundImage : '';
    return {
      top: top ? top.className : null,
      topShown: top ? isShown(top) : false,
      topHasImage: bg.includes('url('),
      shownCount: sections.filter(isShown).length,
    };
  });
}

/** Press a key and wait for the transition plus text entrance to finish. */
export async function pressAndSettle(page, key) {
  await page.keyboard.press(key);
  await page.waitForTimeout(SETTLE_MS);
}

/** One wheel notch in the middle of the page (positive deltaY = scroll down = next slide). */
export async function wheel(page, deltaY) {
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, deltaY);
}

/** Small seeded PRNG so the stress test is reproducible. */
export function seededRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}
