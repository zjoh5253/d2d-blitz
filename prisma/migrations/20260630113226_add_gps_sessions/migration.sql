-- Migration: add gps_sessions
-- Stores GPS door-knock tracking sessions uploaded from the mobile app.

CREATE TABLE "gps_sessions" (
    "id" TEXT NOT NULL,
    "rep_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3) NOT NULL,
    "duration_seconds" INTEGER NOT NULL DEFAULT 0,
    "paused_seconds" INTEGER NOT NULL DEFAULT 0,
    "knock_count" INTEGER NOT NULL DEFAULT 0,
    "route_miles" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gps_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "gps_sessions_rep_id_idx" ON "gps_sessions"("rep_id");
CREATE INDEX "gps_sessions_started_at_idx" ON "gps_sessions"("started_at");

ALTER TABLE "gps_sessions" ADD CONSTRAINT "gps_sessions_rep_id_fkey" FOREIGN KEY ("rep_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
