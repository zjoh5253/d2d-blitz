-- Add lat / lng columns to door_knock_leads so the geographic clustering
-- planner can group leads into rep-sized walkable areas.
--
-- Coordinates flow in from:
--   1. map-scanner's createBlitzFromMarket (FCC/OA-derived leads — coords
--      already in scanner_addresses)
--   2. CSV import (if the imported file has lat/lng columns)
--   3. Manual entry (optional)
--
-- Nullable: legacy/manual leads without coords are still valid; they
-- just won't appear in the clustering view until someone backfills them.

ALTER TABLE door_knock_leads
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
