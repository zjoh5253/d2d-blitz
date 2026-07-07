-- Fiber Blitz OS v2 — Sprint 4: timestamp a blitz first opened for signup, so
-- the premium-band 24h early-access window (spec §6.2) has an anchor.
-- Additive + idempotent. Local-only for now.
--   prisma db execute --file prisma/migrations/20260630_fbos_board_gating.sql

ALTER TABLE "blitzes"
  ADD COLUMN IF NOT EXISTS "opened_for_signup_at" TIMESTAMP(3);
