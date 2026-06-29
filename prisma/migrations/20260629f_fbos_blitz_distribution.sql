-- Fiber Blitz OS v2 — Sprint 1: blitz distribution mode (spec §5.1 step 4).
-- Additive + idempotent. Local-only (NOT prod — pending integration provisioning).
--   prisma db execute --file prisma/migrations/20260629f_fbos_blitz_distribution.sql
--
-- How the blitz fills seats: targeted invites only | open board only | both
-- (invites first 24h, then the board opens). Default 'both' = the spec default.

ALTER TABLE "blitzes"
  ADD COLUMN IF NOT EXISTS "distribution_mode" TEXT NOT NULL DEFAULT 'both';
