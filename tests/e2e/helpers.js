// Shared helpers for driving the slide deck.
import { expect } from '@playwright/test';

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

/** Line-by-line layout of every split heading (all six slides, hidden ones included). */
export function headingLayout(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('.section-heading')].map((heading) => {
      const box = heading.getBoundingClientRect();
      return {
        name: heading.textContent.replace(/\s+/g, ' ').trim().slice(0, 30),
        fontSize: parseFloat(getComputedStyle(heading).fontSize),
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
    })
  );
}

/**
 * Assert the headings were split against the styles and font they are displayed with. SplitText copies
 * the heading's text-align onto each line at split time ("start" means styles were not live yet), and a
 * line measured with the wrong styles or font overflows and wraps inside its line element.
 */
export function expectHeadingsLaidOut(layout) {
  expect(layout.length, 'six slide headings').toBe(6);
  for (const heading of layout) {
    expect(heading.lines.length, `${heading.name}: split into lines`).toBeGreaterThan(0);
    for (const line of heading.lines) {
      const where = `${heading.name} / "${line.text}"`;
      expect(line.textAlign, `${where}: text-align`).toBe('center');
      expect(line.height, `${where}: one visual row`).toBeLessThanOrEqual(line.charHeight * 1.5);
      // Centred within the heading, allowing for the trailing letter-spacing.
      expect(line.offCentre, `${where}: centred`).toBeLessThanOrEqual(heading.fontSize * 0.6);
    }
  }
}

/** Width tier src/App.vue picks for Unsplash backgrounds at a given viewport width. */
export function imageWidthFor(viewportWidth) {
  return viewportWidth <= 540 ? 1080 : viewportWidth <= 960 ? 1440 : 1920;
}

/** Small seeded PRNG so the stress test is reproducible. */
export function seededRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}
