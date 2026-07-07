-- Fiber Blitz OS v2 — Sprint 1: rep (user) staffing/qualification fields.
-- Additive + idempotent. Local-only (NOT prod — pending Teki rulings).
--   prisma db execute --file prisma/migrations/20260629d_fbos_rep_staffing.sql
--
-- CONTESTED (spec conflict #3): blitz_readiness_score + score_band describe the
-- spec's reliability/gate-completion score, which competes with our existing
-- install-rate GovernanceTier. Kept here as NULLABLE plain float/text so they
-- sit inert if Teki keeps governance tiers — trivially droppable, no semantics
-- locked in (band thresholds stay app-side, not an enum).

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "carrier_credentials"   JSONB,   -- [{carrier, number, expires_at}, ...]
  ADD COLUMN IF NOT EXISTS "availability_calendar" JSONB,   -- blackout dates / available ranges
  ADD COLUMN IF NOT EXISTS "preferred_markets"     JSONB,   -- ranking hint, not a filter
  ADD COLUMN IF NOT EXISTS "blitz_readiness_score" DOUBLE PRECISION,  -- 0-100, CONTESTED
  ADD COLUMN IF NOT EXISTS "score_band"            TEXT,    -- premium|standard|restricted|locked, CONTESTED
  ADD COLUMN IF NOT EXISTS "reliability_history"   JSONB,   -- last N blitzes per-gate completion
  ADD COLUMN IF NOT EXISTS "referral_source"       TEXT;    -- blitz card token or sourcing rep id

CREATE INDEX IF NOT EXISTS "users_score_band_idx" ON "users"("score_band");
