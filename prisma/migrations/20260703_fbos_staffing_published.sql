-- Fiber Blitz OS v2 — draft-until-finalized staffing. Reps get no check-in
-- pings until the manager clicks "Finish & notify reps" (sets this timestamp),
-- so mistakes during staffing never notify anyone early.
-- Additive + idempotent.
--   prisma db execute --file prisma/migrations/20260703_fbos_staffing_published.sql

ALTER TABLE "blitzes"
  ADD COLUMN IF NOT EXISTS "staffing_published_at" TIMESTAMP(3);
