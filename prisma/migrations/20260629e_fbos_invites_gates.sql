-- Fiber Blitz OS v2 — Sprint 1: stub tables for the invite engine (Sprint 2)
-- and the check-in gate system (Sprints 5-6). Foundation only — no app logic
-- yet. Additive + idempotent. Local-only (NOT prod — pending Teki rulings).
--   prisma db execute --file prisma/migrations/20260629e_fbos_invites_gates.sql
--
-- A "slot" in the spec (§4.4 BlitzSlot) is our existing blitz_signups row, so
-- gates + completions FK to blitz_signups rather than a new table.
-- Status fields are app-enforced; only invite/gate lifecycle uses real enums.

DO $$ BEGIN
  CREATE TYPE "BlitzInviteStatus" AS ENUM ('SENT','VIEWED','ACCEPTED','DECLINED','EXPIRED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "GateStatus" AS ENUM ('PENDING','SENT','COMPLETED','MISSED','ESCALATED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- §4.3 BlitzInvite — targeted push/SMS invitations + accept funnel.
CREATE TABLE IF NOT EXISTS "blitz_invites" (
  "id"             TEXT PRIMARY KEY,
  "blitz_id"       TEXT NOT NULL,
  "rep_id"         TEXT NOT NULL,
  "channel"        TEXT NOT NULL DEFAULT 'push',  -- push | sms | both
  "status"         "BlitzInviteStatus" NOT NULL DEFAULT 'SENT',
  "sent_at"        TIMESTAMP(3) NOT NULL DEFAULT now(),
  "viewed_at"      TIMESTAMP(3),
  "accepted_at"    TIMESTAMP(3),
  "declined_at"    TIMESTAMP(3),
  "expires_at"     TIMESTAMP(3),
  "time_to_accept" INTEGER                          -- seconds; feeds rep scoring
);

CREATE UNIQUE INDEX IF NOT EXISTS "blitz_invites_blitz_id_rep_id_key" ON "blitz_invites"("blitz_id","rep_id");
CREATE INDEX IF NOT EXISTS "blitz_invites_blitz_id_status_idx" ON "blitz_invites"("blitz_id","status");
CREATE INDEX IF NOT EXISTS "blitz_invites_rep_id_idx" ON "blitz_invites"("rep_id");

DO $$ BEGIN
  ALTER TABLE "blitz_invites" ADD CONSTRAINT "blitz_invites_blitz_id_fkey"
    FOREIGN KEY ("blitz_id") REFERENCES "blitzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "blitz_invites" ADD CONSTRAINT "blitz_invites_rep_id_fkey"
    FOREIGN KEY ("rep_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- §4.5 CheckInGate — scheduled gate per slot (G0-G5).
CREATE TABLE IF NOT EXISTS "check_in_gates" (
  "id"                     TEXT PRIMARY KEY,
  "blitz_slot_id"          TEXT NOT NULL,           -- -> blitz_signups.id
  "gate_id"                TEXT NOT NULL,           -- 'G0'..'G5'
  "scheduled_trigger_time" TIMESTAMP(3),
  "required_action_type"   TEXT,                    -- acknowledge|checklist|eta_submission|geofence|production_numbers
  "payload"                JSONB,
  "status"                 "GateStatus" NOT NULL DEFAULT 'PENDING',
  "escalation_target_id"   TEXT,                    -- -> users.id (team lead), nullable
  "score_impact"           DOUBLE PRECISION NOT NULL DEFAULT 0,
  "created_at"             TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "check_in_gates_slot_gate_key" ON "check_in_gates"("blitz_slot_id","gate_id");
CREATE INDEX IF NOT EXISTS "check_in_gates_status_trigger_idx" ON "check_in_gates"("status","scheduled_trigger_time");

DO $$ BEGIN
  ALTER TABLE "check_in_gates" ADD CONSTRAINT "check_in_gates_blitz_slot_id_fkey"
    FOREIGN KEY ("blitz_slot_id") REFERENCES "blitz_signups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "check_in_gates" ADD CONSTRAINT "check_in_gates_escalation_target_id_fkey"
    FOREIGN KEY ("escalation_target_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- §4.4 gate_completions — per-gate completion record feeding the readiness score.
CREATE TABLE IF NOT EXISTS "gate_completions" (
  "id"             TEXT PRIMARY KEY,
  "blitz_slot_id"  TEXT NOT NULL,                   -- -> blitz_signups.id
  "gate_id"        TEXT NOT NULL,                   -- 'G0'..'G5'
  "completed_at"   TIMESTAMP(3),
  "on_first_push"  BOOLEAN,
  "nudges_required" INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS "gate_completions_slot_gate_key" ON "gate_completions"("blitz_slot_id","gate_id");

DO $$ BEGIN
  ALTER TABLE "gate_completions" ADD CONSTRAINT "gate_completions_blitz_slot_id_fkey"
    FOREIGN KEY ("blitz_slot_id") REFERENCES "blitz_signups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
