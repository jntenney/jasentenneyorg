# jasentenney.org - v1.1.0

My personal website, [jasentenney.org](https://jasentenney.org/), built with [Vue](https://vuejs.org/) and [GSAP](https://gsap.com/) and hosted on [AWS (S3, CloudFront)](https://aws.amazon.com/). It is a single page of full-screen slides: scroll, swipe, or use the arrow keys to move between them. The header links to my resume (PDF), email, LinkedIn, and GitHub.

## Homepage Screenshot

![Homepage Screenshot](/docs/JasenTenneyOrgHomepage.png)

## Homepage Demo

![Homepage Demo](/docs/JasenTenneyOrgAnimated.gif)

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```

### Deploy to AWS S3 using CLI

Upload the build to S3 with cache headers, then invalidate the CloudFront cache so the new files are served right away.

```sh
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

## Updating the resume

1. Drop the new PDF into `public/` and remove the old one.
2. Point both resume links in `src/components/HeaderSection.vue` at the new file name.
3. Update the hero sentence in `src/components/HeroSection.vue` and the three description meta tags in `index.html` if the summary changed.
4. Regenerate `public/siteimage.png` (the social preview) from the hero at a 1200x630 viewport, and the screenshot and GIF in `docs/`.
5. Build and deploy.
