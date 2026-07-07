-- Time-log editing with manager approval (Teki update #2)
-- Additive + idempotent. Safe to run more than once.
-- Apply to prod via Neon console, or:
--   prisma db execute --file prisma/migrations/20260609_time_log_edits.sql --schema prisma/schema.prisma

DO $$ BEGIN
  CREATE TYPE "TimeLogEditStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "gps_session_edits" (
  "id"                       TEXT PRIMARY KEY,
  "session_id"               TEXT NOT NULL,
  "rep_id"                   TEXT NOT NULL,
  "proposed_started_at"      TIMESTAMP(3),
  "proposed_ended_at"        TIMESTAMP(3),
  "proposed_paused_seconds"  INTEGER,
  "proposed_knock_count"     INTEGER,
  "reason"                   TEXT,
  "status"                   "TimeLogEditStatus" NOT NULL DEFAULT 'PENDING',
  "reviewed_by_id"           TEXT,
  "reviewed_at"              TIMESTAMP(3),
  "review_note"              TEXT,
  "created_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "gps_session_edits_status_idx" ON "gps_session_edits"("status");
CREATE INDEX IF NOT EXISTS "gps_session_edits_session_id_idx" ON "gps_session_edits"("session_id");

DO $$ BEGIN
  ALTER TABLE "gps_session_edits" ADD CONSTRAINT "gps_session_edits_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "gps_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "gps_session_edits" ADD CONSTRAINT "gps_session_edits_rep_id_fkey"
    FOREIGN KEY ("rep_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "gps_session_edits" ADD CONSTRAINT "gps_session_edits_reviewed_by_id_fkey"
    FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
