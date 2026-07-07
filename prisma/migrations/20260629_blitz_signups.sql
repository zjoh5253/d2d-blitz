-- Rep job-board self-signup. Adds blitz_signups + blitzes.open_for_signup.
-- Additive + idempotent. Safe to run more than once. Apply via:
--   prisma db execute --file prisma/migrations/20260629_blitz_signups.sql
--
-- Flow: a rep claims a spot (CLAIMED if under rep_cap, else WAITLISTED); a
-- manager assigns territory, flipping the claim to ACTIVE and mirroring it
-- into blitz_assignments. open_for_signup gates which blitzes show on the
-- board (auto-set true once lead_prep reaches READY).

DO $$ BEGIN
  CREATE TYPE "BlitzSignupStatus" AS ENUM ('CLAIMED','WAITLISTED','ACTIVE','DECLINED','WITHDRAWN');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "blitzes"
  ADD COLUMN IF NOT EXISTS "open_for_signup" boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "blitz_signups" (
  "id"            TEXT PRIMARY KEY,
  "blitz_id"      TEXT NOT NULL,
  "rep_id"        TEXT NOT NULL,
  "status"        "BlitzSignupStatus" NOT NULL DEFAULT 'CLAIMED',
  "wait_position" INTEGER,
  "claimed_at"    TIMESTAMP(3) NOT NULL DEFAULT now(),
  "activated_at"  TIMESTAMP(3),
  "decided_by_id" TEXT,
  "decided_at"    TIMESTAMP(3)
);

CREATE UNIQUE INDEX IF NOT EXISTS "blitz_signups_blitz_id_rep_id_key" ON "blitz_signups"("blitz_id","rep_id");
CREATE INDEX IF NOT EXISTS "blitz_signups_blitz_id_status_idx" ON "blitz_signups"("blitz_id","status");
CREATE INDEX IF NOT EXISTS "blitz_signups_rep_id_idx" ON "blitz_signups"("rep_id");

DO $$ BEGIN
  ALTER TABLE "blitz_signups" ADD CONSTRAINT "blitz_signups_blitz_id_fkey"
    FOREIGN KEY ("blitz_id") REFERENCES "blitzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "blitz_signups" ADD CONSTRAINT "blitz_signups_rep_id_fkey"
    FOREIGN KEY ("rep_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
