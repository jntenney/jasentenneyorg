# jasentenney.org - v1.2.0

My personal website, [jasentenney.org](https://jasentenney.org/), built with [Vue 3](https://vuejs.org/), [Vite](https://vite.dev/) and [GSAP](https://gsap.com/), tested with [Playwright](https://playwright.dev/), and hosted on [AWS (S3, CloudFront)](https://aws.amazon.com/) with a GitHub Actions deploy pipeline.

## Homepage Screenshot

![Homepage Screenshot](/docs/JasenTenneyOrgHomepage.png)

## Homepage Demo

![Homepage Demo](/docs/JasenTenneyOrgAnimated.gif)

## How the site works

The site is a single page of six full-screen slides. The hero states what I do; the other five (Applied AI, Full Stack Engineer, Front End, Back End, Cloud) each carry a heading and a one-line caption drawn from my resume. The Applied AI caption links to [IFT CoDeveloper](https://codeveloper.ift.org/), the agentic AI platform I lead.

- **Navigation.** Mouse wheel, trackpad, touch swipe, or the keyboard: arrow keys, Page Up/Down, Space and Shift+Space. Input is accepted the moment a slide settles; a key pressed mid-transition is remembered and replayed once. The deck wraps at both ends.
- **Animation.** GSAP's Observer drives the slide transitions and SplitText animates each heading character by character. Captions fade up just after the heading lands. Under the OS "reduce motion" setting, slides still change but without the parallax and character animations.
- **Images.** Backgrounds come from Unsplash at a width chosen from the viewport (1080px on phones, 1440px on tablets, 1920px on desktops). Only the first two are preloaded; each navigation warms the next one.
- **Header.** Links to my resume (PDF), email, LinkedIn and GitHub, each with a tooltip and accessible name.
- **Search and sharing.** `index.html` carries a canonical URL, Open Graph and Twitter card tags with `public/siteimage.jpg` as the preview, and a JSON-LD `Person` block linking my profiles.

## Project layout

```
index.html                     page shell: meta tags, preloads, JSON-LD
src/App.vue                    slide engine: GSAP timelines, navigation, image sizing
src/components/HeaderSection.vue
src/components/HeroSection.vue slides, headings and captions
src/assets/main.css
public/                        resume PDF, icons, social preview image
tests/e2e/                     Playwright suite (see below)
infra/                         CloudFront response headers policy
.github/workflows/test.yml     Test workflow
.github/workflows/main.yml     Deploy Website workflow (test, then deploy)
.github/dependabot.yml
docs/                          README screenshot and demo GIF
```

## Development

Requires Node 22 or newer. [VS Code](https://code.visualstudio.com/) with [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) is the recommended editor.

```sh
npm install
npm run dev       # Vite dev server on http://localhost:5173
npm run build     # production build to dist/
npm run preview   # serve the production build locally
```

## Tests

The end-to-end suite in `tests/e2e/` drives the site in headless Chromium and covers: slide order by keyboard and wheel, input timing and queued key presses, a seeded random fast-input stress test for the blank-slide regression, captions and the CoDeveloper link, reduced motion, header links and accessible names, head metadata and structured data, text selection, the phone viewport, and the image width requested per viewport. Playwright starts the Vite dev server itself.

```sh
npx playwright install chromium   # once
npm test                          # against the local dev server
npm run test:headed               # same, with a visible browser
npm run test:prod                 # the same suite against https://jasentenney.org
```

`BASE_URL=<url> npm test` runs the suite against any deployed copy. Tests run one at a time because several of them measure timing.

## Branches, workflows and releases

`dev` is the default branch and where work happens. `main` is what is deployed. Changes reach production by merging `dev` into `main` through a pull request.

- **Test** ([test.yml](.github/workflows/test.yml)) runs the Playwright suite on every push to `dev` and every pull request into `dev` or `main`.
- **Deploy Website** ([main.yml](.github/workflows/main.yml)) runs on every push to `main` (normally a merged pull request) and can be started by hand from the Actions tab. It runs the suite first and deploys only if it passes: build, upload to S3 with cache headers, then a CloudFront invalidation. It uses four repository secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `BUCKET_NAME` and `DISTRIBUTION_ID`.
- **Dependabot** ([dependabot.yml](.github/dependabot.yml)) opens weekly pull requests against `dev` for npm packages (minor and patch bumps grouped, majors separate) and GitHub Actions. The Test workflow runs on them, so a green grouped PR can be merged from GitHub. Majors deserve a local check, and Vite and `@vitejs/plugin-vue` must be upgraded together.

After a deploy, confirm production with `npm run test:prod`.

### Deploy to AWS S3 using CLI (manual fallback)

The same steps the workflow runs, for when Actions is unavailable:

```sh
npm run build
aws s3 sync dist s3://jasentenney.org --delete --exclude "index.html" --exclude "assets/*" --cache-control "public, max-age=86400"
aws s3 sync dist/assets s3://jasentenney.org/assets --delete --cache-control "public, max-age=31536000, immutable"
aws s3 cp dist/index.html s3://jasentenney.org/index.html --cache-control "no-cache"
aws cloudfront create-invalidation --distribution-id E195H7URUI6VMD --paths "/*"
```

The three upload commands set different cache lifetimes: the hashed files in `assets/` get a new name every build so browsers can cache them forever, the unhashed files (PDF, preview image, icons) get one day, and `index.html` is never cached so a normal reload always picks up a new deploy.

The commands use the default AWS CLI profile. If its credentials have expired, sign in with SSO and add `--profile jntaws-production` to each command:

```sh
aws sso login --profile jntaws-production
```

## Infrastructure notes

The site is an S3 bucket (`jasentenney.org`, us-east-2) behind a CloudFront distribution (`E195H7URUI6VMD`) that serves both `jasentenney.org` and `www.jasentenney.org` over HTTPS.

**Security headers.** HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` and a `Content-Security-Policy` are added by a CloudFront response headers policy attached to the default cache behavior. The policy is kept in [infra/cloudfront-response-headers-policy.json](infra/cloudfront-response-headers-policy.json); to change a header, edit that file and update the policy:

```sh
aws cloudfront update-response-headers-policy --id 85ee901e-b1b5-4faa-90aa-7857af69a297 --if-match "$(aws cloudfront get-response-headers-policy --id 85ee901e-b1b5-4faa-90aa-7857af69a297 --query ETag --output text)" --response-headers-policy-config file://infra/cloudfront-response-headers-policy.json
```

The CSP allows scripts and styles from the site itself, stylesheets and fonts from Google Fonts, and images from Unsplash. If you add a new external origin for scripts, styles, fonts or images, add it to the policy first or the browser will block it.

**Deploy credentials.** The workflow's IAM user has one policy granting `s3:PutObject`, `s3:DeleteObject` and `s3:ListBucket` on the bucket and `cloudfront:CreateInvalidation` on the distribution, and nothing else.

## Updating the resume

1. Drop the new PDF into `public/` and remove the old one.
2. Point both resume links in `src/components/HeaderSection.vue` at the new file name.
3. If the summary changed, update the hero sentence and slide captions in `src/components/HeroSection.vue`, and in `index.html` the three description meta tags and the JSON-LD `jobTitle` and `description`.
4. Regenerate `public/siteimage.jpg` (the social preview) from the hero at a 1200x630 viewport, and the screenshot and GIF in `docs/`.
5. Update the expected text in `tests/e2e/` if any wording the tests check has changed, then `npm test`.
6. Merge `dev` into `main` to deploy, and run `npm run test:prod`.
