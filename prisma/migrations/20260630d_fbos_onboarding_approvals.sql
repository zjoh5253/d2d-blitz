-- Fiber Blitz OS v2 — onboarding (#4), restricted-band approval (#7),
-- no-penalty requests (#8). Additive + idempotent. Local-only for now.
--   prisma db execute --file prisma/migrations/20260630d_fbos_onboarding_approvals.sql

-- #4 Onboarding: prospective-rep intake payload (experience, credentials,
-- terms acceptance, origin blitz). User.status = 'ONBOARDING' until approved.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "onboarding_data" JSONB;

-- #7 Restricted-band claims need the blitz manager's approval before they lock.
ALTER TABLE "blitz_signups"
  ADD COLUMN IF NOT EXISTS "needs_approval" BOOLEAN NOT NULL DEFAULT false;

-- #8 No-penalty request: a rep asks to waive the readiness penalty for
-- abandoning a blitz; the manager approves with a reason.
DO $$ BEGIN
  CREATE TYPE "WaiverStatus" AS ENUM ('REQUESTED','APPROVED','DENIED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "penalty_waivers" (
  "id"            TEXT PRIMARY KEY,
  "rep_id"        TEXT NOT NULL,
  "blitz_id"      TEXT NOT NULL,
  "reason"        TEXT NOT NULL,
  "status"        "WaiverStatus" NOT NULL DEFAULT 'REQUESTED',
  "decided_by_id" TEXT,
  "decided_at"    TIMESTAMP(3),
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "penalty_waivers_rep_blitz_key" ON "penalty_waivers"("rep_id","blitz_id");
CREATE INDEX IF NOT EXISTS "penalty_waivers_status_idx" ON "penalty_waivers"("status");

DO $$ BEGIN
  ALTER TABLE "penalty_waivers" ADD CONSTRAINT "penalty_waivers_rep_id_fkey"
    FOREIGN KEY ("rep_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "penalty_waivers" ADD CONSTRAINT "penalty_waivers_blitz_id_fkey"
    FOREIGN KEY ("blitz_id") REFERENCES "blitzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
