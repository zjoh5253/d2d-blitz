# D2D Blitz

SaaS platform for door-to-door sales teams. Reps log visits on mobile; managers see a live dashboard.

## Stack

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS** + shadcn/ui components
- **Prisma** + PostgreSQL
- **NextAuth.js** (JWT, email/password)

## Local Setup

### 1. Prerequisites

- Node.js 20+
- PostgreSQL 14+ running locally (or a connection string to a hosted instance)

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/d2dblitz"
AUTH_SECRET="your-random-secret-at-least-32-chars"
NEXTAUTH_URL="http://localhost:3000"
```

All other vars (Sentry, PostHog, Resend) are optional for local dev — the app boots without them.

### 4. Run database migrations

```bash
npx prisma migrate dev
```

### 5. Seed demo data

```bash
npx prisma db seed
```

This creates demo accounts, a sample team, and pre-populated visits so the dashboard is non-empty on first load.

**MVP demo accounts** (password: `password123`):

| Role | Email | What they see |
|------|-------|---------------|
| Manager | `manager@d2dblitz.com` | Visit Dashboard with stats + leaderboard |
| Rep 1 | `rep1@d2dblitz.com` | Log Visit form + My Visits history |
| Rep 2 | `rep2@d2dblitz.com` | Log Visit form + My Visits history |

**Additional accounts** (same password):

| Role | Email |
|------|-------|
| Admin | `admin@d2dblitz.com` |
| Executive | `exec@d2dblitz.com` |
| Recruiter | `recruiter@d2dblitz.com` |
| Market Owner | `marketowner@d2dblitz.com` |
| Call Center | `callcenter@d2dblitz.com` |

### 6. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Key URLs

| URL | Description |
|-----|-------------|
| `/` | Marketing landing page |
| `/pricing` | Pricing page ($49/mo, 14-day trial) |
| `/login` | Sign in |
| `/dashboard/visits/new` | Rep: log a door knock (mobile-first) |
| `/dashboard/visits` | Rep: own visit history |
| `/dashboard/manager/visits` | Manager: all visits, stats, leaderboard |
| `/dashboard/reps/sales/new` | Rep: submit a sale |
| `/dashboard/leaderboard` | Rankings |

## Useful commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run typecheck    # TypeScript type check
npm run lint         # ESLint
npm test             # Vitest unit tests

npx prisma studio    # Visual DB browser
npx prisma migrate dev   # Apply new migrations
npx prisma db seed   # Re-seed demo data (idempotent-ish with a fresh DB)
```

## Database schema highlights

Key models added for the MVP visit logger:

- **`Team`** — groups reps under a manager
- **`Visit`** — rep's door knock record: `address`, `outcome` (NOT_HOME / NOT_INTERESTED / CALLBACK / SALE), optional `notes`, `repId`, `teamId`, `createdAt`
- **`User.teamId`** — links reps and managers to a team

The full schema is in `prisma/schema.prisma`.
