---
name: ship
description: Ship work on the dev branch of jasentenney.org to production and validate it. Pushes dev, opens a dev-to-main pull request, merges it (merging deploys), watches the gated Deploy Website workflow, then checks the live site. Use when asked to ship, deploy, release, merge to main, or put changes in production.
---

# Ship dev to production

Merging `dev` into `main` deploys the site: the Deploy Website workflow (`.github/workflows/main.yml`) runs the Playwright suite, then builds, uploads to S3 with cache headers, and invalidates CloudFront. This skill runs that routine end to end and proves the result in production.

The merge, any manual workflow dispatch, and any AWS write prompt for confirmation (`.claude/settings.json`). That is intended; do not look for ways around it.

## 1. Preflight

```sh
git status --short
git branch --show-current            # must be dev
git fetch -q origin && git log --oneline origin/main..HEAD
```

- Commit pending work first. Stage files explicitly and look for untracked files that should not ship; never use a blind `git add -A`.
- If the change touches app code, tests or config, `npm test` must have passed locally in this session. If it hasn't, run it now (about 3.5 minutes).
- If `origin/main..HEAD` is empty, there is nothing to ship; say so and stop.

## 2. Push and open the pull request

```sh
git push -q origin dev
gh pr create --base main --head dev --title "<short summary>" --body "<body>"
```

The body has a **Summary** (bullets of what changes for visitors or maintainers), a **Verification** section (what was tested locally), and ends with the Claude Code attribution line the session specifies. If an open dev-to-main PR already exists (`gh pr list --base main --head dev`), reuse it instead.

## 3. Merge and find the deploy run

```sh
gh pr merge --merge dev
sha=$(git fetch -q origin && git rev-parse --short origin/main)
run=""; for i in $(seq 1 9); do
  run=$(gh run list --workflow main.yml --limit 3 --json databaseId,headSha -q ".[] | select(.headSha | startswith(\"$sha\")) | .databaseId" | head -1)
  [ -n "$run" ] && break; sleep 10
done; echo "deploy run: ${run:-none}"
```

GitHub has occasionally not created the push run. If none appears within 90 seconds, dispatch it with `gh workflow run main.yml --ref main` (this asks for confirmation) and take the newest run ID.

## 4. Watch it

The run has four parallel test jobs, `deploy`, and `verify`. `verify` waits until the live site serves this build, then runs the production, cold-load and touch checks in all four browser projects. It takes about 8 minutes in total. Watch it in the background so the session stays responsive:

```sh
gh run watch "$run" --exit-status --interval 15 > /dev/null 2>&1; echo "exit $?"
gh run view "$run" --json conclusion,jobs -q '.conclusion, (.jobs[] | "\(.name): \(.conclusion)")'
```

If it fails, read `gh run view "$run" --log-failed`:

- A failure in the **test** job means nothing was deployed. Fix it on dev and ship again.
- A failure in the **deploy** job can leave the bucket partly updated. Fix forward and ship again; do not edit S3 by hand unless the user agrees.
- A failure in the **verify** job means production is live but failed a check. Read the failing test, fix forward on dev, and ship again.
- After a fix to a failed run, `gh run rerun --failed "$run"` reruns only the failed jobs (this asks for confirmation).

## 5. Validate production

Wait for the invalidation, then confirm the live site is this build:

```sh
id=$(aws cloudfront list-invalidations --distribution-id E195H7URUI6VMD --query "InvalidationList.Items[0].Id" --output text)
aws cloudfront wait invalidation-completed --distribution-id E195H7URUI6VMD --id "$id"
npm run build >/dev/null && echo "local: $(md5 -q dist/index.html)"
for u in https://jasentenney.org/ https://www.jasentenney.org/; do echo "$u $(curl -s -H 'Cache-Control: no-cache' "$u" | md5 -q)"; done
npm run test:prod
```

- Both hostnames must match the local build's `index.html`.
- The verify job must have passed. `npm run test:prod` must also pass in full: the whole suite plus the production checks for security headers, cache headers, hostname parity and CSP. In Claude sessions on this Mac, Firefox is skipped locally (`PW_SKIP_FIREFOX`); the verify job covers it.
- For a visual check, use the playwright-cli skill, for example `npx playwright cli open https://jasentenney.org --browser webkit --device "iphone 13"` followed by `screenshot`, then `close`.

## 6. Report

Tell the user:

- the PR link;
- whether the test and deploy jobs passed;
- a short table of the production checks with their results;
- anything that failed or was skipped, stated first.

Mention any open Dependabot PRs (`gh pr list --author app/dependabot`), but don't merge them as part of this skill.
