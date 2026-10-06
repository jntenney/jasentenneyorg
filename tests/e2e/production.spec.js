import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { openSite, currentSlide, visibilityState, SLIDES } from './helpers.js';

// Checks that only make sense against the deployed site: CloudFront adds the security headers and the
// deploy sets the cache headers. Skipped unless BASE_URL is set, so run them with `npm run test:prod`
// after every deploy. Runs in the desktop Chromium and iPhone WebKit projects (see playwright.config.js).
test.skip(!process.env.BASE_URL, 'production-only checks: run with npm run test:prod');

const policy = JSON.parse(
  fs.readFileSync(new URL('../../infra/cloudfront-response-headers-policy.json', import.meta.url), 'utf8')
);

// The headers CloudFront should add, derived from the policy file kept in the repo.
function expectedSecurityHeaders() {
  const sec = policy.SecurityHeadersConfig;
  const hsts = sec.StrictTransportSecurity;
  const headers = {
    'strict-transport-security': [
      `max-age=${hsts.AccessControlMaxAgeSec}`,
      hsts.IncludeSubdomains && 'includeSubDomains',
      hsts.Preload && 'preload',
    ]
      .filter(Boolean)
      .join('; '),
    'x-content-type-options': 'nosniff',
    'x-frame-options': sec.FrameOptions.FrameOption,
    'referrer-policy': sec.ReferrerPolicy.ReferrerPolicy,
    'content-security-policy': sec.ContentSecurityPolicy.ContentSecurityPolicy,
  };
  for (const item of policy.CustomHeadersConfig.Items) headers[item.Header.toLowerCase()] = item.Value;
  return headers;
}

// The hashed bundle files the live index.html points at.
async function liveAssets(request) {
  const html = await (await request.get('/', { headers: { 'cache-control': 'no-cache' } })).text();
  const js = html.match(/\/assets\/index-[\w-]+\.js/)?.[0];
  const css = html.match(/\/assets\/index-[\w-]+\.css/)?.[0];
  return { html, js, css };
}

test('security headers on every kind of file match the CloudFront policy in infra/', async ({ request }) => {
  const { js } = await liveAssets(request);
  const expected = expectedSecurityHeaders();
  for (const path of ['/', js, '/Jasen_Tenney_2026.pdf', '/siteimage.jpg']) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    const headers = response.headers();
    for (const [name, value] of Object.entries(expected)) {
      expect(headers[name], `${path}: ${name}`).toBe(value);
    }
  }
});

test('cache headers: index.html revalidates, hashed assets are immutable, the rest cache for a day', async ({
  request,
}) => {
  const { js, css } = await liveAssets(request);
  expect(js, 'bundle referenced by index.html').toBeTruthy();
  expect(css, 'stylesheet referenced by index.html').toBeTruthy();

  const expectations = [
    ['/', 'no-cache', 'text/html'],
    [js, 'public, max-age=31536000, immutable', 'javascript'],
    [css, 'public, max-age=31536000, immutable', 'text/css'],
    ['/Jasen_Tenney_2026.pdf', 'public, max-age=86400', 'application/pdf'],
    ['/siteimage.jpg', 'public, max-age=86400', 'image/jpeg'],
    ['/resume.svg', 'public, max-age=86400', 'image/svg+xml'],
  ];
  for (const [path, cacheControl, type] of expectations) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()['cache-control'], `${path}: cache-control`).toBe(cacheControl);
    expect(response.headers()['content-type'], `${path}: content-type`).toContain(type);
  }
});

test('apex and www hostnames serve the same page', async ({ request }) => {
  const base = new URL(process.env.BASE_URL);
  test.skip(base.hostname !== 'jasentenney.org', 'only meaningful for the real domain');
  const fetchPage = async (host) =>
    (await request.get(`https://${host}/`, { headers: { 'cache-control': 'no-cache' } })).text();
  expect(await fetchPage('www.jasentenney.org')).toBe(await fetchPage('jasentenney.org'));
});

test('a full tour raises no CSP violations or failed requests', async ({ page }) => {
  const violations = [];
  const failed = [];
  page.on('console', (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text());
  });
  page.on('requestfailed', (r) => failed.push(`${r.url()} ${r.failure()?.errorText ?? ''}`));

  await openSite(page);
  for (const expected of [...SLIDES.slice(1), SLIDES[0]]) {
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(1600);
    expect(await currentSlide(page)).toBe(expected);
    const state = await visibilityState(page);
    expect(state.topShown, `${expected}: visible`).toBe(true);
    expect(state.topHasImage, `${expected}: background`).toBe(true);
  }

  const fontsLoaded = await page.evaluate(
    () => document.fonts.check('16px "Cormorant Garamond"') && document.fonts.check('16px "Bebas Neue"')
  );
  expect(fontsLoaded, 'web fonts loaded under the CSP').toBe(true);
  expect(violations).toEqual([]);
  expect(failed).toEqual([]);
});
