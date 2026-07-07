-- Lead-filtering pipeline state for area-created blitzes.
-- Additive + idempotent — safe against the drifted prod schema. Reviewed
-- migration, NOT `prisma db push`.
--
-- leadPrepStatus: PENDING -> FILTERING -> READY (plain text, app-enforced).
-- Defaults to READY so every existing blitz (and any non-area blitz) is
-- immediately staffable; only the new ZIP create flow sets FILTERING.
-- total/checked drive the list-view progress bar; updated_at powers ETA.

ALTER TABLE "blitzes"
  ADD COLUMN IF NOT EXISTS "lead_prep_status"     text    NOT NULL DEFAULT 'READY',
  ADD COLUMN IF NOT EXISTS "lead_prep_total"      integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lead_prep_checked"    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lead_prep_updated_at" timestamp(3);

CREATE INDEX IF NOT EXISTS "blitzes_lead_prep_status_idx"
  ON "blitzes" ("lead_prep_status");
