-- Deferred (background) address discovery for area-created blitzes.
-- Additive + idempotent. Reviewed migration, NOT `prisma db push`.
--
-- lead_prep_zip:    ZIP to pull addresses for in the background when a blitz is
--                   created for a ZIP with no pre-loaded inventory (so create
--                   never blocks on slow OSM discovery).
-- lead_prep_source: where the addresses came from — "openaddresses" (full) or
--                   "osm" (partial fallback) — used to label partial coverage.

ALTER TABLE "blitzes"
  ADD COLUMN IF NOT EXISTS "lead_prep_zip"    text,
  ADD COLUMN IF NOT EXISTS "lead_prep_source" text;
