-- Migration: DDB-62
-- Adds onboarded_user_id to leads table to track the User record created
-- when a lead transitions to ONBOARDED status, enabling the recruiting pipeline
-- to connect directly into the blitz assignment flow.

ALTER TABLE "leads"
  ADD COLUMN "onboarded_user_id" TEXT;

ALTER TABLE "leads"
  ADD CONSTRAINT "leads_onboarded_user_id_fkey"
  FOREIGN KEY ("onboarded_user_id")
  REFERENCES "users" ("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE INDEX "leads_onboarded_user_id_idx"
  ON "leads" ("onboarded_user_id");
