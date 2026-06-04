-- Per-lead action history (door_knock_lead_events). One row per disposition
-- action so reps can re-open a pin and see what was done and when.
-- Additive + idempotent. Reviewed migration, NOT `prisma db push`.

CREATE TABLE IF NOT EXISTS "door_knock_lead_events" (
  "id"            text PRIMARY KEY,
  "lead_id"       text NOT NULL,
  "disposition"   "DoorKnockDisposition" NOT NULL,
  "note"          text,
  "created_by_id" text,
  "created_at"    timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "door_knock_lead_events_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "door_knock_leads"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "door_knock_lead_events_lead_id_idx"
  ON "door_knock_lead_events" ("lead_id");
