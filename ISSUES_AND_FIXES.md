# D2D Blitz - Issues & Fix Tracking

**Last Updated:** 2026-04-18
**Status:** Active Development

---

## 🔴 Open Issues

### API / Backend

| Issue | Impact | Fix | Status |
|-------|--------|-----|--------|
| Cron routes missing CRON_SECRET validation | `/api/cron/payout-batch` and `/api/cron/payout-sla-check` do not exist yet — automated payout batching and SLA enforcement is not implemented | Implement cron routes with `CRON_SECRET` header check before adding to scheduler | 🔴 Pending |

### Mobile

| Issue | Impact | Fix | Status |
|-------|--------|-----|--------|
| `Sale` type mismatch | Mobile defines `'PENDING'` / `'INSTALL_COMPLETED'` but backend uses `'PENDING_INSTALL'` / `'INSTALLED'` | Align mobile type with backend enum | 🔴 Pending |
| Offline sync stub | `offlineStore.syncQueue()` exists but all API calls are commented out — offline queue never syncs | Implement actual API calls in sync loop | 🔴 Pending |
| GPS session not persisted | `GPSTrackingScreen` does not save session data to the API (TODO at line 123) | Implement session save on stop | 🟡 Pending |
| Leaderboard silent failure | `leaderboardStore` catch block sets `error: null` instead of the caught message | Set `error: err.message` in catch | 🟡 Pending |

---

## 🟡 Medium Priority

### Mobile UX
- [ ] **Offline mode** — Better offline queue management (sync stub is wired but non-functional)
- [ ] **Push notifications** — Expo notifications configured but not fully wired to blitz events

### Web UX
- [ ] **Loading states** — Add skeleton loaders for heavier data-fetching routes
- [ ] **Error boundaries** — Catch and surface errors gracefully in Next.js page tree

### DevOps
- [ ] **Staging environment** — Deploy previews for PRs (Vercel preview is available but not configured)
- [ ] **Monitoring** — Error tracking (Sentry or equivalent) not set up
- [ ] **Automated database backups** — No backup strategy documented

---

## 🟢 Low Priority / Nice to Have

- [ ] **Dark mode** — Toggle between light/dark themes
- [ ] **PWA support** — Service worker, manifest, installable web app
- [ ] **Advanced analytics dashboard** — Usage metrics, rep conversion rates
- [ ] **API versioning** — Consider `/api/v1/` prefix for future stability

---

## ✅ Resolved

| Issue | Resolution | Notes |
|-------|-----------|-------|
| `POST /api/auth/login` returned 400 instead of 401 | Fixed — now returns **401** for invalid credentials, **400** for missing fields (correct REST semantics) | Audited 2026-04-18 |
| `GET /api/user` endpoint missing | Implemented as `GET /api/users/me` — returns full profile with role and governance tier | Audited 2026-04-18 |
| Touchpoints feature not deployed | Fully implemented — `GET /POST /api/touchpoints` with GPS, outcome tracking, and role-scoped access | Audited 2026-04-18 |
| Touchpoints DB schema missing | Prisma model exists and is migrated | Audited 2026-04-18 |
| Commission streak bonuses not in UI | Compensation page at `/dashboard/compensation` shows commissions and payout batches | Audited 2026-04-18 |
| No leaderboard UI | `/dashboard/leaderboard` page with weekly/monthly/seasonal/lifetime rankings | Audited 2026-04-18 |
| Mobile `LeaderboardScreen` hardcoded mock data | Now wired to `useLeaderboardStore` | Previously resolved |
| Mobile `dashboardStore` uses mock data | Now calls `dashboardApi.getDashboardData()` | Previously resolved |
| `spacing.xxl` missing in mobile theme | `LeaderboardScreen` uses `spacing['2xl']` which exists | Previously resolved |
| Package name typo (`b2b-blitz`) | Fixed to `d2d-blitz` in `package.json` | DDB-37, 2026-04-18 |
| Mobile `date-fns` misclassified as devDependency | Moved to `dependencies` (used in `src/utils/formatters.ts`) | DDB-37, 2026-04-18 |
| API health endpoint missing | Added | 2026-03-13 — 4f8af47 |
| Leaderboard 404 error | Fixed | 2026-03-13 — 4f8af47 |

---

## 📋 Pre-Deployment Checklist

Run before every production deployment:

```bash
# Web app (d2d-blitz/)
npm run typecheck
npm run lint
npm run build

# Mobile (d2d-blitz-mobile/)
npm run typecheck
npm run lint
npm run test
```

---

*Last reconciled by D2DBlitzLead agent — 2026-04-18*
