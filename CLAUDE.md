# CLAUDE.md

Guidance for Claude Code (and anyone else) working in this repo. The README has the user-facing overview; this file covers how to work here safely and the decisions already made.

## What this is

Jasen Tenney's personal site, [jasentenney.org](https://jasentenney.org/): one page of six full-screen slides (hero, Applied AI, Full Stack Engineer, Front End, Back End, Cloud). Vue 3 + Vite 8, animated with GSAP 3.15 (Observer for input, SplitText for per-character headings). It's a static build in S3 behind CloudFront, deployed by GitHub Actions.

## Commands

```sh
npm run dev                  # Vite dev server, http://localhost:5173
npm run build                # production build to dist/
npm run preview              # serve dist/ (Playwright uses port 4173)
npm test                     # full Playwright suite; Playwright starts dev + a fresh build itself
npm run test:prod            # same suite against https://jasentenney.org, plus production-only checks
npx playwright test --project webkit-iphone      # iPhone/WebKit checks only
npx playwright cli open <url> [--browser webkit --device "iphone 13"]   # interactive browsing (see the playwright-cli skill)
```

macOS has no `timeout` command; poll with a `for` loop instead. Playwright browsers (Chromium, WebKit) are already installed.

## Branches and shipping

- `dev` is the default branch; all work happens there. `main` is production.
- **Merging dev into main deploys the site.** The Deploy Website workflow runs the full suite first and deploys only if it passes. Never push to main directly.
- Use the `ship` skill (`/ship`) for the whole routine: push dev, PR, merge, watch the deploy, validate production. Merging, workflow dispatch and any AWS write prompt for confirmation by design (`.claude/settings.json`).
- After every deploy, run `npm run test:prod` and compare the live `index.html` with a local build (the skill does both).
- Stage files explicitly and check `git status` for untracked files before committing; never use a blind `git add -A`.
- Commit messages end with the attribution trailer the session specifies; PR bodies end with the Claude Code line.

## Architecture notes (src/App.vue)

These are load-bearing; each was a real bug.

- **Wait before splitting.** `waitForStylesAndFonts()` waits for the `--styles-ready` sentinel from `main.css`, then for both web fonts, before any `SplitText`. SplitText measures line breaks once and copies the heading's computed `text-align` onto each line. On a cold cache, Safari ran the app before `main.css` (held back by its Google Fonts `@import`s) applied, which froze left-aligned, wrongly broken lines. `document.fonts.ready` alone does not fix this, because there are no `@font-face` rules until `main.css` applies. Keep the `@import`s in `main.css` so the sentinel implies the fonts are declared.
- **Input unlocks when the slide settles**, not when the timeline completes: `tl.add(onSlideSettled, motion.duration)`. The character entrance runs about 0.6 s longer; unlocking on `onComplete` made input feel laggy.
- **Mid-transition key presses are queued** (`pendingDirection`), and only the last direction is replayed once.
- **Rapid navigation and the blank page.** A new transition kills the previous timeline (`activeTimeline`) and applies its "hide the outgoing slide" step itself, skipping it when the outgoing slide is the new destination. Without this, fast input could hide the slide being shown, leaving a black page.
- **Background images** come from Unsplash at a width tier chosen from the viewport (1080 / 1440 / 1920). The two `rel="preload"` links in `index.html` use matching media queries; change both together.
- **Reduced motion** zeroes the durations in `motion`; slides still change.
- Captions (`.section-caption`) are hidden by CSS and revealed by the slide timeline.

## Infrastructure

- Bucket `jasentenney.org` (us-east-2), CloudFront distribution `E195H7URUI6VMD` serving the apex and www hostnames.
- Security headers come from the CloudFront response headers policy `85ee901e-b1b5-4faa-90aa-7857af69a297`, kept in `infra/cloudfront-response-headers-policy.json`. The production tests compare the live headers against that file. **Any new external origin (script, style, font, image) must be added to the CSP there and the policy updated first**, or the browser blocks it.
- Deploy cache headers: `index.html` is `no-cache`, `assets/*` is immutable, everything else gets one day. The workflow and the README's manual fallback must stay in sync.
- The workflow's IAM user `BuildJasenTenneyOrg` has one policy, `DeployJasenTenneyOrg`: `s3:PutObject`, `s3:DeleteObject`, `s3:ListBucket` on the bucket, and `cloudfront:CreateInvalidation` on the distribution. Repository secrets are `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `BUCKET_NAME` and `DISTRIBUTION_ID`.
- Locally the AWS CLI uses the default profile; if it has expired, use `aws sso login --profile jntaws-production` and pass `--profile jntaws-production`.

## Tests (tests/e2e)

- Playwright projects:
  - `chromium` (desktop, dev server) runs the main suite.
  - `webkit-iphone` and `chromium-android` run `cold-load.spec.js` against a fresh production build (`vite preview`, port 4173), or against `BASE_URL`.
  - `production.spec.js` runs in `chromium` and `webkit-iphone` but skips itself unless `BASE_URL` is set.
- Tests run serially (`workers: 1`) because several measure timing; a full local run takes about 3.5 minutes.
- When changing navigation or animation, prove each guarding test still bites: temporarily revert the fix, confirm the test fails, then restore it. The stress test and the cold-load test exist because ad hoc checks missed real bugs.
- Dependabot opens weekly PRs against `dev`. Grouped minor and patch PRs can be merged once green. Majors need a local run, and `vite` and `@vitejs/plugin-vue` must move together.

## Content decisions (don't relitigate without asking)

- The hero and slide wording comes from the 2026 resume (`public/Jasen_Tenney_2026.pdf`). The resume-update checklist is in the README.
- "Full Stack", "Front End" and "Back End" stay unhyphenated. Cormorant Garamond's hyphen is drawn with a calligraphic tilt that looks broken in the spaced capitals; that is also why the hero reads "full stack".
- Avoid tenure numbers that invite age arithmetic: "20+ years ... formerly at Microsoft", not "23 years at Microsoft".
- The Applied AI caption links only to the public page `https://codeveloper.ift.org/`, not the app, which lands on a sign-in screen.
- Keep the site to one statement per slide. A blog, a theme toggle or extra animation were considered and declined.
