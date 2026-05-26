-- Adds blitz_id to gps_sessions so per-blitz hour attribution is
-- exact instead of approximated by date overlap in
-- /api/rep/scorecard. Nullable so legacy sessions (created before
-- this migration) keep working — the scorecard route falls back to
-- date-overlap for null rows.

ALTER TABLE gps_sessions
  ADD COLUMN IF NOT EXISTS blitz_id TEXT
    REFERENCES blitzes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS gps_sessions_blitz_id_idx
  ON gps_sessions (blitz_id);
