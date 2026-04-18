# Auth Architecture — D2D Blitz Web App

**Last Updated:** 2026-04-18

---

## Overview

D2D Blitz uses **NextAuth v5** with a **JWT (stateless) session strategy**. There are no server-side sessions; all auth state lives in a signed JWT stored in a browser cookie (web) or in-memory/AsyncStorage (mobile). A separate mobile endpoint issues tokens for field reps.

---

## Auth Endpoints

| Endpoint | Purpose | Rate Limit |
|----------|---------|------------|
| `POST /api/auth/login` | Web login — returns a JWT | 5 req / 15 min per IP |
| `POST /api/auth/mobile` | Mobile login (FIELD_REP only) — returns access + refresh token | 5 req / 15 min per IP |
| `POST /api/auth/refresh` | Exchange a live JWT for a fresh one | 20 req / 15 min per IP |
| `GET/POST /api/auth/[...nextauth]` | NextAuth catch-all (OAuth, CSRF, session) | NextAuth-managed |

---

## Web Login Flow

```
Client                    /api/auth/login              Database
  │                             │                          │
  │── POST { email, password } ─>│                          │
  │                             │── SELECT user by email ──>│
  │                             │<── user row ─────────────│
  │                             │── bcrypt.compare()        │
  │                             │── encode JWT ─────────────│
  │<── { accessToken, user } ───│
```

1. Rate check (5 req / 15 min per IP) — returns `429` if exceeded.
2. Validate `email` + `password` present — returns `400` if missing.
3. Look up user by email. Missing user or null `passwordHash` → `401`.
4. `bcrypt.compare(password, passwordHash)` — mismatch → `401`.
5. Encode JWT via `next-auth/jwt` encode with `AUTH_SECRET`, salt `"authjs.session-token"`.
6. Return `{ accessToken, user: { id, email, name, role } }`.

---

## Mobile Login Flow

Identical to web login with two differences:

- **FIELD_REP restriction** — any other role receives `403`.
- **Both `accessToken` and `refreshToken` are returned** (same token value; the mobile app stores both for offline continuity).

```
Mobile App            /api/auth/mobile            Database
  │                         │                         │
  │── POST { email, pwd } ──>│                         │
  │                         │── verify credentials ───>│
  │                         │── role === FIELD_REP?     │
  │<── 403 if not ──────────│                         │
  │<── { accessToken,       │
  │      refreshToken,      │
  │      user } ────────────│
```

---

## Token Refresh Flow

The mobile app calls `/api/auth/refresh` before a token expires to get a new one without re-authenticating.

```
Mobile App          /api/auth/refresh           Database
  │                       │                         │
  │── POST { refreshToken}─>│                         │
  │                       │── jwt.decode()            │
  │                       │── SELECT user by id ─────>│
  │                       │── status === "ACTIVE"?    │
  │<── 401 if not ────────│                         │
  │<── { accessToken,     │
  │      refreshToken } ──│
```

The refresh endpoint also re-validates that the user's account is still `ACTIVE`. A deactivated rep cannot refresh.

---

## JWT Payload

```typescript
{
  id: string,            // User cuid from Prisma
  email: string,
  name: string | null,
  role: Role             // One of 7 roles — see RBAC section
}
```

**Encoding:** `next-auth/jwt` encode/decode with `AUTH_SECRET` env var and salt `"authjs.session-token"`.
**Expiry:** 30 days (NextAuth v5 default; not overridden).

---

## Session Shape (Web)

After NextAuth populates the session via `jwt` and `session` callbacks:

```typescript
session.user = {
  id: string,
  email: string,
  name: string | null,
  role: string,
  emailVerified: boolean
}
```

---

## Cookie Names

| Context | Cookie |
|---------|--------|
| HTTPS (production) | `__Secure-authjs.session-token` |
| HTTP (local dev) | `authjs.session-token` |

---

## RBAC Model

### Roles

```
ADMIN          — Full platform access
EXECUTIVE      — Read-only reporting access
RECRUITER      — Recruiting/candidate management
MARKET_OWNER   — Manages blitzes and markets
FIELD_MANAGER  — Manages field reps in their territory
FIELD_REP      — Individual door-to-door sales rep
CALL_CENTER    — Inbound lead handling
```

### Route Access Matrix

| Route Prefix | ADMIN | EXEC | RECRUIT | MKT_OWN | FLD_MGR | FLD_REP | CALL_CTR |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `/dashboard/admin` | ✅ | | | | | | |
| `/dashboard/recruiting` | ✅ | | ✅ | | | | |
| `/dashboard/markets` | ✅ | | | ✅ | ✅ | | |
| `/dashboard/blitzes` | ✅ | | | ✅ | ✅ | | |
| `/dashboard/reps` | ✅ | | | | ✅ | ✅ | |
| `/dashboard/installs` | ✅ | | | | | | |
| `/dashboard/compensation` | ✅ | | | | | | |
| `/dashboard/governance` | ✅ | | | | ✅ | | |
| `/dashboard/compliance` | ✅ | | | | ✅ | | |
| `/dashboard/inbound` | ✅ | | | | | | ✅ |
| `/dashboard/reports` | ✅ | ✅ | | | | | |
| `/dashboard/manager` | ✅ | | | ✅ | ✅ | | |

**Access denied behavior:** Unauthorized users are redirected to `/dashboard` (not shown a 403 page).
**Unauthenticated behavior:** Redirected to `/login?callbackUrl={original_path}`.

### API-Level Authorization

Individual API routes enforce their own role checks using `getSessionFromRequest()`. The middleware handles page-level routing; API routes re-check independently so server-side calls are always protected regardless of middleware.

---

## Rate Limiting

All rate limits use an **in-memory Map** (capped at ~10,000 entries). This resets on server restart and does not persist across multiple Vercel instances — adequate for current scale but not suitable for distributed deployments.

IP detection order:
1. `x-forwarded-for` header (first value)
2. `x-real-ip` header
3. Fallback: `"unknown"` (all unknown IPs share one bucket)

| Endpoint | Window | Limit |
|----------|--------|-------|
| `/api/auth/login` | 15 min | 5 |
| `/api/auth/mobile` | 15 min | 5 |
| `/api/auth/refresh` | 15 min | 20 |

Rate-limited responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` (Unix seconds) headers.

---

## User Model — Auth-Relevant Fields

```prisma
model User {
  id                       String    @id @default(cuid())
  email                    String    @unique
  name                     String?
  role                     Role      @default(FIELD_REP)
  status                   String    @default("ACTIVE")
  passwordHash             String?
  emailVerified            Boolean   @default(false)
  emailVerificationToken   String?
  emailVerificationExpires DateTime?
  passwordResetToken       String?
  passwordResetExpires     DateTime?
  governanceTierId         String?   // Links to commission tier
}
```

`passwordHash` is optional — accounts created via OAuth or admin invite may not have one. The login endpoint rejects `null` hashes with a `401`.

---

## Key Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `AUTH_SECRET` | Yes | JWT signing secret |
| `NEXTAUTH_URL` | Yes | Base URL for callbacks and email links |
| `DATABASE_URL` | Yes | Prisma PostgreSQL connection |

`AUTH_SECRET` must be a strong random value in production. The development default (`local-dev-secret-change-in-production`) must never be used in staging or production.
