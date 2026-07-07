-- PWA push subscriptions + go-back reminder tracking (Teki update #6b)
-- Additive + idempotent. Safe to run more than once.
--   prisma db execute --file prisma/migrations/20260609_push_subscriptions.sql

ALTER TABLE "go_backs" ADD COLUMN IF NOT EXISTS "reminder_sent_at" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id"         TEXT PRIMARY KEY,
  "rep_id"     TEXT NOT NULL,
  "endpoint"   TEXT NOT NULL,
  "p256dh"     TEXT NOT NULL,
  "auth"       TEXT NOT NULL,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");
CREATE INDEX IF NOT EXISTS "push_subscriptions_rep_id_idx" ON "push_subscriptions"("rep_id");

DO $$ BEGIN
  ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_rep_id_fkey"
    FOREIGN KEY ("rep_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
