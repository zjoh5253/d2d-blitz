# Sentry Error Monitoring — D2D Blitz

## Projects

| App | Sentry Project | Platform |
|-----|----------------|----------|
| Web dashboard | `d2d-blitz-web` | Next.js |
| Mobile field app | `d2d-blitz-mobile` | React Native / Expo |

---

## Alert Thresholds

### Web (`d2d-blitz-web`)

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| Error spike | >50 new errors in 5 minutes | Critical | Page on-call immediately |
| API error rate | >5% of API routes return 5xx over 10 minutes | High | Email board within 15 min |
| New issue first seen | Any new unhandled error type | Medium | Triage within 24 hours |
| Slow pages | P95 page load >3s over 15 minutes | Low | Ticket for next sprint |

### Mobile (`d2d-blitz-mobile`)

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| Crash rate spike | >2% crash-free sessions drop | Critical | Page on-call immediately |
| ANR rate | >1% ANR rate over 30 minutes | High | Email board within 15 min |
| API error burst | >20 API 5xx errors in 5 minutes | High | Email board within 15 min |
| New crash | Any new crash type (first seen) | Medium | Triage within 24 hours |

---

## On-Call Escalation

**Current escalation path (Phase 1):**

1. **Immediate (Critical):** Sentry alert → email `board@d2dblitz.com`
2. **15-minute follow-up (High):** If no acknowledgment → re-send email with issue link
3. **Manual triage (Medium/Low):** Review Sentry inbox daily at standup

**Future escalation (Phase 2 — when on-call rotation is established):**
- PagerDuty or Opsgenie integration via Sentry webhook
- Primary on-call → Engineering Manager → CTO escalation chain

---

## How to Configure Alerts in Sentry

1. Go to **Alerts** → **Create Alert Rule** in your Sentry project
2. Select **Issues** (for error alerts) or **Metrics** (for performance alerts)
3. Set the conditions from the table above
4. Set action to: **Send an email** → `board@d2dblitz.com`
5. Name the alert clearly (e.g., "Web: Error Spike > 50 in 5min")

---

## Environment Variables Required

### Web app (`d2d-blitz/d2d-blitz/.env`)

```
NEXT_PUBLIC_SENTRY_DSN=https://<key>@o<org>.ingest.sentry.io/<project-id>
SENTRY_DSN=https://<key>@o<org>.ingest.sentry.io/<project-id>
NEXT_PUBLIC_APP_ENV=production   # or staging / development
APP_ENV=production
```

**CI/CD only (for source map uploads):**
```
SENTRY_ORG=your-sentry-org-slug
SENTRY_PROJECT=d2d-blitz-web
SENTRY_AUTH_TOKEN=<token-from-sentry-settings>
```

### Mobile app (`d2d-blitz/d2d-blitz-mobile/.env`)

```
EXPO_PUBLIC_SENTRY_DSN=https://<key>@o<org>.ingest.sentry.io/<project-id>
EXPO_PUBLIC_APP_ENV=production   # or staging / development
```

Also update `app.json` → replace `SENTRY_ORG_PLACEHOLDER` with your real org slug.

---

## Vercel Deployment

Add the following environment variables in Vercel project settings:
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_DSN`
- `NEXT_PUBLIC_APP_ENV=production`
- `APP_ENV=production`
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `SENTRY_AUTH_TOKEN`

---

## How to Read the API Error Rate Metric (Q2 KR: <1%)

**Goal:** Keep the 5xx error rate across all API routes below 1% over any 1-hour rolling window.

### Where to look

1. **Sentry → Performance → Web Vitals / Transactions** (project: `d2d-blitz-web`)
   - Transactions prefixed with `GET /api/` or `POST /api/` are your API routes.
   - The **Error Rate** column shows `5xx responses / total requests × 100%`.

2. **Sentry → Alerts** — you should have a metric alert rule named `"Web: API error rate >1% (1h)"`. If this alert fires, the threshold has been breached.

### How to calculate it manually

```
Error Rate = (count of 5xx responses in last 1 hour) / (total API requests in last 1 hour) × 100
```

In Sentry Discover:
```
event.type:transaction transaction:/api/* http.status_code:>=500
```
Divide that count by the total count of the same transaction pattern (without the status filter).

### How to set the <1% alert in Sentry

1. Go to **Alerts → Create Alert Rule → Metrics**.
2. Set dataset to **Transactions**.
3. Filter: `transaction:/api/*` (all API routes).
4. Metric: **Failure Rate** (Sentry built-in; counts 5xx as failures).
5. Threshold: `> 1` (percent).
6. Window: `60 minutes`.
7. Action: Email `board@d2dblitz.com`.
8. Name: `Web: API error rate >1% (1h)`.

### Interpreting the metric during an incident

| Error Rate | Severity | Action |
|------------|----------|--------|
| 0–0.5% | Healthy | Monitor normally |
| 0.5–1% | Warning | Investigate in Sentry Issues — likely isolated failures |
| 1–5% | Breached KR | Identify failing route(s), check recent deploys, consider rollback |
| >5% | Critical | Alert fires; escalate to on-call immediately |

**Tip:** Click into the failing transaction in Sentry Performance to see the stack trace, affected endpoints, and user count. Filter by `environment:production` to exclude staging noise.

---

## Sentry Project Setup Checklist

- [ ] Create Sentry organization at sentry.io
- [ ] Create project `d2d-blitz-web` (Next.js platform)
- [ ] Create project `d2d-blitz-mobile` (React Native platform)
- [ ] Copy DSNs into `.env` files (both apps)
- [ ] Create auth token and add to CI/CD secrets (`SENTRY_AUTH_TOKEN`)
- [ ] Update `app.json` `SENTRY_ORG_PLACEHOLDER` with real org slug
- [ ] Configure alert rules per thresholds above
- [ ] Create `"Web: API error rate >1% (1h)"` metric alert (see instructions above)
- [ ] Verify errors appear in Sentry after first deployment
