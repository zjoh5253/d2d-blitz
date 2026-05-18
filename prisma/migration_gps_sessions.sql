-- Adds gps_sessions table for rep GPS clock-in/out shift records.
-- Saved when a rep ends a tracking session on /rep/gps.

CREATE TABLE IF NOT EXISTS "gps_sessions" (
  "id"               TEXT      PRIMARY KEY,
  "rep_id"           TEXT      NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "started_at"       TIMESTAMP NOT NULL,
  "ended_at"         TIMESTAMP NOT NULL,
  "duration_seconds" INTEGER   NOT NULL,
  "paused_seconds"   INTEGER   NOT NULL DEFAULT 0,
  "knock_count"      INTEGER   NOT NULL DEFAULT 0,
  "route_miles"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "created_at"       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "gps_sessions_rep_id_started_at_idx"
  ON "gps_sessions" ("rep_id", "started_at");
