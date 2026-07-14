# Blitz OS — Compensation Engine: Session Handoff

> **Purpose:** enough context for a fresh Claude Code session to pick up this work with no prior memory.
> **Working dir:** `/Users/zacharyjohnson/Development/d2d-blitz/d2d-blitz` (the Next.js web app).
> **Last updated:** end of Phase 4e (PR #46 open, awaiting review).

---

## 1. What you're building

A multi-carrier commission & payout engine ("Blitz OS") inside the D2D Blitz web app. It splits the
revenue a carrier pays per install down a **Master → Market Owner → Field Manager → Rep** hierarchy,
holds back a retention slice, handles chargebacks, and pays everyone out via Stripe Connect. There is a
large PRD (Blitz OS multi-carrier commission platform + AI CFO) driving a sequence of phases. Work is done
as **one PR per phase slice**, each: scoped in plan mode → implemented → CI-verified → PR opened →
browser-tested → merged on the user's explicit approval.

**Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind 4, Prisma 7 + PostgreSQL 17,
NextAuth 5 (beta), Zod 4, Vitest. Stripe Connect Express for payouts. Deployed on Vercel.

**Roles (flat links, no chain table):** `ADMIN` (master), `EXECUTIVE`, `RECRUITER`, `MARKET_OWNER`
(sub-dealer; `Market.ownerId`), `FIELD_MANAGER` (`Blitz.managerId`), `FIELD_REP`
(`BlitzAssignment.repId`), `CALL_CENTER`. A sale's hierarchy is loaded via
`sale.blitz.managerId` (manager) and `sale.blitz.market.ownerId` (owner).

---

## 2. Phase status

**Merged to `main` (PRs #39–#45):**
- P1 (#39) Stripe Connect payouts — rep onboarding + live ACH transfers
- P2 (#40) Holdback / retention-bonus + chargeback engine
- P3 (#41) Manager payouts + manager-initiated payroll + Instant Payout
- P4a (#42) Product catalog + per-product pricing + minimum-margin protection
- P4b (#43) Custom per-rep / per-product commission overrides
- P4c (#44) Financial-visibility hardening (role-based redaction of upstream economics)
- P4d (#45) Hierarchical rate sheets — derived-slice pricing chain

**Open, NOT merged — current branch `agent/P4e-per-level-self-editing`:**
- P4e (#46) Per-level self-editing. CI green, browser-tested. **Awaiting human review/merge.**
  Do not start P5 until #46 is merged (or the user says to branch off it).

**Next up:** P5 — AI CFO (Profit First allocation buckets, cash-flow forecasting, exec/CFO dashboard).
Not started.

**Deferred backlog:** rep expense ledger (advances/running balance); effective-dated product pricing;
**reconcile the two calc paths' baseline percent math** (see §5 landmine); competitive-intelligence map +
ISP confidence score.

---

## 3. The core mental model — how a commission is computed

On sale verification, `src/lib/services/commission.ts::calculateCommission(saleId)` (and a near-duplicate
in `src/app/api/commissions/calculate/route.ts`):

1. `carrierPayout = sale.product?.revenue ?? sale.carrier.revenuePerInstall`
2. Baseline split from the resolved `StackConfig` percentages →
   `companyFloor / managerOverride / marketOwnerSpread / repPay`
3. `repPay`: replaced by a flat `RepCommissionOverride` if one resolves (bypasses the tier multiplier),
   else multiplied by the rep's governance-tier `commissionMultiplier`
4. **`applyRateSheets(...)`** (`src/lib/services/rate-sheet.ts`) overlays the hierarchical grant chain:
   - Resolves the manager's `MANAGER` grant and owner's `OWNER` grant (`resolveRateSheet`).
   - **If neither resolves → returns the baseline verbatim (zero behavior change).**
   - Else derives by subtraction: `managerOverride = managerAvailable − repPay`,
     `marketOwnerSpread = ownerAvailable − managerAvailable`,
     `companyFloor = carrierPayout − ownerAvailable` (each clamped ≥ 0).
5. Holdback split runs on `repPay` (`splitHoldback`); `managerOverride` + `marketOwnerSpread` flow to
   `OverrideEarning` via `upsertOverrideEarnings` (paid to manager/owner in the P3 payroll flow).
   `companyFloor` is display/redaction-only (never paid).

**Resolver pattern** (used by `resolveRateSheet`, `resolveRepOverride`, `resolveHoldbackPolicy`,
`StackConfig` lookup): most-specific active record wins — product > carrier > global, newest
`effectiveDate`, using Prisma `orderBy` with `{ sort: "desc", nulls: "last" }`.

---

## 4. What P4e (current branch) added — read this before touching it

**Feature:** owners edit their downline managers' rate sheets; managers edit their downline reps' pay.
Scoped to the actor's own downline, blind to upstream economics, with a min-margin cap.

- **Scoping** (`src/lib/services/payroll-scope.ts`): existing `getPayrollScope(user) → {repIds}` (downline
  reps). New `getManagerScope(user) → {managerIds}` (a MARKET_OWNER's downline managers via
  `Blitz.market.ownerId → Blitz.managerId`, deduped; `[]` for other roles).
- **Caps** (`src/lib/services/min-margin.ts`): new `checkRepPayMargin({managerId,...})` and
  `checkManagerGrantMargin({ownerId,...})` — each resolves the *actor's own* available revenue via
  `resolveRateSheet` and returns `{ok:false, message}` if the grant/pay exceeds it, unless `override`.
  If the actor has no resolvable grant → cap unknown → don't block. Messages reference only the actor's
  own number (never upstream). Alongside the P4d `checkMinMargin` (percent) / `checkGrantMargin` (dollar).
- **APIs loosened, single source of truth** (no parallel routes): `src/app/api/rate-sheets/route.ts` +
  `[id]/route.ts`, `src/app/api/rep-commissions/route.ts` + `[id]/route.ts`. ADMIN unchanged;
  MARKET_OWNER limited to MANAGER-level sheets for in-scope managers; FIELD_MANAGER limited to overrides
  for in-scope reps. Out-of-scope → 403; over-cap → 422 unless `overrideMinMargin`. List GETs are
  scoped for non-admins; `[id]` handlers load the record first and 403 if out of reach.
- **Validator:** `overrideMinMargin: z.boolean().optional().default(false)` added to
  `repCommissionOverrideSchema` (`src/lib/validators/common.ts`); `rateSheetSchema` already had it.
- **UI** (manager-facing, mirror the admin trios but scoped + blind):
  `src/app/dashboard/manager/manager-rates/{page,manager-rates-client,manager-rate-form}.tsx` and
  `src/app/dashboard/manager/rep-pay/{page,rep-pay-client,rep-pay-form}.tsx`. Pages guard with an
  `ALLOWED_ROLES` redirect (pattern from `src/app/dashboard/manager/payroll/page.tsx`), and branch
  ADMIN (all principals/rows) vs scoped (via `getManagerScope`/`getPayrollScope`).
- **Access control:** `src/middleware.ts` — specific prefixes `/dashboard/manager/manager-rates`
  (ADMIN+MARKET_OWNER) and `/dashboard/manager/rep-pay` (ADMIN+FIELD_MANAGER) placed **before** the
  generic `/dashboard/manager` entry (first-match-wins). `src/components/layout/sidebar.tsx` — "Manager
  Rates" and "Rep Pay" nav items with matching roles.
- **Tests:** `src/__tests__/payroll-scope.test.ts` (+getManagerScope),
  `src/__tests__/min-margin.test.ts` (+both cap helpers, needs `rateSheet.findFirst` in the db mock),
  `src/__tests__/self-editing-scope.test.ts` (new — scoped 201/403/422 for both API families, ADMIN
  unscoped). All mock `@/lib/auth` + `@/lib/db`.

**Bug fixed in review (2nd commit on the branch):** the carrier-change `useEffect` in both new forms
eagerly cleared `productId`, which fired during edit pre-population and silently dropped a product-scoped
grant to global on save — bypassing the product-scoped cap. Fix: reconcile `productId` *after* the
carrier's product list loads (keep if still valid, clear only if stale). **The admin forms
(`src/app/dashboard/admin/{rate-sheets,rep-commissions}/*-form.tsx`) still have this bug — port the fix
if you touch them.**

---

## 5. Landmines & gotchas

- **Two calc paths:** `commission.ts` and `/api/commissions/calculate/route.ts` compute the baseline
  split with slightly different, pre-existing, inconsistent percent math. Do **not** "fix" one in
  isolation. P4d/P4e deliberately layered `applyRateSheets` on top of each path's baseline. Reconciling
  them is its own deferred task.
- **Untracked files are NOT part of this work.** `git status` shows several (paperclip/`docs/`,
  `src/app/api/internal/*`, `src/lib/internal-auth.ts`, `src/app/dashboard/door-knocks/*`,
  `src/app/(auth)/layout.tsx`, etc.). Never stage them. One, `src/app/api/internal/finance/payout-drafts/
  route.ts`, has a **pre-existing `tsc` error** — so `npm run typecheck` shows one error that is NOT from
  the compensation branches. Filter it: `npx tsc --noEmit 2>&1 | grep -v payout-drafts`.
- **`.env` is gitignored and holds SANDBOX Stripe keys** (names-only in `.env.example`). They must be
  rotated before prod; never paste live secrets anywhere.
- **Migrations are hand-authored** under `prisma/migrations/`. Local dev DB has been additively
  `db push`ed through P4d and carries accumulated test data. A `--force-reset` triggers Prisma's AI-guard
  requiring `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="<the user's exact yes>"` — ask the user.
- **eslint quirk:** the flat config has no `files` glob for `.tsx`, so linting a bare `.tsx` path reports
  "all files ignored" / spurious warnings. Always validate with the real command `npx eslint .
  --max-warnings 0` (exit 0 = clean), not per-file.

---

## 6. Workflow & conventions (the rhythm the user expects)

- **Git (mandatory):** never commit to `main`; never auto-merge. Branch `agent/{short-desc}`, commit,
  push, open a PR with `gh pr create` (human-readable summary: what/why, key files, migration steps,
  testing notes), then **leave it for the user to merge**. Commit trailers used:
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01G94HiZqJs9ZPjgvYLjD3Fo
  ```
  PR body ends with the `🤖 Generated with [Claude Code]` line.
- **Per-phase loop:** (1) enter plan mode, launch Explore agent(s) to map the surfaces, (2) confirm the
  cut + 2–3 design decisions via `AskUserQuestion`, (3) write the plan file, `ExitPlanMode`, (4)
  implement services/APIs/tests directly, delegate repetitive UI pages to an `executor`/`executor-high`
  agent, (5) run the full CI gate, (6) commit + PR, (7) browser-test end-to-end, fix + push any bugs,
  (8) report and wait for the user's "merge and move on."
- **CI gate:** `npm run ci` = `typecheck && lint && test`. Because of the untracked payout-drafts tsc
  error, run the three separately when verifying: `npx tsc --noEmit 2>&1 | grep -v payout-drafts` (expect
  empty), `npx eslint . --max-warnings 0` (exit 0), `npx vitest run` (all pass; ~496 tests + 11 skipped).
- **Admin CRUD "trio" pattern** for new config entities: `page.tsx` (server, `force-dynamic`, loads data
  + option lists) + `{entity}-client.tsx` (DataTable + edit/delete + form dialog) + `{entity}-form.tsx`
  (RHF + zodResolver, Controller-wrapped `Select`s, products fetched by carrier). Copy an existing trio
  under `src/app/dashboard/admin/*`.

---

## 7. Browser testing recipe (dev server on :3000)

Programmatic login avoids the RHF/autofill fight. In a Chrome tab on the app origin, run via
`javascript_tool`:
```js
const csrf = await fetch('/api/auth/csrf').then(r=>r.json());
await fetch('/api/auth/callback/credentials', { method:'POST',
  headers:{'Content-Type':'application/x-www-form-urlencoded'},
  body: new URLSearchParams({ csrfToken: csrf.csrfToken, email:'marketowner@d2dblitz.com',
    password:'password123', redirect:'false', callbackUrl:'/dashboard' }).toString(),
  redirect:'manual' });
await fetch('/api/auth/session').then(r=>r.json());   // verify user/role
```
To switch users, POST `/api/auth/signout` (with csrfToken) first, then sign in again.

**Seed users** (`prisma/seed.ts`, all password `password123`): `admin@`, `exec@`, `recruiter@`,
`marketowner@` (Carol Market, owns the market), `manager@` (Dave Manager, manages the blitz), `rep1@`
(Eve Rep, assigned), `rep2@`, `callcenter@` — all `@d2dblitz.com`. Seeded FiberMax 1 Gig chain (revenue
$300): OWNER grant Carol $250, MANAGER grant Dave $180, RepCommissionOverride Eve $150. Carriers: FiberMax
ISP (revenue 250, minMargin 20), SpeedNet (200, minMargin 15). **Note:** P4e browser testing left Dave's
grant at $190 and Eve's pay at $170 in the local dev DB — re-seed for pristine numbers.

---

## 8. Key files map

```
src/lib/services/
  commission.ts            calculateCommission — the orchestrator (see §3)
  rate-sheet.ts            resolveRateSheet, applyRateSheets (P4d)
  rep-commission.ts        resolveRepOverride (P4b)
  min-margin.ts            checkMinMargin, checkGrantMargin, checkRepPayMargin, checkManagerGrantMargin
  payroll-scope.ts         getPayrollScope (reps), getManagerScope (managers, P4e)
  holdback.ts              resolveHoldbackPolicy, splitHoldback, upsertHoldback (P2)
  override-earning.ts      upsertOverrideEarnings (P3)
  commission-visibility.ts role-based field redaction (P4c)
src/lib/validators/common.ts   all Zod schemas (rateSheetSchema, repCommissionOverrideSchema, ...)
src/app/api/{rate-sheets,rep-commissions,commissions/calculate}/...   the money APIs
src/app/dashboard/admin/{carriers,products,stack,holdback,governance,rate-sheets,rep-commissions}/  config UIs
src/app/dashboard/manager/{payroll,manager-rates,rep-pay}/   manager-facing surfaces
src/middleware.ts          route role-gates (first-match-wins)
src/components/layout/sidebar.tsx   nav (role-filtered)
prisma/schema.prisma       data model (RateSheet, RepCommissionOverride, OverrideEarning, Holdback, ...)
prisma/seed.ts             seed users + the FiberMax chain
src/__tests__/*.test.ts    Vitest suites (mock @/lib/auth + @/lib/db)
```

Repo-wide agent instructions: `/Users/zacharyjohnson/Development/d2d-blitz/CLAUDE.md` (git workflow).
Landscape overview: `/Users/zacharyjohnson/Development/CLAUDE.md`. Outstanding issues:
`d2d-blitz/ISSUES_AND_FIXES.md`.
```
