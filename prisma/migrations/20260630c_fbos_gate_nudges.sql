-- Fiber Blitz OS v2 — gate nudge tracking (Teki answer #1: a nudge = an
-- automated reminder push; >=5 nudges fire before a gate is officially missed).
-- Additive + idempotent. Local-only for now.
--   prisma db execute --file prisma/migrations/20260630c_fbos_gate_nudges.sql

ALTER TABLE "check_in_gates"
  ADD COLUMN IF NOT EXISTS "nudges"         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "last_nudged_at" TIMESTAMP(3);
