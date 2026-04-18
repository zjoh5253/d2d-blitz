# Vercel Preview Deploys — Runbook

Every pull request targeting `main` automatically receives an isolated preview deployment via Vercel's GitHub integration. This doc covers the setup, URL pattern, and environment variable guidance.

---

## How It Works

Vercel's GitHub App watches the repository. When a PR is opened or updated:

1. Vercel clones the branch, runs `npm install` and `npx prisma generate && next build`
2. A unique preview URL is created for that branch/commit
3. The Vercel bot posts that URL as a PR comment
4. When the PR is merged or closed, the preview deployment is automatically deprovisioned

This is all handled by Vercel with no additional configuration required once the GitHub integration is active.

---

## One-Time Setup (done once per Vercel project)

### 1. Install the Vercel GitHub App

In the Vercel dashboard:

- Go to **Settings → Git** for the `d2d-blitz` project
- Connect the GitHub repository `d2d-blitz` (or the org's fork)
- Grant the Vercel GitHub App permission to the repository

### 2. Verify Deploy Triggers

Under **Settings → Git → Deploy Hooks**, confirm that:

- `main` branch → **Production** deploy
- All other branches → **Preview** deploy (this is the Vercel default)

No changes to `vercel.json` are required to enable preview deploys — Vercel deploys all branches by default.

### 3. Configure Environment Variables for Preview

In the Vercel dashboard under **Settings → Environment Variables**, set the following variables with the **Preview** target selected:

| Variable | Preview Value | Notes |
|---|---|---|
| `DATABASE_URL` | Preview/staging DB connection string | Must point to a non-production database |
| `AUTH_SECRET` | Separate secret from production | Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://{preview-url}.vercel.app` | Vercel auto-injects `VERCEL_URL`; see note below |
| `NEXT_PUBLIC_APP_ENV` | `preview` | Controls Sentry environment tagging |
| `APP_ENV` | `preview` | |
| `NEXT_PUBLIC_SENTRY_DSN` | Same as production DSN | Or a separate preview Sentry project |
| `SENTRY_DSN` | Same as production DSN | |
| `RESEND_API_KEY` | Preview/test API key | Use Resend's test mode or a separate project |
| `EMAIL_FROM` | `D2D Blitz Preview <preview@yourdomain.com>` | Prevents preview emails looking like production |

> **NEXTAUTH_URL and dynamic preview URLs:** Vercel injects `VERCEL_URL` into every preview build as the deployment's hostname (e.g. `d2d-blitz-abc123-team.vercel.app`). NextAuth requires `NEXTAUTH_URL` to be set to the canonical URL. For preview deployments, set `NEXTAUTH_URL` to `https://$VERCEL_URL` in the Vercel environment variable settings — Vercel will expand `$VERCEL_URL` at build time automatically.

**Important:** Do not add `SENTRY_AUTH_TOKEN` or any production secrets to the Preview target. Source maps should only upload in production builds.

---

## Preview URL Pattern

Vercel preview URLs follow this pattern:

```
https://{project-name}-git-{branch-name}-{team-slug}.vercel.app
```

Examples for branches on this project:

| Branch | Preview URL |
|---|---|
| `agent/DDB-15-commission-preview` | `https://d2d-blitz-git-agent-ddb-15-commission-preview-{team}.vercel.app` |
| `feature/rbac-validation` | `https://d2d-blitz-git-feature-rbac-validation-{team}.vercel.app` |

The Vercel bot also posts the exact URL as a comment on every PR — that is the authoritative link.

---

## What Gets Cleaned Up Automatically

When a PR is **merged or closed**, Vercel deprovisions the preview deployment. The preview URL becomes a 404. No manual cleanup is required.

---

## CI Integration

The `.github/workflows/ci.yml` workflow runs on every PR and push to `main`. It performs:

- Dependency install
- Prisma client generation
- ESLint
- TypeScript type check
- Vitest unit tests

The CI workflow runs independently of the Vercel deploy. Both checks must pass before merging.

---

## Troubleshooting

**Preview deploy not triggering:**
- Confirm the Vercel GitHub App has access to the repository under GitHub → Settings → Applications
- Check the Vercel project's **Deployments** tab for failed builds and their logs

**Auth callback errors on preview:**
- `NEXTAUTH_URL` must match the preview URL. Set it to `https://$VERCEL_URL` in the Vercel dashboard's Preview env vars.

**Database errors on preview:**
- The preview DATABASE_URL must point to a live, migrated database. Run `npx prisma migrate deploy` against the preview DB after schema changes.

**Build fails on preview but passes locally:**
- Check that all required env vars are set in the Vercel **Preview** target, not just Production.
