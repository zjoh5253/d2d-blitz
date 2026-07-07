-- Fiber Blitz OS v2 — Sprint 1: blitz creation-flow fields + comp tier library.
-- Additive + idempotent. Local-only for now (NOT applied to prod — pending
-- Teki's rulings on the 3 spec conflicts). Apply via:
--   prisma db execute --file prisma/migrations/20260629c_fbos_blitz_staffing.sql
--
-- All new columns are nullable or defaulted so every existing blitz keeps
-- working unchanged. comp_tiers is the preset comp library the create form
-- selects from (spec §5.1). Money stored as integer cents.

CREATE TABLE IF NOT EXISTS "comp_tiers" (
  "id"              TEXT PRIMARY KEY,
  "name"            TEXT NOT NULL,
  "base_commission" INTEGER,          -- cents
  "bonus_structure" JSONB,            -- free-form bonus rules
  "travel_notes"    TEXT,
  "is_active"       BOOLEAN NOT NULL DEFAULT true,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT now()
);

ALTER TABLE "blitzes"
  ADD COLUMN IF NOT EXISTS "slug"                  TEXT,
  ADD COLUMN IF NOT EXISTS "comp_tier_id"          TEXT,
  ADD COLUMN IF NOT EXISTS "travel_model"          TEXT,        -- company_fronted | rep_fronted_reimburse
  ADD COLUMN IF NOT EXISTS "travel_cost_cap"       INTEGER,     -- cents
  ADD COLUMN IF NOT EXISTS "min_score_required"    INTEGER,
  ADD COLUMN IF NOT EXISTS "qualification_filters" JSONB,       -- {carrier_credentials, experience_months, ...}
  ADD COLUMN IF NOT EXISTS "territory_polygons"    JSONB,       -- GeoJSON; fallback to hotel radius if null
  ADD COLUMN IF NOT EXISTS "daily_start_time"      TEXT,        -- "HH:MM" local
  ADD COLUMN IF NOT EXISTS "daily_end_time"        TEXT,
  ADD COLUMN IF NOT EXISTS "timezone"              TEXT,
  ADD COLUMN IF NOT EXISTS "rep_seats_backup"      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "public_card_enabled"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "public_card_token"     TEXT;

-- slug + public_card_token are unique where present (Postgres treats NULLs as
-- distinct, so many un-set blitzes coexist fine).
CREATE UNIQUE INDEX IF NOT EXISTS "blitzes_slug_key" ON "blitzes"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "blitzes_public_card_token_key" ON "blitzes"("public_card_token");
CREATE INDEX IF NOT EXISTS "blitzes_comp_tier_id_idx" ON "blitzes"("comp_tier_id");

DO $$ BEGIN
  ALTER TABLE "blitzes" ADD CONSTRAINT "blitzes_comp_tier_id_fkey"
    FOREIGN KEY ("comp_tier_id") REFERENCES "comp_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
