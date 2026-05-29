-- Migration: install AI-parser + smart-matching support
-- Date: 2026-05-29
-- Scope: ADDITIVE ONLY. Adds columns to install_records / install_uploads and
--        relaxes install_records.install_date to nullable. No drops, no data
--        loss, safe to run on the live DB.
--
-- WHY A HAND-SCOPED FILE (not `prisma migrate diff` output):
--   The live DB has drifted from prisma/schema.prisma — it still contains
--   orphaned scanner_markets / scanner_providers / scanner_zips tables and is
--   missing the gps_sessions foreign keys the schema declares. A full
--   schema-vs-db diff (and `prisma db push`) would try to DROP those scanner
--   tables and rewrite FKs. This file deliberately contains ONLY the install
--   feature's changes. (Track the drift separately.)
--
-- APPLY (after review), pick one:
--   • Neon SQL console: paste and run.
--   • CLI:  npx prisma db execute --file prisma/migrations/20260529_install_ai_parser.sql --schema prisma/schema.prisma
-- Idempotent: ADD COLUMN IF NOT EXISTS + DROP NOT NULL can be re-run safely.

BEGIN;

-- install_uploads: parse method, AI caveats, exception tally
ALTER TABLE "install_uploads" ADD COLUMN IF NOT EXISTS "exception_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "install_uploads" ADD COLUMN IF NOT EXISTS "parse_method"    TEXT;
ALTER TABLE "install_uploads" ADD COLUMN IF NOT EXISTS "notes"           TEXT;

-- install_records: match scoring/confidence, extraction confidence, raw audit blob
ALTER TABLE "install_records" ADD COLUMN IF NOT EXISTS "match_score"           DOUBLE PRECISION;
ALTER TABLE "install_records" ADD COLUMN IF NOT EXISTS "match_confidence"      TEXT;
ALTER TABLE "install_records" ADD COLUMN IF NOT EXISTS "extraction_confidence" DOUBLE PRECISION;
ALTER TABLE "install_records" ADD COLUMN IF NOT EXISTS "raw_data"              TEXT;

-- install_date may now be NULL (unparseable carrier dates are flagged, not faked)
ALTER TABLE "install_records" ALTER COLUMN "install_date" DROP NOT NULL;

COMMIT;

-- ── Rollback (if ever needed) ───────────────────────────────────────────────
-- BEGIN;
-- ALTER TABLE "install_uploads" DROP COLUMN IF EXISTS "exception_count";
-- ALTER TABLE "install_uploads" DROP COLUMN IF EXISTS "parse_method";
-- ALTER TABLE "install_uploads" DROP COLUMN IF EXISTS "notes";
-- ALTER TABLE "install_records" DROP COLUMN IF EXISTS "match_score";
-- ALTER TABLE "install_records" DROP COLUMN IF EXISTS "match_confidence";
-- ALTER TABLE "install_records" DROP COLUMN IF EXISTS "extraction_confidence";
-- ALTER TABLE "install_records" DROP COLUMN IF EXISTS "raw_data";
-- -- NOTE: only re-add NOT NULL if every install_date is populated:
-- -- ALTER TABLE "install_records" ALTER COLUMN "install_date" SET NOT NULL;
-- COMMIT;
