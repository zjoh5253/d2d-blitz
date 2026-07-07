-- Lead suppression for known current customers.
--
-- Adds DoorKnockLead.suppressed + suppression_reason so leads matching a
-- known current customer (install / sale / sold lead, or later a carrier
-- partner export) can be hidden from reps while staying visible to admins.
--
-- Additive + idempotent (ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT
-- EXISTS). Touches only door_knock_leads — safe against the drifted prod
-- schema (does NOT go near the orphan scanner_* tables). Reviewed migration,
-- NOT `prisma db push`.

ALTER TABLE "door_knock_leads"
  ADD COLUMN IF NOT EXISTS "suppressed" boolean NOT NULL DEFAULT false;

ALTER TABLE "door_knock_leads"
  ADD COLUMN IF NOT EXISTS "suppression_reason" text;

CREATE INDEX IF NOT EXISTS "door_knock_leads_suppressed_idx"
  ON "door_knock_leads" ("suppressed");
